import type { Phase } from '../types/core';

export class TurnCycle {
  private readonly turn: number;
  private readonly phase: Phase;

  constructor(turn: number, phase: Phase) {
    this.turn = turn;
    this.phase = phase;
  }

  toDecisionPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: this.phase === 1 ? 2 : this.phase };
  }

  toExecutionPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: this.phase === 2 ? 3 : this.phase };
  }

  toSettlementPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: this.phase === 3 ? 4 : this.phase };
  }

  toReportPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: this.phase === 4 ? 5 : this.phase };
  }

  startNextTurn(): { turn: number; phase: Phase } {
    if (this.phase !== 5) return { turn: this.turn, phase: this.phase };
    return { turn: this.turn + 1, phase: 1 };
  }
}
