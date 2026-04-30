import { getTraitDefinition } from '../domain/traits';
import type { TraitHint, TraitId } from '../types/trait';

export function getTraitGuide(traitId: TraitId) {
  const definition = getTraitDefinition(traitId);
  return {
    label: definition.label,
    description: definition.description,
    deterministicImpact: definition.deterministicImpact,
  };
}

export function getTraitHintLabel(hint: TraitHint): string {
  if (hint.category === 'workStyle') return '업무 스타일 잠재 특성';
  if (hint.category === 'social') return '사회성 잠재 특성';
  if (hint.category === 'growth') return '성장 잠재 특성';
  return '리스크 잠재 특성';
}
