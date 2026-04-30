import type { ActionType } from '../types/core';

export interface ActionRule {
  fatigue: number;
  cooldown: number;
}

export const ACTION_RULES: Record<ActionType, ActionRule> = {
  postJobListing: { fatigue: 3, cooldown: 2 },
  conductInterview: { fatigue: 2, cooldown: 0 },
  fireEmployee: { fatigue: 2, cooldown: 1 },
  adjustSalary: { fatigue: 1, cooldown: 4 },
  signContract: { fatigue: 3, cooldown: 0 },
  changeAssignment: { fatigue: 1, cooldown: 0 },
  orderOvertime: { fatigue: 2, cooldown: 1 },
  startInvestmentRound: { fatigue: 4, cooldown: 6 },
};

const MAX_FATIGUE_BY_LEADERSHIP: Record<number, number> = {
  1: 6,
  2: 7,
  3: 8,
  4: 9,
  5: 10,
  6: 12,
  7: 14,
  8: 16,
  9: 18,
  10: 20,
};

export function maxFatigueForLeadership(leadership: number): number {
  const clamped = Math.max(1, Math.min(10, Math.round(leadership)));
  return MAX_FATIGUE_BY_LEADERSHIP[clamped] ?? 8;
}
