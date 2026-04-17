import { ACTION_RULES, maxFatigueForLeadership } from './actions';
import type { ActionType, FatigueState, GameState } from '../types/core';

export class FatigueMeter {
  private readonly snapshot: FatigueState;

  constructor(snapshot: FatigueState) {
    this.snapshot = {
      current: snapshot.current,
      max: snapshot.max,
      cooldowns: { ...snapshot.cooldowns },
    };
  }

  static startTurn(leadership: number, cooldowns?: Record<ActionType, number>): FatigueMeter {
    const max = maxFatigueForLeadership(leadership);
    return new FatigueMeter({
      current: max,
      max,
      cooldowns: cooldowns ?? createInitialCooldowns(),
    });
  }

  canPerform(action: ActionType): boolean {
    const rule = ACTION_RULES[action];
    return this.snapshot.current >= rule.fatigue && this.cooldownLeft(action) === 0;
  }

  cooldownLeft(action: ActionType): number {
    return this.snapshot.cooldowns[action] ?? 0;
  }

  spend(action: ActionType): FatigueMeter {
    if (!this.canPerform(action)) return this;
    const rule = ACTION_RULES[action];
    return new FatigueMeter({
      current: this.snapshot.current - rule.fatigue,
      max: this.snapshot.max,
      cooldowns: {
        ...this.snapshot.cooldowns,
        [action]: rule.cooldown,
      },
    });
  }

  decrementCooldowns(): FatigueMeter {
    const cooldowns = { ...this.snapshot.cooldowns };
    for (const action of Object.keys(cooldowns) as ActionType[]) {
      cooldowns[action] = Math.max(0, cooldowns[action] - 1);
    }
    return new FatigueMeter({ ...this.snapshot, cooldowns });
  }

  resetForLeadership(leadership: number): FatigueMeter {
    return FatigueMeter.startTurn(leadership, this.snapshot.cooldowns);
  }

  toSnapshot(): FatigueState {
    return {
      current: this.snapshot.current,
      max: this.snapshot.max,
      cooldowns: { ...this.snapshot.cooldowns },
    };
  }
}

export function createInitialCooldowns(): Record<ActionType, number> {
  return {
    postJobListing: 0,
    conductInterview: 0,
    fireEmployee: 0,
    adjustSalary: 0,
    signContract: 0,
    changeAssignment: 0,
    orderOvertime: 0,
  };
}

export function canPerformAction(state: GameState, action: ActionType): boolean {
  return new FatigueMeter(state.fatigue).canPerform(action);
}

