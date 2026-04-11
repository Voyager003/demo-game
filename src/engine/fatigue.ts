import { LEADERSHIP_TO_MAX_FATIGUE } from '../constants/leadershipTable';
import { ACTION_COSTS } from '../constants/actionCosts';
import type { ActionType, GameState } from '../types/core';

export function calcMaxFatigue(leadership: number): number {
  const clamped = Math.max(1, Math.min(10, Math.round(leadership)));
  return LEADERSHIP_TO_MAX_FATIGUE[clamped] ?? 8;
}

export function canPerformAction(
  state: GameState,
  action: ActionType,
): boolean {
  const cost = ACTION_COSTS[action];
  const onCooldown = (state.actionCooldowns[action] ?? 0) > 0;
  const hasFatigue = state.currentFatigue >= cost.fatigue;
  return hasFatigue && !onCooldown;
}

export function applyActionCost(
  state: GameState,
  action: ActionType,
): Pick<GameState, 'currentFatigue' | 'actionCooldowns'> {
  const cost = ACTION_COSTS[action];
  return {
    currentFatigue: state.currentFatigue - cost.fatigue,
    actionCooldowns: {
      ...state.actionCooldowns,
      [action]: cost.cooldown,
    },
  };
}

export function decrementCooldowns(
  cooldowns: Record<ActionType, number>,
): Record<ActionType, number> {
  const result = { ...cooldowns } as Record<ActionType, number>;
  for (const key of Object.keys(result) as ActionType[]) {
    result[key] = Math.max(0, result[key] - 1);
  }
  return result;
}
