import type {
  Employee,
  Role,
} from '../../types/employee';
import type { CommonStats, DesignerStats, DeveloperStats, PmStats, SpecialistStats } from '../../types/employee';
import type { IdGenerator, RandomSource } from '../generation';
import { MathRandomSource, TimestampIdGenerator } from '../generation';

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'] as const;
const GIVEN_NAMES = ['민준', '서윤', '도현', '지우', '수빈', '하은', '예진', '준서', '민서', '채원', '시우', '유나', '지훈', '소연', '재원', '나은', '성민', '하늘', '태영', '보람'] as const;

const SALARY_RANGES: Record<Role, [number, number]> = {
  developer: [3000, 5500],
  designer: [2800, 5000],
  pm: [3000, 5500],
};

export class EmployeeFactory {
  private readonly random: RandomSource;
  private readonly ids: IdGenerator;

  constructor(
    random: RandomSource = new MathRandomSource(),
    ids: IdGenerator = new TimestampIdGenerator(),
  ) {
    this.random = random;
    this.ids = ids;
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
    return {
      stamina: this.random.nextInt(-1, 3),
      communication: this.random.nextInt(-1, 3),
      mental: this.random.nextInt(-1, 3),
      growthRate: this.random.nextInt(0, 3),
      loyalty: this.random.nextInt(0, 3),
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
    return {
      codingSpeed: this.random.nextInt(base, max),
      codeQuality: this.random.nextInt(base, max),
      problemSolving: this.random.nextInt(base, max),
      techBreadth: this.random.nextInt(Math.max(1, base - 1), max),
      securitySense: this.random.nextInt(Math.max(1, base - 1), max),
    };
  }

  private generateDesignerStats(tier: number): DesignerStats {
    const base = 2 + tier;
    const max = 4 + tier;
    return {
      uiSense: this.random.nextInt(base, max),
      uxThinking: this.random.nextInt(base, max),
      workSpeed: this.random.nextInt(base, max),
      brandingSense: this.random.nextInt(Math.max(1, base - 1), max),
      prototyping: this.random.nextInt(Math.max(1, base - 1), max),
    };
  }

  private generatePmStats(tier: number): PmStats {
    const base = 2 + tier;
    const max = 4 + tier;
    return {
      scheduleManagement: this.random.nextInt(base, max),
      requirementAnalysis: this.random.nextInt(base, max),
      riskDetection: this.random.nextInt(Math.max(1, base - 1), max),
      clientManagement: this.random.nextInt(base, max),
      teamCoordination: this.random.nextInt(Math.max(1, base - 1), max),
    };
  }
}

export const defaultEmployeeFactory = new EmployeeFactory();
