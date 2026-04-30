import { describe, expect, it } from 'vitest';
import { EconomyLedger } from '../economy';
import { testEmployee, testGameState, testProject } from '../../test/fixtures';
import type { IdGenerator } from '../generation';
import {
  CrisisPolicy,
  MonthlySettlementPolicy,
  PendingEventFactory,
} from './session-policies';

class StubIdGenerator implements IdGenerator {
  private readonly ids: string[];

  constructor(ids: string[]) {
    this.ids = ids;
  }

  next(prefix = ''): string {
    return `${prefix}${this.ids.shift() ?? 'generated'}`;
  }
}

describe('PendingEventFactory', () => {
  it('creates deterministic probation, salary, deadline, capital warning, and investment result events', () => {
    const probationEmployee = testEmployee({
      id: 'emp',
      name: 'Probation Employee',
      probationTurnsLeft: 0,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 1,
      },
      hiredOnTurn: 1,
    });
    const salaryEmployee = testEmployee({
      id: 'salary',
      name: 'Salary Employee',
      probationTurnsLeft: -1,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 1,
      },
      hiredOnTurn: 1,
    });
    const project = testProject({
      id: 'project',
      name: 'Deadline',
      status: 'active',
      turnsRequired: 6,
      turnsElapsed: 3,
    });
    const factory = new PendingEventFactory(new StubIdGenerator([
      'probation-1',
      'salary-1',
      'deadline-1',
      'capital-1',
      'investment-1',
    ]));

    const events = factory.create(testGameState({
      turn: 13,
      capital: 500,
      employees: [probationEmployee, salaryEmployee],
      activeProjects: [project],
      pendingEvents: [],
      investment: {
        status: 'underReview',
        reviewEndsOnTurn: 13,
        cooldownEndsOnTurn: null,
        attemptCount: 1,
        pendingResult: {
          success: true,
          deterministicScore: 60,
          successProbability: 0.6,
          capitalDelta: 1600,
          companyRatingDelta: 8,
          employeeLoyaltyDelta: 1,
          employeeGrowthRateDelta: 1,
          summary: ['potential=50'],
        },
      },
    }));

    expect(events.map((event) => event.type)).toEqual([
      'probationConversion',
      'salaryNegotiation',
      'deadlineApproaching',
      'capitalCrisis',
      'investmentResult',
    ]);
    expect(events[0]?.id).toBe('evt_probation-1');
    expect(events[1]?.id).toBe('evt_salary-1');
  });
});

describe('CrisisPolicy', () => {
  it('uses receivables to extend crisis grace turns', () => {
    const policy = new CrisisPolicy();
    const transition = policy.evaluate(testGameState({
      capital: 0,
      gameStatus: 'playing',
      activeProjects: [
        testProject({
          id: 'done',
          status: 'completed',
          finalPaid: false,
        }),
      ],
    }));

    expect(transition.gameStatus).toBe('crisis');
    expect(transition.crisisGraceTurnsLeft).toBe(8);
    expect(transition.logs[0]?.message).toContain('위기 상태 진입');
  });
});

describe('MonthlySettlementPolicy', () => {
  it('applies company stage operating overhead during monthly settlement', () => {
    const policy = new MonthlySettlementPolicy();
    const employee = testEmployee({ salary: 4800 });
    const state = testGameState({
      turn: 4,
      capital: 2000,
      employees: [employee],
      companyStage: {
        currentStage: 'startup',
        highestStage: 'startup',
        lastPromotedTurn: 8,
        nextStagePreview: { stage: 'scaleUp', stageLabel: '스케일업', requirements: [] },
      },
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 300,
          assignedEmployeeIds: [employee.id],
        }),
      ],
    });

    const base = policy.apply(state);
    const transition = policy.apply(state, {
      operatingCostPercent: 0.25,
    });

    expect(base.recurringRevenue).toBe(transition.recurringRevenue);
    expect(base.capital - transition.capital).toBe(
      EconomyLedger.monthlyOperatingCosts(1, 0.25) - EconomyLedger.monthlyOperatingCosts(1),
    );
    expect(transition.recurringRevenue).toBeGreaterThan(0);
  });
});
