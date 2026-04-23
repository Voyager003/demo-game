import type {
  GameMetricKey,
  LayerEffect,
  LayerKind,
  LayerMetricKey,
  LayerTrace,
} from '../../types/layer';

export interface LayerRule<TContext> {
  id: string;
  description: string;
  evaluate(context: TContext): LayerEffect[];
}

export interface MetricResolution<TMetric extends LayerMetricKey = GameMetricKey> {
  metric: TMetric;
  baseValue: number;
  addTotal: number;
  percentTotal: number;
  finalValue: number;
  effects: LayerEffect[];
  trace: LayerTrace;
}

interface MetricAggregationOptions<TMetric extends LayerMetricKey> {
  metric: TMetric;
  baseValue: number;
  effects: LayerEffect[];
  min?: number;
  max?: number;
  precision?: number;
  trace: Omit<LayerTrace, 'layer' | 'note' | 'effects' | 'finalValue'> & {
    note?: string;
  };
}

export abstract class BaseSimulationLayer<TContext, TResolution> {
  abstract readonly kind: LayerKind;

  abstract evaluate(context: TContext): LayerEffect[];

  abstract resolve(context: TContext): TResolution;

  protected aggregateMetric<TMetric extends LayerMetricKey>({
    metric,
    baseValue,
    effects,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    precision = 2,
    trace,
  }: MetricAggregationOptions<TMetric>): MetricResolution<TMetric> {
    const metricEffects = effects.filter((effect) => effect.metric === metric);
    const setEffects = metricEffects.filter((effect) => effect.operation === 'set');
    const effectiveBase =
      setEffects.length > 0 ? setEffects[setEffects.length - 1].value : baseValue;
    const addTotal = metricEffects
      .filter((effect) => effect.operation === 'add')
      .reduce((sum, effect) => sum + effect.value, 0);
    const percentTotal = metricEffects
      .filter((effect) => effect.operation === 'percent')
      .reduce((sum, effect) => sum + effect.value, 0);
    const rawValue = (effectiveBase + addTotal) * (1 + percentTotal);
    const finalValue = roundTo(clamp(rawValue, min, max), precision);

    return {
      metric,
      baseValue: effectiveBase,
      addTotal: roundTo(addTotal, precision),
      percentTotal: roundTo(percentTotal, 4),
      finalValue,
      effects: metricEffects,
      trace: {
        layer: this.kind,
        rule: trace.rule,
        trigger: trace.trigger,
        inputs: trace.inputs,
        effects: metricEffects.map(formatLayerEffect),
        note: trace.note ?? '공통 modifier 모델로 계산된 레이어 결과입니다.',
        finalValue: `${metric}: (${formatNumber(effectiveBase)} + ${formatNumber(addTotal)}) * (1 + ${formatPercent(percentTotal)}) = ${formatNumber(finalValue)}`,
      },
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, precision: number): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function formatLayerEffect(effect: LayerEffect): string {
  const value =
    effect.operation === 'percent'
      ? formatPercent(effect.value)
      : formatNumber(effect.value);
  return `${effect.reason}: ${effect.metric} ${effect.operation} ${value}`;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${Math.round(value * 1000) / 10}%`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
