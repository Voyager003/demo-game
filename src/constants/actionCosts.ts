import type { ActionType } from '../types/core';

interface ActionCost {
  fatigue: number;
  cooldown: number; // 쿨타임 턴 수 (0=쿨타임 없음)
}

export const ACTION_COSTS: Record<ActionType, ActionCost> = {
  postJobListing:   { fatigue: 3, cooldown: 2 },
  conductInterview: { fatigue: 2, cooldown: 0 },
  fireEmployee:     { fatigue: 2, cooldown: 1 },
  adjustSalary:     { fatigue: 1, cooldown: 4 },
  signContract:     { fatigue: 3, cooldown: 1 },
  changeAssignment: { fatigue: 1, cooldown: 0 },
  orderOvertime:    { fatigue: 2, cooldown: 1 },
};
