import { TRAIT_DEFINITIONS } from '../constants/traitDefinitions';
import type { Employee, Role, DeveloperStats, DesignerStats, PmStats, CommonStats } from '../types/employee';
import type { Trait } from '../types/trait';

// uuid 대신 간단한 ID 생성 (의존성 최소화)
function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── 직원 이름 생성 (한국식) ─────────────────────────────────
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'];
const GIVEN_NAMES = ['민준', '서윤', '도현', '지우', '수빈', '하은', '예진', '준서', '민서', '채원', '시우', '유나', '지훈', '소연', '재원', '나은', '성민', '하늘', '태영', '보람'];

function generateName(): string {
  return randFrom(SURNAMES) + randFrom(GIVEN_NAMES);
}

// ─── 연봉 범위 (만원/년) ─────────────────────────────────────
const SALARY_RANGES: Record<Role, [number, number]> = {
  developer: [3000, 5500],
  designer:  [2800, 5000],
  pm:        [3000, 5500],
};

// ─── 특성 생성 ────────────────────────────────────────────────
const WORK_STYLE_KEYS = Object.values(TRAIT_DEFINITIONS)
  .filter((d) => d.category === 'workStyle')
  .map((d) => d.key);

const SOCIAL_KEYS = Object.values(TRAIT_DEFINITIONS)
  .filter((d) => d.category === 'social')
  .map((d) => d.key);

const OTHER_KEYS = Object.values(TRAIT_DEFINITIONS)
  .filter((d) => d.category !== 'workStyle' && d.category !== 'social')
  .map((d) => d.key);

function generateTraits(): Trait[] {
  const workStyle = randFrom(WORK_STYLE_KEYS);
  const social = randFrom(SOCIAL_KEYS);
  const other = randFrom(OTHER_KEYS.filter((k) => k !== workStyle && k !== social));

  const keys = [workStyle, social, other];
  // 이력서에는 1개 완전 공개, 나머지 힌트
  return keys.map((key, i) => {
    const def = TRAIT_DEFINITIONS[key];
    return {
      key,
      category: def.category,
      disclosureState: i === 0 ? 'revealed' : 'hinted',
    } as Trait;
  });
}

// ─── 직군별 스탯 생성 ─────────────────────────────────────────
function generateDeveloperStats(tier: number): DeveloperStats {
  // tier 1~3 (명성에 따라 스탯 풀 상승)
  const base = 2 + tier;
  const max = 4 + tier;
  return {
    codingSpeed:    randInt(base, max),
    codeQuality:    randInt(base, max),
    problemSolving: randInt(base, max),
    techBreadth:    randInt(Math.max(1, base - 1), max),
    securitySense:  randInt(Math.max(1, base - 1), max),
  };
}

function generateDesignerStats(tier: number): DesignerStats {
  const base = 2 + tier;
  const max = 4 + tier;
  return {
    uiSense:       randInt(base, max),
    uxThinking:    randInt(base, max),
    workSpeed:     randInt(base, max),
    brandingSense: randInt(Math.max(1, base - 1), max),
    prototyping:   randInt(Math.max(1, base - 1), max),
  };
}

function generatePmStats(tier: number): PmStats {
  const base = 2 + tier;
  const max = 4 + tier;
  return {
    scheduleManagement: randInt(base, max),
    requirementAnalysis: randInt(base, max),
    riskDetection:      randInt(Math.max(1, base - 1), max),
    clientManagement:   randInt(base, max),
    teamCoordination:   randInt(Math.max(1, base - 1), max),
  };
}

function generateCommonStats(): CommonStats {
  return {
    stamina:       randInt(-1, 3),
    communication: randInt(-1, 3),
    mental:        randInt(-1, 3),
    growthRate:    randInt(0, 3),
    loyalty:       randInt(0, 3),
  };
}

// ─── 단일 직원 후보 생성 ──────────────────────────────────────
function generateCandidate(role: Role, tier: number, currentTurn: number): Employee {
  const specialistStats =
    role === 'developer'
      ? generateDeveloperStats(tier)
      : role === 'designer'
      ? generateDesignerStats(tier)
      : generatePmStats(tier);

  const salaryRange = SALARY_RANGES[role];
  const salary = randInt(salaryRange[0], salaryRange[1]);

  return {
    id: generateId(),
    name: generateName(),
    role,
    employmentType: 'regular',
    probationTurnsLeft: 12,
    specialistStats,
    commonStats: generateCommonStats(),
    traits: generateTraits(),
    salary,
    hp: 100,
    projectAssignments: {},
    hiredOnTurn: currentTurn,
  };
}

// ─── 이력서 풀 생성 ───────────────────────────────────────────
// reputation: 0~100. 높을수록 더 좋은 인재 풀
export function generateResumes(
  count: number,
  reputation: number,
  currentTurn: number,
): Employee[] {
  const tier = Math.min(3, Math.floor(reputation / 30)); // 0~3

  const roles: Role[] = ['developer', 'developer', 'developer', 'designer', 'pm'];
  const candidates: Employee[] = [];

  for (let i = 0; i < count; i++) {
    const role = randFrom(roles);
    candidates.push(generateCandidate(role, tier, currentTurn));
  }

  return candidates;
}

// ─── 창업 멤버 후보 생성 (항상 개발자 N명) ──────────────────────
export function generateFoundingCandidates(
  count: number,
  reputation: number,
  currentTurn: number,
): Employee[] {
  const tier = Math.min(3, Math.floor(reputation / 30));
  return Array.from({ length: count }, () =>
    generateCandidate('developer', tier, currentTurn),
  );
}

// ─── 수습 기간 중 특성 공개 처리 ─────────────────────────────
// probationTurnsLeft: 12→0 카운트다운 기준
// 12-4=8 (수습 4턴 경과), 12-8=4 (수습 8턴), 12-12=0 (수습 12턴)
export function revealTraits(employee: Employee): Employee {
  const turnsServed = 12 - employee.probationTurnsLeft;
  const updatedTraits: Trait[] = employee.traits.map((trait) => {
    if (trait.disclosureState === 'revealed') return trait;

    if (turnsServed >= 12) {
      return { ...trait, disclosureState: 'revealed' };
    } else if (turnsServed >= 8) {
      if (
        trait.disclosureState === 'hidden' ||
        trait.disclosureState === 'hinted' ||
        trait.disclosureState === 'categoryHint'
      ) {
        return { ...trait, disclosureState: 'specificHint' };
      }
    } else if (turnsServed >= 4) {
      if (
        trait.disclosureState === 'hidden' ||
        trait.disclosureState === 'hinted'
      ) {
        return { ...trait, disclosureState: 'categoryHint' };
      }
    }
    return trait;
  });

  return { ...employee, traits: updatedTraits };
}
