import { describe, expect, it } from 'vitest';
import type { RandomSource } from './generation';
import { testEmployee, testTraitProfile } from '../test/fixtures';
import { TraitRegistry, TraitRevealPolicy, getRevealedTraitDefinitions } from './traits';

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

describe('TraitRegistry', () => {
  it('creates 3 fixed traits with one revealed and hidden hints', () => {
    const registry = new TraitRegistry(new StubRandomSource([0, 0, 0.75]));
    const profile = registry.createProfile();

    expect(profile.traitIds).toHaveLength(3);
    expect(profile.reveal.revealedTraitIds).toHaveLength(1);
    expect(profile.reveal.hints).toHaveLength(2);
  });
});

describe('TraitRevealPolicy', () => {
  it('reveals hidden traits only when matching trigger occurs', () => {
    const employee = testEmployee({
      traitProfile: testTraitProfile(['OvertimeMaster', 'JobHopper', 'CaringLeader'], ['OvertimeMaster']),
    });
    const policy = new TraitRevealPolicy();

    const unchanged = policy.reveal(employee, 'projectCompleted', 4, '완료');
    expect(unchanged.unlocked).toEqual([]);

    const revealed = policy.reveal(employee, 'salaryNegotiation', 5, '협상');
    expect(revealed.unlocked.map((record) => record.traitId)).toEqual(['JobHopper']);
    expect(getRevealedTraitDefinitions(revealed.employee.traitProfile).map((trait) => trait.id)).toContain('JobHopper');
  });
});
