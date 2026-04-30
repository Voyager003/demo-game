import type { Employee } from '../types/employee';
import type {
  TraitCategory,
  TraitHint,
  TraitId,
  TraitProfile,
  TraitRevealTriggerType,
  TraitUnlockRecord,
} from '../types/trait';
import type { RandomSource } from './generation';

export interface TraitDefinition {
  id: TraitId;
  category: TraitCategory;
  label: string;
  description: string;
  deterministicImpact: string[];
  revealHints: string[];
}

export const TRAIT_DEFINITIONS: Record<TraitId, TraitDefinition> = {
  Sprinter: {
    id: 'Sprinter',
    category: 'workStyle',
    label: '스프린터',
    description: '프로젝트 초반에는 빠르게 치고 나가지만 후반 집중력은 떨어집니다.',
    deterministicImpact: ['프로젝트 초반 진척도 보정', '프로젝트 후반 진척도 페널티'],
    revealHints: ['초반 돌파력이 강한 스타일 같다.'],
  },
  Perfectionist: {
    id: 'Perfectionist',
    category: 'workStyle',
    label: '완벽주의자',
    description: '속도를 희생해 산출물 품질을 끌어올립니다.',
    deterministicImpact: ['클라이언트 만족도 보정', '진척도 소폭 감소'],
    revealHints: ['품질과 디테일에 유난히 집착하는 경향이 있다.'],
  },
  OvertimeMaster: {
    id: 'OvertimeMaster',
    category: 'workStyle',
    label: '야근장인',
    description: '야근 상황에서 생산성 저하가 적지만 체력은 더 빠르게 닳습니다.',
    deterministicImpact: ['야근 진척도 유지', '야근 시 HP 추가 소모'],
    revealHints: ['압박이 걸리면 오히려 집중력이 올라가는 편이다.'],
  },
  CaringLeader: {
    id: 'CaringLeader',
    category: 'social',
    label: '배려형리더',
    description: '주변 사람들을 챙기며 팀 분위기를 안정시키지만 개인 생산성은 조금 낮습니다.',
    deterministicImpact: ['teamChem 상승', '개인 진척도 소폭 감소'],
    revealHints: ['주변 사람을 챙기는 태도가 자주 보인다.'],
  },
  Cynic: {
    id: 'Cynic',
    category: 'social',
    label: '냉소주의자',
    description: '실무 능력은 좋지만 신입 온보딩이나 팀 분위기를 깎을 수 있습니다.',
    deterministicImpact: ['개인 성과 보정', 'teamChem/갈등 확률 악화'],
    revealHints: ['협업 상황에서 다소 냉소적인 면이 감지된다.'],
  },
  SelfLearner: {
    id: 'SelfLearner',
    category: 'growth',
    label: '독학왕',
    description: '학습과 개선을 스스로 밀어붙이는 타입입니다.',
    deterministicImpact: ['성장속도 관련 보정', '프로젝트 완료 후 성장 해금 보정'],
    revealHints: ['스스로 공부해서 따라잡는 힘이 강해 보인다.'],
  },
  JobHopper: {
    id: 'JobHopper',
    category: 'risk',
    label: '이직욕구자',
    description: '충성도 기반이 약하고 불만이 쌓이면 더 쉽게 이탈합니다.',
    deterministicImpact: ['loyalty 기준선 악화', '이직 확률 상승'],
    revealHints: ['다른 기회를 꾸준히 탐색하는 기색이 있다.'],
  },
  BurnoutProne: {
    id: 'BurnoutProne',
    category: 'risk',
    label: '번아웃취약자',
    description: '체력이 무너지면 급격히 흔들릴 가능성이 큽니다.',
    deterministicImpact: ['번아웃 확률 상승', '저HP 상태 리스크 증가'],
    revealHints: ['무리한 상황에서 급격히 무너질 소지가 있다.'],
  },
};

const WORK_STYLE_TRAITS: TraitId[] = ['Sprinter', 'Perfectionist', 'OvertimeMaster'];
const SOCIAL_TRAITS: TraitId[] = ['CaringLeader', 'Cynic'];
const GROWTH_TRAITS: TraitId[] = ['SelfLearner'];
const RISK_TRAITS: TraitId[] = ['JobHopper', 'BurnoutProne'];
const RANDOM_TRAITS: TraitId[] = [...WORK_STYLE_TRAITS, ...SOCIAL_TRAITS, ...GROWTH_TRAITS, ...RISK_TRAITS];

function uniqueTraitIds(ids: TraitId[]): TraitId[] {
  return [...new Set(ids)];
}

export class TraitRegistry {
  private readonly random: RandomSource;

  constructor(random: RandomSource) {
    this.random = random;
  }

  createProfile(): TraitProfile {
    const traitIds = uniqueTraitIds([
      this.random.pick(WORK_STYLE_TRAITS),
      this.random.pick(SOCIAL_TRAITS),
      this.random.pick(RANDOM_TRAITS),
    ]).slice(0, 3);

    while (traitIds.length < 3) {
      traitIds.push(this.random.pick(RANDOM_TRAITS));
    }

    const primary = TRAIT_DEFINITIONS[traitIds[0]!]!;
    return {
      traitIds,
      reveal: {
        revealedTraitIds: [primary.id],
        hints: traitIds.slice(1).map((id) => this.createHint(id)),
        unlockHistory: [{
          traitId: primary.id,
          trigger: 'resume',
          turn: 0,
          note: '이력서 단계 공개',
        }],
      },
    };
  }

  createHint(traitId: TraitId): TraitHint {
    const definition = TRAIT_DEFINITIONS[traitId];
    return {
      category: definition.category,
      text: definition.revealHints[0] ?? definition.description,
    };
  }
}

function shouldReveal(traitId: TraitId, trigger: TraitRevealTriggerType): boolean {
  if (traitId === 'OvertimeMaster') return trigger === 'overtime';
  if (traitId === 'BurnoutProne') return trigger === 'lowHp' || trigger === 'overtime';
  if (traitId === 'Perfectionist' || traitId === 'Sprinter') return trigger === 'projectCompleted';
  if (traitId === 'SelfLearner') return trigger === 'projectCompleted' || trigger === 'supportEvent';
  if (traitId === 'JobHopper') return trigger === 'salaryNegotiation' || trigger === 'lowLoyalty';
  if (traitId === 'Cynic') return trigger === 'teamConflict';
  if (traitId === 'CaringLeader') return trigger === 'supportEvent';
  return false;
}

export interface TraitRevealResult {
  employee: Employee;
  unlocked: TraitUnlockRecord[];
}

export class TraitRevealPolicy {
  reveal(employee: Employee, trigger: TraitRevealTriggerType, turn: number, note: string): TraitRevealResult {
    const revealed = new Set(employee.traitProfile.reveal.revealedTraitIds);
    const unlocked: TraitUnlockRecord[] = [];

    for (const traitId of employee.traitProfile.traitIds) {
      if (revealed.has(traitId)) continue;
      if (!shouldReveal(traitId, trigger)) continue;
      revealed.add(traitId);
      unlocked.push({
        traitId,
        trigger,
        turn,
        note,
      });
    }

    if (unlocked.length === 0) {
      return { employee, unlocked };
    }

    const unlockedIds = new Set(unlocked.map((record) => record.traitId));
    return {
      employee: {
        ...employee,
        traitProfile: {
          ...employee.traitProfile,
          reveal: {
            revealedTraitIds: [...revealed],
            hints: employee.traitProfile.reveal.hints.filter((hint) =>
              !employee.traitProfile.traitIds.some((traitId) =>
                unlockedIds.has(traitId)
                && TRAIT_DEFINITIONS[traitId].category === hint.category
                && TRAIT_DEFINITIONS[traitId].revealHints[0] === hint.text,
              )),
            unlockHistory: [
              ...employee.traitProfile.reveal.unlockHistory,
              ...unlocked,
            ],
          },
        },
      },
      unlocked,
    };
  }
}

export function getTraitDefinition(traitId: TraitId): TraitDefinition {
  return TRAIT_DEFINITIONS[traitId];
}

export function getRevealedTraitDefinitions(profile: TraitProfile): TraitDefinition[] {
  return profile.reveal.revealedTraitIds.map((traitId) => TRAIT_DEFINITIONS[traitId]);
}

export function hasTrait(employee: Employee, traitId: TraitId): boolean {
  return employee.traitProfile?.traitIds?.includes(traitId) ?? false;
}

export function hasRevealedTrait(employee: Employee, traitId: TraitId): boolean {
  return employee.traitProfile?.reveal?.revealedTraitIds?.includes(traitId) ?? false;
}

export function formatUnlockedTraitLog(employee: Employee, record: TraitUnlockRecord): string {
  return `${employee.name}의 특성 해금: ${TRAIT_DEFINITIONS[record.traitId].label}`;
}
