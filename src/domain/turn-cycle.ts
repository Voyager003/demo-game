import type { Phase } from '../types/core';
import { TurnPhase } from './turn-phase';

export class TurnCycle {
  private readonly turn: number;
  private readonly phase: Phase;

  constructor(turn: number, phase: Phase) {
    this.turn = turn;
    this.phase = phase;
  }

  toDecisionPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: TurnPhase.from(this.phase).toDecisionPhase().value };
  }

  toExecutionPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: TurnPhase.from(this.phase).toExecutionPhase().value };
  }

  toSettlementPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: TurnPhase.from(this.phase).toSettlementPhase().value };
  }

  toReportPhase(): { turn: number; phase: Phase } {
    return { turn: this.turn, phase: TurnPhase.from(this.phase).toReportPhase().value };
  }

  startNextTurn(): { turn: number; phase: Phase } {
    return TurnPhase.from(this.phase).startNextTurn(this.turn);
  }
}
