import type { Phase } from './core';

export interface FunctionExecutionLogEntry {
  id: string;
  functionName: string;
  turn: number | null;
  phase: Phase | null;
  timestamp: number;
  detail?: string;
}
