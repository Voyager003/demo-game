import type {
  CommonStats,
  DesignerStats,
  DeveloperStats,
  Employee,
  PmStats,
  Role,
  SpecialistStats,
} from '../types/employee';

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'];
const GIVEN_NAMES = ['민준', '서윤', '도현', '지우', '수빈', '하은', '예진', '준서', '민서', '채원', '시우', '유나', '지훈', '소연', '재원', '나은', '성민', '하늘', '태영', '보람'];

const SALARY_RANGES: Record<Role, [number, number]> = {
  developer: [3000, 5500],
  designer: [2800, 5000],
  pm: [3000, 5500],
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function generateName(): string {
  return randFrom(SURNAMES) + randFrom(GIVEN_NAMES);
}

function generateCommonStats(): CommonStats {
  return {
    stamina: randInt(-1, 3),
    communication: randInt(-1, 3),
    mental: randInt(-1, 3),
    growthRate: randInt(0, 3),
    loyalty: randInt(0, 3),
  };
}

function generateDeveloperStats(tier: number): DeveloperStats {
  const base = 2 + tier;
  const max = 4 + tier;
  return {
    codingSpeed: randInt(base, max),
    codeQuality: randInt(base, max),
    problemSolving: randInt(base, max),
    techBreadth: randInt(Math.max(1, base - 1), max),
    securitySense: randInt(Math.max(1, base - 1), max),
  };
}

function generateDesignerStats(tier: number): DesignerStats {
  const base = 2 + tier;
  const max = 4 + tier;
  return {
    uiSense: randInt(base, max),
    uxThinking: randInt(base, max),
    workSpeed: randInt(base, max),
    brandingSense: randInt(Math.max(1, base - 1), max),
    prototyping: randInt(Math.max(1, base - 1), max),
  };
}

function generatePmStats(tier: number): PmStats {
  const base = 2 + tier;
  const max = 4 + tier;
  return {
    scheduleManagement: randInt(base, max),
    requirementAnalysis: randInt(base, max),
    riskDetection: randInt(Math.max(1, base - 1), max),
    clientManagement: randInt(base, max),
    teamCoordination: randInt(Math.max(1, base - 1), max),
  };
}

function generateSpecialistStats(role: Role, tier: number): SpecialistStats {
  if (role === 'developer') return generateDeveloperStats(tier);
  if (role === 'designer') return generateDesignerStats(tier);
  return generatePmStats(tier);
}

function createCandidate(role: Role, tier: number, currentTurn: number): Employee {
  const salaryRange = SALARY_RANGES[role];
  return {
    id: generateId(),
    name: generateName(),
    role,
    employmentType: 'regular',
    probationTurnsLeft: 12,
    specialistStats: generateSpecialistStats(role, tier),
    commonStats: generateCommonStats(),
    salary: randInt(salaryRange[0], salaryRange[1]),
    hp: 100,
    maxConcurrentProjects: randInt(1, 3),
    projectAssignments: {},
    hiredOnTurn: currentTurn,
  };
}

export class StaffMember {
  protected readonly snapshot: Employee;

  constructor(snapshot: Employee) {
    this.snapshot = { ...snapshot, projectAssignments: { ...snapshot.projectAssignments } };
  }

  specialistAverage(): number {
    return average(Object.values(this.snapshot.specialistStats));
  }

  weeklyContribution(): number {
    const common = this.snapshot.commonStats;
    const commonMultiplier = 1 + (common.stamina + common.communication + common.mental) / 100;
    const probationMultiplier = this.snapshot.probationTurnsLeft > 0 ? 0.8 : 1;
    return Math.max(0, this.specialistAverage() * commonMultiplier * probationMultiplier);
  }

  specialistTotal(): number {
    return Object.values(this.snapshot.specialistStats).reduce((sum, value) => sum + value, 0);
  }

  tickWeek(): Employee {
    if (this.snapshot.probationTurnsLeft <= 0) return this.toSnapshot();
    return { ...this.toSnapshot(), probationTurnsLeft: this.snapshot.probationTurnsLeft - 1 };
  }

  applyOvertime(): Employee {
    const stamina = this.snapshot.commonStats.stamina;
    const damage = Math.max(4, 12 - stamina * 2);
    return { ...this.toSnapshot(), hp: clamp(this.snapshot.hp - damage, 0, 100) };
  }

  assignToProject(projectId: string, percentage: number): Employee {
    const projectAssignments = { ...this.snapshot.projectAssignments };
    if (percentage > 0) projectAssignments[projectId] = percentage;
    else delete projectAssignments[projectId];
    return { ...this.toSnapshot(), projectAssignments };
  }

  toSnapshot(): Employee {
    return { ...this.snapshot, projectAssignments: { ...this.snapshot.projectAssignments } };
  }
}

export class Developer extends StaffMember {
  specialistAverage(): number {
    const stats = this.snapshot.specialistStats as DeveloperStats;
    return average([
      stats.codingSpeed,
      stats.codeQuality,
      stats.problemSolving,
      stats.techBreadth,
      stats.securitySense,
    ]);
  }
}

export class Designer extends StaffMember {
  specialistAverage(): number {
    const stats = this.snapshot.specialistStats as DesignerStats;
    return average([
      stats.uiSense,
      stats.uxThinking,
      stats.workSpeed,
      stats.brandingSense,
      stats.prototyping,
    ]);
  }
}

export class ProjectManager extends StaffMember {
  specialistAverage(): number {
    const stats = this.snapshot.specialistStats as PmStats;
    return average([
      stats.scheduleManagement,
      stats.requirementAnalysis,
      stats.riskDetection,
      stats.clientManagement,
      stats.teamCoordination,
    ]);
  }
}

export function createStaffMember(employee: Employee): StaffMember {
  if (employee.role === 'developer') return new Developer(employee);
  if (employee.role === 'designer') return new Designer(employee);
  return new ProjectManager(employee);
}

export function createFounder(foundingMember: Employee): Employee {
  return {
    ...foundingMember,
    probationTurnsLeft: -1,
    hiredOnTurn: 1,
    commonStats: {
      ...foundingMember.commonStats,
      loyalty: Math.min(5, foundingMember.commonStats.loyalty + 2),
    },
    projectAssignments: {},
  };
}

export function employeeSpecialistTotal(employee: Employee): number {
  return createStaffMember(employee).specialistTotal();
}

export function employeeWeeklyContribution(employee: Employee): number {
  return createStaffMember(employee).weeklyContribution();
}

export class EmployeeRoster {
  private readonly employees: Employee[];

  constructor(employees: Employee[]) {
    this.employees = employees.map((employee) => ({ ...employee, projectAssignments: { ...employee.projectAssignments } }));
  }

  static generateResumes(count: number, reputation: number, currentTurn: number): Employee[] {
    const tier = Math.min(3, Math.floor(reputation / 30));
    const roles: Role[] = ['developer', 'developer', 'developer', 'designer', 'pm'];
    return Array.from({ length: count }, () => createCandidate(randFrom(roles), tier, currentTurn));
  }

  static generateFoundingCandidates(count: number, reputation: number, currentTurn: number): Employee[] {
    const tier = Math.min(3, Math.floor(reputation / 30));
    return Array.from({ length: count }, () => createCandidate('developer', tier, currentTurn));
  }

  add(employee: Employee): EmployeeRoster {
    return new EmployeeRoster([...this.employees, employee]);
  }

  remove(employeeId: string): EmployeeRoster {
    return new EmployeeRoster(
      this.employees
        .filter((employee) => employee.id !== employeeId)
        .map((employee) => ({
          ...employee,
          projectAssignments: Object.fromEntries(
            Object.entries(employee.projectAssignments),
          ),
        })),
    );
  }

  setProjectAssignments(projectId: string, employeeIds: string[]): EmployeeRoster {
    const assigned = new Set(employeeIds);
    return new EmployeeRoster(
      this.employees.map((employee) =>
        createStaffMember(employee).assignToProject(
          projectId,
          assigned.has(employee.id) ? 100 : 0,
        ),
      ),
    );
  }

  removeProjectAssignment(projectId: string): EmployeeRoster {
    return new EmployeeRoster(
      this.employees.map((employee) =>
        createStaffMember(employee).assignToProject(projectId, 0),
      ),
    );
  }

  tickWeek(): EmployeeRoster {
    return new EmployeeRoster(
      this.employees.map((employee) => createStaffMember(employee).tickWeek()),
    );
  }

  applyOvertime(employeeIds: string[]): EmployeeRoster {
    const targets = new Set(employeeIds);
    return new EmployeeRoster(
      this.employees.map((employee) =>
        targets.has(employee.id)
          ? createStaffMember(employee).applyOvertime()
          : employee,
      ),
    );
  }

  toSnapshots(): Employee[] {
    return this.employees.map((employee) => ({ ...employee, projectAssignments: { ...employee.projectAssignments } }));
  }
}

