import { BaseSimulationLayer, type MetricResolution } from './base-simulation-layer';
import type { LayerEffect, ProbabilityMetricKey } from '../../types/layer';

export interface ProbabilisticLayerContext {
  metric: ProbabilityMetricKey;
  baseProbability: number;
  effects: LayerEffect[];
  trace: {
    rule: string;
    trigger: string;
    inputs: string[];
    note?: string;
  };
}

export interface ProbabilisticLayerResolution {
  effects: LayerEffect[];
  probability?: MetricResolution<ProbabilityMetricKey>;
}

export class ProbabilisticLayer extends BaseSimulationLayer<
  ProbabilisticLayerContext,
  ProbabilisticLayerResolution
> {
  readonly kind = 'probabilistic' as const;

  evaluate(context: ProbabilisticLayerContext): LayerEffect[] {
    return context.effects;
  }

  resolve(context: ProbabilisticLayerContext): ProbabilisticLayerResolution {
    const effects = this.evaluate(context);
    return {
      effects,
      probability: this.aggregateMetric({
        metric: context.metric,
        baseValue: context.baseProbability,
        effects,
        min: 0.01,
        max: 0.95,
        precision: 3,
        trace: context.trace,
      }),
    };
  }
}

export const probabilisticLayer = new ProbabilisticLayer();
