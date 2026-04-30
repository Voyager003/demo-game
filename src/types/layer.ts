export type LayerKind = 'deterministic' | 'probabilistic';

export type GameMetricKey =
  | 'project.progressPerTurn'
  | 'project.clientSatisfaction'
  | 'economy.recurringRevenue';

export type ProbabilityMetricKey =
  | 'probability.projectDelay'
  | 'probability.projectRework'
  | 'probability.employeeBurnout'
  | 'probability.employeeQuit'
  | 'probability.serviceOutage'
  | 'probability.investmentSuccess'
  | 'probability.teamConflict';

export type LayerMetricKey = GameMetricKey | ProbabilityMetricKey;

export type LayerEffectOperation = 'add' | 'percent' | 'set';

export interface LayerEffect {
  layer: LayerKind;
  metric: LayerMetricKey;
  operation: LayerEffectOperation;
  value: number;
  reason: string;
  sourceRuleId: string;
  targetId?: string;
  sourceName?: string;
}

export interface LayerTrace {
  layer: LayerKind;
  rule: string;
  trigger: string;
  inputs: string[];
  effects: string[];
  note: string;
  finalValue?: string;
}
