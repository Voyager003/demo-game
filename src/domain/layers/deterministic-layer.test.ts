import { describe, expect, it } from 'vitest';
import {
  DeterministicLayer,
  resolveEconomyDeterministicMetrics,
  resolveProjectDeterministicMetrics,
} from './deterministic-layer';
import { ProbabilisticLayer } from './probabilistic-layer';
import { BaseSimulationLayer, type MetricResolution } from './base-simulation-layer';
import { testEmployee, testProject, testSpecialistStats } from '../../test/fixtures';
import type { LayerEffect } from '../../types/layer';

class TestLayer extends BaseSimulationLayer<LayerEffect[], MetricResolution> {
  readonly kind = 'deterministic' as const;

  evaluate(context: LayerEffect[]): LayerEffect[] {
    return context;
  }

  resolve(context: LayerEffect[]): MetricResolution {
    return this.aggregateMetric({
      metric: 'project.progressPerTurn',
      baseValue: 10,
      effects: this.evaluate(context),
      min: 0,
      max: 100,
      precision: 1,
      trace: {
        rule: 'test aggregation',
        trigger: 'unit test',
        inputs: ['input=1'],
      },
    });
  }
}

function effect(overrides: Partial<LayerEffect>): LayerEffect {
  return {
    layer: 'deterministic',
    metric: 'project.progressPerTurn',
    operation: 'add',
    value: 0,
    reason: 'test',
    sourceRuleId: 'test-rule',
    ...overrides,
  };
}

describe('BaseSimulationLayer aggregation', () => {
  it('applies last set, add totals, percent totals, clamp, rounding, and trace formatting', () => {
    const result = new TestLayer().resolve([
      effect({ operation: 'set', value: 20, reason: 'base 20' }),
      effect({ operation: 'set', value: 30, reason: 'base 30' }),
      effect({ operation: 'add', value: 5.25, reason: 'add progress' }),
      effect({ operation: 'percent', value: 0.1, reason: 'boost' }),
      effect({ operation: 'percent', value: -0.2, reason: 'penalty' }),
      effect({ metric: 'project.clientSatisfaction', operation: 'add', value: 100 }),
    ]);

    expect(result.baseValue).toBe(30);
    expect(result.addTotal).toBe(5.3);
    expect(result.percentTotal).toBe(-0.1);
    expect(result.finalValue).toBe(31.7);
    expect(result.effects).toHaveLength(5);
    expect(result.trace.finalValue).toContain('project.progressPerTurn');
    expect(result.trace.effects).toContain('base 30: project.progressPerTurn set 30');
  });

  it('clamps below the minimum', () => {
    const result = new TestLayer().resolve([
      effect({ operation: 'set', value: -10 }),
      effect({ operation: 'percent', value: 1 }),
    ]);

    expect(result.finalValue).toBe(0);
  });
});

describe('DeterministicLayer project metrics', () => {
  it('resolves developer progress and on-time satisfaction', () => {
    const project = testProject({
      turnsElapsed: 2,
      turnsRequired: 4,
      assignedEmployeeIds: ['dev'],
    });
    const dev = testEmployee({
      id: 'dev',
      role: 'developer',
      specialistStats: testSpecialistStats('developer', 5),
    });

    const result = resolveProjectDeterministicMetrics(project, [dev]);

    expect(result.progressPerTurn.finalValue).toBe(19);
    expect(result.clientSatisfaction.finalValue).toBe(78);
    expect(result.progressPerTurn.trace.effects).toContain('Test Employee 개발자 구현속도: project.progressPerTurn add 8');
    expect(result.progressPerTurn.trace.effects).toContain('Test Employee 개발자 문제해결력: project.progressPerTurn add 5');
  });

  it('combines designer, PM support, common stats, probation, and overtime modifiers', () => {
    const project = testProject({
      id: 'p',
      name: 'Contract',
      overtimeActive: true,
      turnsElapsed: 5,
      turnsRequired: 4,
      assignedEmployeeIds: ['designer', 'pm'],
    });
    const designer = testEmployee({
      id: 'designer',
      name: 'Designer',
      role: 'designer',
      probationTurnsLeft: 2,
      commonStats: {
        stamina: 5,
        communication: 5,
        mental: 5,
        growthRate: 2,
        loyalty: 2,
      },
      specialistStats: {
        uiSense: 6,
        uxThinking: 6,
        workSpeed: 6,
        brandingSense: 6,
        prototyping: 6,
      },
    });
    const pm = testEmployee({
      id: 'pm',
      name: 'PM',
      role: 'pm',
      commonStats: {
        stamina: 5,
        communication: 5,
        mental: 5,
        growthRate: 2,
        loyalty: 2,
      },
      specialistStats: {
        scheduleManagement: 9,
        requirementAnalysis: 8,
        riskDetection: 9,
        clientManagement: 8,
        teamCoordination: 9,
      },
    });

    const result = new DeterministicLayer().resolve({
      project,
      assignedEmployees: [designer, pm],
    });

    expect(result.progressPerTurn.finalValue).toBeGreaterThan(24);
    expect(result.progressPerTurn.trace.effects.some((text) => text.includes('야근 지시'))).toBe(true);
    expect(result.progressPerTurn.trace.effects.some((text) => text.includes('수습 직원'))).toBe(true);
    expect(result.clientSatisfaction.finalValue).toBeGreaterThan(60);
  });

  it('returns zero progress for no assigned employees', () => {
    const result = resolveProjectDeterministicMetrics(testProject(), []);

    expect(result.progressPerTurn.finalValue).toBe(0);
    expect(result.clientSatisfaction.finalValue).toBe(78);
  });
});

describe('DeterministicLayer economy metrics', () => {
  it('returns zero recurring revenue when main revenue is missing or unstaffed', () => {
    expect(resolveEconomyDeterministicMetrics([], []).recurringRevenue.finalValue).toBe(0);

    const main = testProject({
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 300,
      assignedEmployeeIds: [],
    });

    const result = resolveEconomyDeterministicMetrics([main], [testEmployee({ id: 'a' })]);
    expect(result.baseRevenue).toBe(300);
    expect(result.recurringRevenue.finalValue).toBe(0);
    expect(result.recurringRevenue.trace.effects).toContain('주수입원 배정 직원 없음: economy.recurringRevenue percent -100%');
  });

  it('applies assignment split and stat-based revenue modifiers', () => {
    const main = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 300,
      assignedEmployeeIds: ['a'],
    });
    const contract = testProject({
      id: 'contract',
      status: 'active',
      assignedEmployeeIds: ['a'],
    });
    const employee = testEmployee({
      id: 'a',
      commonStats: {
        stamina: 2,
        communication: 5,
        mental: 2,
        growthRate: 2,
        loyalty: 2,
      },
    });

    const result = resolveEconomyDeterministicMetrics([main, contract], [employee]);

    expect(result.recurringRevenue.baseValue).toBe(300);
    expect(result.recurringRevenue.finalValue).toBe(157);
    expect(result.recurringRevenue.percentTotal).toBeCloseTo(-0.4775, 4);
    expect(result.recurringRevenue.trace.inputs).toContain('contributionRatio=50%');
    expect(result.recurringRevenue.trace.effects.some((text) => text.includes('소통'))).toBe(true);
  });
});

describe('ProbabilisticLayer shell', () => {
  it('aggregates probability effects through the shared modifier model', () => {
    const layer = new ProbabilisticLayer();

    const effects = layer.evaluate({
      metric: 'probability.employeeBurnout',
      baseProbability: 0.1,
      effects: [],
      trace: {
        rule: 'fixture',
        trigger: 'fixture',
        inputs: [],
      },
    });
    const resolution = layer.resolve({
      metric: 'probability.employeeBurnout',
      baseProbability: 0.1,
      effects: [],
      trace: {
        rule: 'fixture',
        trigger: 'fixture',
        inputs: [],
      },
    });

    expect(effects).toEqual([]);
    expect(resolution.effects).toEqual([]);
    expect(resolution.probability?.finalValue).toBe(0.1);
  });
});
