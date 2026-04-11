import type { Project } from '../types/project';
import type { Employee, DeveloperStats } from '../types/employee';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isDeveloperStats(stats: Employee['specialistStats']): stats is DeveloperStats {
  return 'codingSpeed' in stats;
}

// ─── 턴당 진척도 계산 ─────────────────────────────────────────
export function calcProgressPerTurn(
  project: Project,
  assignedEmployees: Employee[],
  teamChemistry: number,
  ceoTechUnderstanding: number,
  hasCTO: boolean,
): number {
  const developers = assignedEmployees.filter(
    (e) => e.role === 'developer' && isDeveloperStats(e.specialistStats),
  );
  const hasPM = assignedEmployees.some((e) => e.role === 'pm');

  if (developers.length === 0) return 0;

  // 기본 기여도: 개발자 스탯 합산
  const rawStat = developers.reduce((sum, d) => {
    const stats = d.specialistStats as DeveloperStats;
    return sum + stats.codingSpeed + stats.problemSolving;
  }, 0);

  // 대표 기술 이해도 보너스 (CTO 없을 때만)
  const techBonus = !hasCTO ? ceoTechUnderstanding / 100 : 0;

  // 팀 케미 보너스 (-0.5 ~ +0.5)
  const chemBonus = (teamChemistry - 50) / 100;

  // PM 부재 패널티
  const pmMultiplier = hasPM ? 1.0 : 0.85;

  // 수습 직원 패널티
  const probationMultiplier = developers.reduce((mult, d) => {
    return d.probationTurnsLeft > 0 ? mult * 0.775 : mult;
  }, 1.0);

  // 특성 모디파이어 적용
  const traitMultiplier = calcTraitModifier(developers, project);

  const progress =
    rawStat *
    (1 + techBonus + chemBonus) *
    pmMultiplier *
    probationMultiplier *
    traitMultiplier;

  return Math.max(0, progress);
}

// ─── 특성 모디파이어 ──────────────────────────────────────────
function calcTraitModifier(developers: Employee[], project: Project): number {
  let multiplier = 1.0;
  const progressRatio = project.turnsElapsed / Math.max(1, project.turnsRequired);
  const turnsRemaining = project.turnsRequired - project.turnsElapsed;

  for (const dev of developers) {
    for (const trait of dev.traits) {
      if (trait.disclosureState === 'hidden') continue;

      switch (trait.key) {
        case 'sprinter':
          if (progressRatio < 0.5) multiplier *= 1.2;
          else if (progressRatio > 0.7) multiplier *= 0.8;
          break;
        case 'marathoner':
          if (progressRatio < 0.3) multiplier *= 0.85;
          else if (progressRatio > 0.5) multiplier *= 1.1;
          break;
        case 'speedFirst':
          multiplier *= 1.1; // codingSpeed 효과만 반영
          break;
        case 'perfectionist':
          multiplier *= 0.9;
          break;
        case 'deadlineMiracle':
          if (turnsRemaining <= 2) multiplier *= 1.5;
          else multiplier *= 0.6;
          break;
        default:
          break;
      }
    }
  }

  return Math.max(0.1, multiplier);
}

// ─── 고객 만족도 계산 ─────────────────────────────────────────
export function calcClientSatisfaction(
  project: Project,
  assignedEmployees: Employee[],
): number {
  const developers = assignedEmployees.filter(
    (e) => e.role === 'developer' && isDeveloperStats(e.specialistStats),
  );
  const pm = assignedEmployees.find((e) => e.role === 'pm');

  const avgCodeQuality =
    developers.length > 0
      ? developers.reduce((sum, d) => {
          const stats = d.specialistStats as DeveloperStats;
          return sum + stats.codeQuality;
        }, 0) / developers.length
      : 0;

  const pmBonus = pm ? (pm.specialistStats as { requirementAnalysis: number }).requirementAnalysis * 2 : 0;
  const onTimeBonus = project.turnsElapsed <= project.turnsRequired ? 10 : -15;

  // perfectionist 특성 보너스
  const perfectionistBonus = assignedEmployees.some((e) =>
    e.traits.some((t) => t.key === 'perfectionist' && t.disclosureState !== 'hidden'),
  )
    ? 10
    : 0;

  // speedFirst 특성 페널티 (CodeQuality 감소 시뮬레이션)
  const speedFirstPenalty = assignedEmployees.some((e) =>
    e.traits.some((t) => t.key === 'speedFirst' && t.disclosureState !== 'hidden'),
  )
    ? -5
    : 0;

  const base = 50 + avgCodeQuality * 3 + pmBonus + onTimeBonus + perfectionistBonus + speedFirstPenalty;
  return clamp(Math.round(base), 0, 100);
}

// ─── 프로젝트 납품 처리 ───────────────────────────────────────
export function deliverProject(
  project: Project,
  assignedEmployees: Employee[],
): Project {
  const satisfaction = calcClientSatisfaction(project, assignedEmployees);
  return {
    ...project,
    status: 'completed',
    clientSatisfaction: satisfaction,
  };
}

// ─── 프로젝트 실패 판정 ───────────────────────────────────────
// 직원 없는 상태로 3턴 초과하면 실패
export function checkProjectFailure(project: Project): boolean {
  if (project.assignedEmployeeIds.length === 0) {
    return project.turnsElapsed > project.turnsRequired + 3;
  }
  return false;
}
