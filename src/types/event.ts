import type { LayerTrace } from './layer';

export type EventLayer = 'deterministic' | 'probabilistic' | 'chain';

export type EventType =
  | 'probationConversion'
  | 'salaryNegotiation'
  | 'deadlineApproaching'
  | 'projectCompleted'
  | 'projectFailed'
  | 'employeeQuit'
  | 'capitalCrisis'
  | 'salaryDeducted'
  | 'generic';

export interface EventChoice {
  label: string;
  effect: string; // 효과 설명 (실제 적용은 resolveEvent에서 처리)
}

export interface PendingEvent {
  id: string;
  type: EventType;
  layer: EventLayer;
  title: string;
  description: string;
  choices: EventChoice[];
  targetId?: string; // 관련 직원/프로젝트 ID
}

export interface LogEntry {
  id?: string;
  turn: number;
  layer: EventLayer;
  message: string;
  timestamp: number;
  source?: string;
  layerTrace?: LayerTrace;
}
