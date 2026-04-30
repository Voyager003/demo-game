import { describe, expect, it } from 'vitest';
import { InvestmentResultResolver, InvestmentReviewPolicy } from './investment-policies';
import type { RandomSource } from '../generation';
import { testEmployee, testGameState, testProject } from '../../test/fixtures';

class StubRandomSource implements RandomSource {
  private readonly values: number[];

  constructor(values: number[]) {
    this.values = values;
  }

  next(): number {
    return this.values.shift() ?? 0;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] ?? items[0]!;
  }
}

describe('InvestmentReviewPolicy', () => {
  it('builds a review package from vision, delivery history, recurring revenue, and company rating', () => {
    const policy = new InvestmentReviewPolicy(new StubRandomSource([0.2]));
    const start = policy.start({
      turn: 4,
      ceo: testGameState().ceo,
      companyRating: 35,
      completedProjectCount: 3,
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 450,
          assignedEmployeeIds: ['emp'],
        }),
      ],
      employees: [testEmployee({ id: 'emp' })],
    }, testGameState().investment);

    expect(start.investment.status).toBe('underReview');
    expect(start.investment.reviewEndsOnTurn).toBe(6);
    expect(start.investment.pendingResult?.deterministicScore).toBeGreaterThan(0);
    expect(start.investment.pendingResult?.summary).toContain('vision=5');
    expect(start.probabilisticTrace.layer).toBe('probabilistic');
  });

  it('caps probability and can produce a deterministic failure with a high random roll', () => {
    const policy = new InvestmentReviewPolicy(new StubRandomSource([0.95]));
    const start = policy.start({
      turn: 2,
      ceo: testGameState().ceo,
      companyRating: 5,
      completedProjectCount: 0,
      activeProjects: [],
      employees: [],
    }, testGameState().investment);

    expect(start.investment.pendingResult?.success).toBe(false);
    expect(start.investment.pendingResult?.successProbability).toBeGreaterThanOrEqual(0.15);
    expect(start.investment.pendingResult?.successProbability).toBeLessThanOrEqual(0.9);
  });
});

describe('InvestmentResultResolver', () => {
  it('applies success rewards with stat clamps', () => {
    const resolver = new InvestmentResultResolver();
    const result = resolver.resolve({
      capital: 2000,
      companyRating: 96,
      turn: 6,
      employees: [testEmployee({
        id: 'emp',
        commonStats: {
          stamina: 2,
          communication: 2,
          mental: 2,
          growthRate: 5,
          loyalty: 5,
        },
      })],
      investment: {
        status: 'underReview',
        reviewEndsOnTurn: 6,
        cooldownEndsOnTurn: null,
        attemptCount: 1,
        pendingResult: {
          success: true,
          deterministicScore: 70,
          successProbability: 0.7,
          capitalDelta: 1700,
          companyRatingDelta: 8,
          employeeLoyaltyDelta: 1,
          employeeGrowthRateDelta: 1,
          summary: ['potential=55'],
        },
      },
    });

    expect(result.capital).toBe(3700);
    expect(result.companyRating).toBe(100);
    expect(result.employees[0]?.commonStats.loyalty).toBe(5);
    expect(result.employees[0]?.commonStats.growthRate).toBe(5);
    expect(result.investment.status).toBe('cooldown');
  });

  it('applies failure penalties without changing employee stats', () => {
    const resolver = new InvestmentResultResolver();
    const employee = testEmployee({
      id: 'emp',
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 2,
      },
    });
    const result = resolver.resolve({
      capital: 2000,
      companyRating: 10,
      turn: 8,
      employees: [employee],
      investment: {
        status: 'underReview',
        reviewEndsOnTurn: 8,
        cooldownEndsOnTurn: null,
        attemptCount: 2,
        pendingResult: {
          success: false,
          deterministicScore: 25,
          successProbability: 0.25,
          capitalDelta: 0,
          companyRatingDelta: -5,
          employeeLoyaltyDelta: 0,
          employeeGrowthRateDelta: 0,
          summary: ['potential=18'],
        },
      },
    });

    expect(result.capital).toBe(2000);
    expect(result.companyRating).toBe(5);
    expect(result.employees[0]).toEqual(employee);
    expect(result.logs).toHaveLength(1);
  });
});
