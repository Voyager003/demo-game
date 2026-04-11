import { TRAIT_CHEMISTRY_MATRIX } from '../constants/traitChemistryMatrix';
import type { Employee } from '../types/employee';
import type { TraitKey } from '../types/trait';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── 쌍별 케미 계산 ───────────────────────────────────────────
export function calcPairwiseChemistry(empA: Employee, empB: Employee): number {
  let delta = 0;

  const revealedA = empA.traits
    .filter((t) => t.disclosureState !== 'hidden')
    .map((t) => t.key);
  const revealedB = empB.traits
    .filter((t) => t.disclosureState !== 'hidden')
    .map((t) => t.key);

  // 특성 충돌/시너지 계산
  for (const entry of TRAIT_CHEMISTRY_MATRIX) {
    const aHasA = revealedA.includes(entry.traitA as TraitKey);
    const aHasB = revealedA.includes(entry.traitB as TraitKey);
    const bHasA = revealedB.includes(entry.traitA as TraitKey);
    const bHasB = revealedB.includes(entry.traitB as TraitKey);

    if ((aHasA && bHasB) || (aHasB && bHasA)) {
      delta += entry.delta;
    }
    // 동일 특성 쌍 (e.g., leaderComplex ↔ leaderComplex)
    if (entry.traitA === entry.traitB && aHasA && bHasA) {
      delta += entry.delta;
    }
  }

  // 같은 직군: 경쟁 패널티
  if (empA.role === empB.role) delta -= 2;

  return clamp(delta, -50, 50);
}

// ─── 팀 케미 재계산 ───────────────────────────────────────────
export function recalcTeamChemistry(
  employees: Employee[],
  pairMap: Record<string, Record<string, number>>,
  leadership: number,
): number {
  if (employees.length <= 1) return 50;

  const pairs: number[] = [];
  for (let i = 0; i < employees.length; i++) {
    for (let j = i + 1; j < employees.length; j++) {
      const a = employees[i];
      const b = employees[j];
      const val = pairMap[a.id]?.[b.id] ?? pairMap[b.id]?.[a.id] ?? 0;
      pairs.push(val);
    }
  }

  if (pairs.length === 0) return 50;

  const avgPair = pairs.reduce((s, v) => s + v, 0) / pairs.length;
  // 리더십 안정화 보너스 (최대 +2)
  const leaderStabilizer = Math.min(leadership, 4) * 0.5;

  return clamp(Math.round(50 + avgPair + leaderStabilizer), 0, 100);
}

// ─── 공통 스탯 패시브 효과 반영 ──────────────────────────────
// Phase4에서 팀 케미 추가 조정
export function applyCommonStatChemistryEffects(
  teamChemistry: number,
  employees: Employee[],
): number {
  let delta = 0;
  for (const emp of employees) {
    const comm = emp.commonStats.communication;
    const ment = emp.commonStats.mental;
    if (comm === -1) delta -= 3;
    else if (comm === 0) delta -= 1;
    if (ment === -1) delta -= 2;
    else if (ment === 0) delta -= 1;
    if (emp.commonStats.loyalty === -1) delta -= 1;
  }
  return clamp(teamChemistry + delta, 0, 100);
}

// ─── 프로젝트 결과 반영 ──────────────────────────────────────
export function updateChemistryOnProjectResult(
  pairMap: Record<string, Record<string, number>>,
  assigneeIds: string[],
  success: boolean,
): Record<string, Record<string, number>> {
  const delta = success ? 5 : -5;
  const updated = { ...pairMap };

  for (let i = 0; i < assigneeIds.length; i++) {
    for (let j = i + 1; j < assigneeIds.length; j++) {
      const a = assigneeIds[i];
      const b = assigneeIds[j];
      if (!updated[a]) updated[a] = {};
      updated[a][b] = clamp((updated[a][b] ?? 0) + delta, -50, 50);
    }
  }
  return updated;
}

// ─── 쌍 케미 맵 초기화 ───────────────────────────────────────
export function buildPairChemistryMap(
  employees: Employee[],
): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (let i = 0; i < employees.length; i++) {
    for (let j = i + 1; j < employees.length; j++) {
      const a = employees[i];
      const b = employees[j];
      if (!map[a.id]) map[a.id] = {};
      map[a.id][b.id] = calcPairwiseChemistry(a, b);
    }
  }
  return map;
}
