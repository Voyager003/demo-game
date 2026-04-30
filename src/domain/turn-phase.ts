import type { Phase } from '../types/core';

export class TurnPhase {
  readonly value: Phase;

  private constructor(value: Phase) {
    this.value = value;
  }

  static from(phase: Phase): TurnPhase {
    return new TurnPhase(phase);
  }

  isSetup(): boolean {
    return this.value === 1;
  }

  isDecision(): boolean {
    return this.value === 2;
  }

  isExecution(): boolean {
    return this.value === 3;
  }

  isSettlement(): boolean {
    return this.value === 4;
  }

  isReport(): boolean {
    return this.value === 5;
  }

  toDecisionPhase(): TurnPhase {
    return this.isSetup() ? TurnPhase.from(2) : this;
  }

  toExecutionPhase(): TurnPhase {
    return this.isDecision() ? TurnPhase.from(3) : this;
  }

  toSettlementPhase(): TurnPhase {
    return this.isExecution() ? TurnPhase.from(4) : this;
  }

  toReportPhase(): TurnPhase {
    return this.isSettlement() ? TurnPhase.from(5) : this;
  }

  startNextTurn(turn: number): { turn: number; phase: Phase } {
    if (!this.isReport()) {
      return { turn, phase: this.value };
    }
    return { turn: turn + 1, phase: 1 };
  }
}
