import { describe, expect, it } from 'vitest';
import { TurnPhase } from './turn-phase';

describe('TurnPhase', () => {
  it('uses named predicates and advances through the standard phase flow', () => {
    const setup = TurnPhase.from(1);

    expect(setup.isSetup()).toBe(true);
    expect(setup.isDecision()).toBe(false);
    expect(setup.toDecisionPhase().value).toBe(2);
    expect(TurnPhase.from(2).toExecutionPhase().value).toBe(3);
    expect(TurnPhase.from(3).toSettlementPhase().value).toBe(4);
    expect(TurnPhase.from(4).toReportPhase().value).toBe(5);
  });

  it('starts the next turn only from the report phase', () => {
    expect(TurnPhase.from(5).startNextTurn(3)).toEqual({ turn: 4, phase: 1 });
    expect(TurnPhase.from(4).startNextTurn(3)).toEqual({ turn: 3, phase: 4 });
  });
});
