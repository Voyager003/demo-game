import { describe, expect, it } from 'vitest';
import type { RandomSource } from '../generation';
import { testEmployee, testGameState, testTraitProfile } from '../../test/fixtures';
import { TraitProbabilisticEventPolicy } from './trait-probabilistic-policies';

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

describe('TraitProbabilisticEventPolicy', () => {
  it('creates burnout, quit, and conflict events from risky trait conditions', () => {
    const burnout = testEmployee({
      id: 'burn',
      hp: 10,
      traitProfile: testTraitProfile(['BurnoutProne', 'Sprinter', 'SelfLearner'], ['BurnoutProne']),
    });
    const quitter = testEmployee({
      id: 'quit',
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 0,
      },
      traitProfile: testTraitProfile(['JobHopper', 'Cynic', 'Perfectionist'], ['JobHopper']),
    });
    const state = testGameState({
      employees: [burnout, quitter],
      organization: {
        chemistry: {
          teamChem: 30,
          pairChem: {},
          recentTensions: [],
          cultureHints: [],
        },
      },
    });
    const policy = new TraitProbabilisticEventPolicy(new StubRandomSource([0, 0, 0]));

    const result = policy.evaluate({
      turn: state.turn,
      employees: state.employees,
      organization: state.organization,
      pendingEvents: [],
    });

    expect(result.pendingEvents.map((event) => event.type)).toEqual([
      'employeeBurnout',
      'employeeQuit',
      'teamConflict',
    ]);
    expect(result.logs).toHaveLength(3);
  });
});
