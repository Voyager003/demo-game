export type TraitCategory = 'workStyle' | 'social' | 'growth' | 'risk';

export type TraitKey =
  // 업무 스타일 (7)
  | 'sprinter'
  | 'marathoner'
  | 'overtimeMaster'
  | 'workLifeBalance'
  | 'speedFirst'
  | 'perfectionist'
  | 'deadlineMiracle'
  // 사회성 (7)
  | 'recreationMaster'
  | 'soloLuncher'
  | 'gatheringInitiator'
  | 'gossiper'
  | 'caringLeader'
  | 'cynic'
  | 'leaderComplex'
  // 성장 (5)
  | 'selfLearner'
  | 'naturalMentor'
  | 'lowCeiling'
  | 'hiddenPotential'
  | 'conferenceAddict'
  // 리스크 (4)
  | 'jobHopper'
  | 'startupDreamer'
  | 'burnoutProne'
  | 'sensitiveEgo';

export type TraitDisclosureState =
  | 'hidden'         // 미공개
  | 'hinted'         // 힌트만 (이력서 단계)
  | 'categoryHint'   // 카테고리 힌트 (수습 4턴)
  | 'specificHint'   // 구체적 힌트 (수습 8턴)
  | 'revealed';      // 완전 공개 (수습 12턴)

export interface Trait {
  key: TraitKey;
  category: TraitCategory;
  disclosureState: TraitDisclosureState;
}

export interface ChemistryEntry {
  traitA: TraitKey;
  traitB: TraitKey;
  delta: number; // 음수=충돌, 양수=시너지
}
