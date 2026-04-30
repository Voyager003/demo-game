import { describe, expect, it } from 'vitest';
import { testEmployee, testTraitProfile } from '../test/fixtures';
import { ChemistryBoard, pairKey, teamConflictCandidates } from './chemistry';

describe('ChemistryBoard', () => {
  it('initializes pair chemistry from trait synergy and conflict', () => {
    const leader = testEmployee({
      id: 'a',
      traitProfile: testTraitProfile(['CaringLeader', 'SelfLearner', 'Sprinter'], ['CaringLeader']),
    });
    const cynic = testEmployee({
      id: 'b',
      traitProfile: testTraitProfile(['Cynic', 'JobHopper', 'Perfectionist'], ['Cynic']),
    });

    const snapshot = ChemistryBoard.initialize([leader, cynic]);

    expect(snapshot.pairChem[pairKey('a', 'b')]).toBeLessThan(0);
    expect(snapshot.teamChem).toBeLessThanOrEqual(50);
  });

  it('applies project outcomes and conflict adjustments', () => {
    const a = testEmployee({ id: 'a' });
    const b = testEmployee({ id: 'b' });
    const afterSuccess = new ChemistryBoard(ChemistryBoard.initialize([a, b]))
      .applyProjectOutcome([a, b], ['a', 'b'], true)
      .toSnapshot();
    const afterConflict = new ChemistryBoard(afterSuccess).applyConflict().toSnapshot();

    expect(afterSuccess.teamChem).toBeGreaterThanOrEqual(50);
    expect(afterConflict.teamChem).toBeLessThan(afterSuccess.teamChem);
  });

  it('finds conflict candidates only when team chemistry is low', () => {
    const cynic = testEmployee({
      id: 'c',
      traitProfile: testTraitProfile(['Cynic', 'Sprinter', 'SelfLearner'], ['Cynic']),
    });
    expect(teamConflictCandidates([cynic], {
      teamChem: 60,
      pairChem: {},
      recentTensions: [],
      cultureHints: [],
    })).toEqual([]);

    expect(teamConflictCandidates([cynic], {
      teamChem: 30,
      pairChem: {},
      recentTensions: [],
      cultureHints: [],
    }).map((employee) => employee.id)).toEqual(['c']);
  });
});
