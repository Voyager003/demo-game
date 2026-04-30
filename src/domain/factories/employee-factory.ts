import type {
  Employee,
  Role,
} from '../../types/employee';
import type { CommonStats, DesignerStats, DeveloperStats, PmStats, SpecialistStats } from '../../types/employee';
import type { IdGenerator, RandomSource } from '../generation';
import { MathRandomSource, TimestampIdGenerator } from '../generation';
import { TraitRegistry } from '../traits';

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'] as const;
const GIVEN_NAMES = ['민준', '서윤', '도현', '지우', '수빈', '하은', '예진', '준서', '민서', '채원', '시우', '유나', '지훈', '소연', '재원', '나은', '성민', '하늘', '태영', '보람'] as const;

const SALARY_RANGES: Record<Role, [number, number]> = {
  developer: [3000, 5500],
  designer: [2800, 5000],
  pm: [3000, 5500],
};

const SPECIALIST_TOTAL_BY_TIER: Record<number, number> = {
  0: 15,
  1: 20,
  2: 25,
  3: 30,
};

const COMMON_TOTAL_BUDGET = 4;

export class EmployeeFactory {
  private readonly random: RandomSource;
  private readonly ids: IdGenerator;
  private readonly traitRegistry: TraitRegistry;

  constructor(
    random: RandomSource = new MathRandomSource(),
    ids: IdGenerator = new TimestampIdGenerator(),
  ) {
    this.random = random;
    this.ids = ids;
    this.traitRegistry = new TraitRegistry(random);
  }

  createCandidate(role: Role, tier: number, currentTurn: number): Employee {
    const salaryRange = SALARY_RANGES[role];
    return {
      id: this.ids.next(),
      name: this.generateName(),
      role,
      employmentType: 'regular',
      probationTurnsLeft: 12,
      specialistStats: this.generateSpecialistStats(role, tier),
      commonStats: this.generateCommonStats(),
      salary: this.random.nextInt(salaryRange[0], salaryRange[1]),
      hp: 100,
      maxConcurrentProjects: this.random.nextInt(1, 3),
      projectAssignments: {},
      hiredOnTurn: currentTurn,
      traitProfile: this.traitRegistry.createProfile(),
    };
  }

  generateResumes(count: number, reputation: number, currentTurn: number): Employee[] {
    const tier = this.tierForReputation(reputation);
    const roles: Role[] = ['developer', 'developer', 'developer', 'designer', 'pm'];
    return Array.from({ length: count }, () =>
      this.createCandidate(this.random.pick(roles), tier, currentTurn),
    );
  }

  generateFoundingCandidates(count: number, reputation: number, currentTurn: number): Employee[] {
    const tier = this.tierForReputation(reputation);
    return Array.from({ length: count }, () =>
      this.createCandidate('developer', tier, currentTurn),
    );
  }

  private tierForReputation(reputation: number): number {
    return Math.min(3, Math.floor(reputation / 30));
  }

  private generateName(): string {
    return `${this.random.pick(SURNAMES)}${this.random.pick(GIVEN_NAMES)}`;
  }

  private generateCommonStats(): CommonStats {
    const distributed = this.distributeStatBudget(
      {
        stamina: { min: -1, max: 3 },
        communication: { min: -1, max: 3 },
        mental: { min: -1, max: 3 },
        growthRate: { min: 0, max: 3 },
      },
      COMMON_TOTAL_BUDGET,
    );
    return {
      stamina: distributed.stamina,
      communication: distributed.communication,
      mental: distributed.mental,
      growthRate: distributed.growthRate,
      loyalty: 0,
    };
  }

  private generateSpecialistStats(role: Role, tier: number): SpecialistStats {
    if (role === 'developer') return this.generateDeveloperStats(tier);
    if (role === 'designer') return this.generateDesignerStats(tier);
    return this.generatePmStats(tier);
  }

  private generateDeveloperStats(tier: number): DeveloperStats {
    const base = 2 + tier;
    const max = 4 + tier;
    const distributed = this.distributeStatBudget(
      {
        codingSpeed: { min: base, max },
        codeQuality: { min: base, max },
        problemSolving: { min: base, max },
        techBreadth: { min: Math.max(1, base - 1), max },
        securitySense: { min: Math.max(1, base - 1), max },
      },
      SPECIALIST_TOTAL_BY_TIER[tier] ?? SPECIALIST_TOTAL_BY_TIER[3],
    );
    return distributed;
  }

  private generateDesignerStats(tier: number): DesignerStats {
    const base = 2 + tier;
    const max = 4 + tier;
    const distributed = this.distributeStatBudget(
      {
        uiSense: { min: base, max },
        uxThinking: { min: base, max },
        workSpeed: { min: base, max },
        brandingSense: { min: Math.max(1, base - 1), max },
        prototyping: { min: Math.max(1, base - 1), max },
      },
      SPECIALIST_TOTAL_BY_TIER[tier] ?? SPECIALIST_TOTAL_BY_TIER[3],
    );
    return distributed;
  }

  private generatePmStats(tier: number): PmStats {
    const base = 2 + tier;
    const max = 4 + tier;
    const distributed = this.distributeStatBudget(
      {
        scheduleManagement: { min: base, max },
        requirementAnalysis: { min: base, max },
        riskDetection: { min: Math.max(1, base - 1), max },
        clientManagement: { min: base, max },
        teamCoordination: { min: Math.max(1, base - 1), max },
      },
      SPECIALIST_TOTAL_BY_TIER[tier] ?? SPECIALIST_TOTAL_BY_TIER[3],
    );
    return distributed;
  }

  private distributeStatBudget<T extends string>(
    bounds: Record<T, { min: number; max: number }>,
    targetTotal: number,
  ): Record<T, number> {
    const keys = Object.keys(bounds) as T[];
    const values = Object.fromEntries(
      keys.map((key) => [key, bounds[key].min]),
    ) as Record<T, number>;
    let remaining = targetTotal - keys.reduce((sum, key) => sum + bounds[key].min, 0);

    while (remaining > 0) {
      const candidates = keys.filter((key) => values[key] < bounds[key].max);
      if (candidates.length === 0) break;
      const key = this.random.pick(candidates);
      values[key] += 1;
      remaining -= 1;
    }

    return values;
  }
}

export const defaultEmployeeFactory = new EmployeeFactory();
