import type { ChemistryEntry } from '../types/trait';

// 충돌(음수) + 시너지(양수) 매트릭스
// 동일 쌍은 한 방향으로만 등록 (A→B, B→A 모두 처리는 engine에서)
export const TRAIT_CHEMISTRY_MATRIX: ChemistryEntry[] = [
  // ─── 충돌 ───
  { traitA: 'perfectionist',    traitB: 'speedFirst',       delta: -8 },
  { traitA: 'leaderComplex',    traitB: 'leaderComplex',    delta: -8 },
  { traitA: 'overtimeMaster',   traitB: 'workLifeBalance',  delta: -6 },
  { traitA: 'gossiper',         traitB: 'sensitiveEgo',     delta: -6 },
  { traitA: 'leaderComplex',    traitB: 'caringLeader',     delta: -7 },
  { traitA: 'caringLeader',     traitB: 'cynic',            delta: -5 },
  { traitA: 'perfectionist',    traitB: 'deadlineMiracle',  delta: -4 },
  { traitA: 'sprinter',         traitB: 'marathoner',       delta: -3 },
  { traitA: 'leaderComplex',    traitB: 'selfLearner',      delta: -3 },
  { traitA: 'gossiper',         traitB: 'soloLuncher',      delta: -3 },

  // ─── 시너지 ───
  { traitA: 'naturalMentor',    traitB: 'hiddenPotential',  delta: 10 },
  { traitA: 'naturalMentor',    traitB: 'selfLearner',      delta:  7 },
  { traitA: 'conferenceAddict', traitB: 'selfLearner',      delta:  6 },
  { traitA: 'recreationMaster', traitB: 'gatheringInitiator', delta: 6 },
  { traitA: 'perfectionist',    traitB: 'perfectionist',    delta:  5 },
  { traitA: 'caringLeader',     traitB: 'burnoutProne',     delta:  5 },
  { traitA: 'marathoner',       traitB: 'selfLearner',      delta:  4 },
  { traitA: 'workLifeBalance',  traitB: 'soloLuncher',      delta:  4 },
  { traitA: 'overtimeMaster',   traitB: 'deadlineMiracle',  delta:  4 },
  { traitA: 'caringLeader',     traitB: 'hiddenPotential',  delta:  3 },
  { traitA: 'naturalMentor',    traitB: 'lowCeiling',       delta:  3 },
  { traitA: 'sprinter',         traitB: 'deadlineMiracle',  delta:  3 },
];
