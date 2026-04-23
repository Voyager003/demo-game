import { BaseSimulationLayer } from './base-simulation-layer';
import type { LayerEffect, ProbabilityMetricKey } from '../../types/layer';

export interface ProbabilisticLayerContext {
  metric?: ProbabilityMetricKey;
}

export interface ProbabilisticLayerResolution {
  effects: LayerEffect[];
}

export class ProbabilisticLayer extends BaseSimulationLayer<
  ProbabilisticLayerContext,
  ProbabilisticLayerResolution
> {
  readonly kind = 'probabilistic' as const;

  evaluate(): LayerEffect[] {
    return [];
  }

  resolve(): ProbabilisticLayerResolution {
    return {
      effects: [],
    };
  }
}

export const probabilisticLayer = new ProbabilisticLayer();
