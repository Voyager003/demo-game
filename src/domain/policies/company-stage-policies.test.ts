import { describe, expect, it } from 'vitest';
import { testEmployee, testGameState, testProject } from '../../test/fixtures';
import {
  CompanyStageInvestmentGatePolicy,
  CompanyStagePressurePolicy,
  CompanyStageProgressionPolicy,
} from './company-stage-policies';

describe('CompanyStageProgressionPolicy', () => {
  it('promotes only one stage per monthly check and refreshes preview', () => {
    const policy = new CompanyStageProgressionPolicy();
    const employees = Array.from({ length: 6 }, (_, index) => testEmployee({ id: `emp-${index}` }));
    const transition = policy.evaluate(testGameState({
      turn: 8,
      capital: 9000,
      companyRating: 70,
      employees,
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 400,
          assignedEmployeeIds: employees.map((employee) => employee.id),
        }),
      ],
    }));

    expect(transition.promoted).toBe(true);
    expect(transition.companyStage.currentStage).toBe('earlyTeam');
    expect(transition.companyStage.highestStage).toBe('earlyTeam');
    expect(transition.companyStage.nextStagePreview.stage).toBe('startup');
  });

  it('does not promote when any requirement is missing', () => {
    const policy = new CompanyStageProgressionPolicy();
    const employees = Array.from({ length: 6 }, (_, index) => testEmployee({ id: `emp-${index}` }));
    const transition = policy.evaluate(testGameState({
      turn: 8,
      capital: 2500,
      companyRating: 50,
      employees,
      companyStage: {
        currentStage: 'earlyTeam',
        highestStage: 'earlyTeam',
        lastPromotedTurn: 4,
        nextStagePreview: { stage: 'startup', stageLabel: '소규모 스타트업', requirements: [] },
      },
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 220,
          assignedEmployeeIds: employees.map((employee) => employee.id),
        }),
      ],
    }));

    expect(transition.promoted).toBe(false);
    expect(transition.companyStage.currentStage).toBe('earlyTeam');
    expect(transition.companyStage.nextStagePreview.requirements.some((requirement) => !requirement.met)).toBe(true);
  });
});

describe('CompanyStagePressurePolicy', () => {
  it('applies startup dual-load and low-chem penalties together', () => {
    const policy = new CompanyStagePressurePolicy();
    const employees = Array.from({ length: 6 }, (_, index) => testEmployee({ id: `emp-${index}` }));
    const result = policy.evaluate(testGameState({
      employees,
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
          assignedEmployeeIds: employees.slice(0, 3).map((employee) => employee.id),
        }),
        testProject({
          id: 'contract',
          kind: 'contract',
          status: 'active',
          assignedEmployeeIds: employees.slice(3).map((employee) => employee.id),
        }),
      ],
      organization: {
        chemistry: {
          teamChem: 42,
          pairChem: {},
          recentTensions: [],
          cultureHints: [],
        },
      },
    }));

    expect(result.profile.operatingCostPercent).toBe(0.25);
    expect(result.profile.projectProgressPercent).toBeCloseTo(-0.13, 5);
    expect(result.profile.recurringRevenuePercent).toBeCloseTo(-0.15, 5);
    expect(result.profile.reasons).toHaveLength(2);
  });
});

describe('CompanyStageInvestmentGatePolicy', () => {
  it('blocks investment when scale-up requirements are not met', () => {
    const policy = new CompanyStageInvestmentGatePolicy();
    const result = policy.isAllowed(testGameState({
      companyRating: 55,
      companyStage: {
        currentStage: 'scaleUp',
        highestStage: 'scaleUp',
        lastPromotedTurn: 20,
        nextStagePreview: { stage: null, stageLabel: null, requirements: [] },
      },
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 300,
          assignedEmployeeIds: ['emp-1'],
        }),
      ],
      organization: {
        chemistry: {
          teamChem: 50,
          pairChem: {},
          recentTensions: [],
          cultureHints: [],
        },
      },
    }));

    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual([
      '회사 평가 60+ 필요',
      '실효 반복수입 350만원+ 필요',
      '팀 케미 55+ 필요',
    ]);
  });
});
