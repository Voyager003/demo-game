import type { Phase } from '../types/core';
import type { FunctionExecutionLogEntry } from '../types/debug';
import type { EventLayer, LogEntry } from '../types/event';
import type { LayerKind, LayerTrace } from '../types/layer';

const DEFAULT_LAYER_NOTE =
  '공통 레이어 modifier 모델로 계산된 결과입니다.';

let eventLogSequence = 0;

function createLogId(prefix: string, sequence: number): string {
  return `${prefix}_${Date.now()}_${sequence}`;
}

export type LayerTraceInput = Omit<LayerTrace, 'layer' | 'note'> & {
  layer?: LayerKind;
  note?: string;
};

export function createLayerTrace(
  trace: LayerTraceInput,
  fallbackLayer: EventLayer = 'deterministic',
): LayerTrace {
  return {
    ...trace,
    layer: trace.layer ?? toTraceLayer(fallbackLayer),
    note: trace.note ?? DEFAULT_LAYER_NOTE,
  };
}

export function createEventLog({
  turn,
  message,
  layer = 'deterministic',
  source,
  layerTrace,
}: {
  turn: number;
  message: string;
  layer?: EventLayer;
  source?: string;
  layerTrace?: LayerTraceInput;
}): LogEntry {
  return {
    id: createLogId('evtlog', eventLogSequence++),
    turn,
    layer,
    message,
    timestamp: Date.now(),
    source,
    layerTrace: layerTrace
      ? createLayerTrace(layerTrace, layer)
      : undefined,
  };
}

function toTraceLayer(layer: EventLayer): LayerKind {
  return layer === 'probabilistic' ? 'probabilistic' : 'deterministic';
}

export function createFunctionLog({
  functionName,
  turn,
  phase,
  sequence,
  detail,
}: {
  functionName: string;
  turn: number | null;
  phase: Phase | null;

  sequence: number;
  detail?: string;
}): FunctionExecutionLogEntry {
  return {
    id: createLogId('fn', sequence),
    functionName,
    turn,
    phase,
    timestamp: Date.now(),
    detail,
  };
}
