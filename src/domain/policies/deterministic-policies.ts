import type {
  CommonStats,
  DesignerStats,
  DeveloperStats,
  Employee,
  PmStats,
  Role,
} from '../../types/employee';
import type { LayerEffect } from '../../types/layer';
import type { Project } from '../../types/project';

const PROGRESS_METRIC = 'project.progressPerTurn' as const;
const SATISFACTION_METRIC = 'project.clientSatisfaction' as const;
const RECURRING_REVENUE_METRIC = 'economy.recurringRevenue' as const;

type SpecialistWeights = Partial<
  Record<keyof DeveloperStats | keyof DesignerStats | keyof PmStats, number>
>;

const PROJECT_PROGRESS_SPECIALIST_WEIGHTS: Record<Role, SpecialistWeights> = {
  developer: {
    codingSpeed: 1.6,
    problemSolving: 1.0,
    techBreadth: 0.8,
    codeQuality: 0.4,
  },
  designer: {
    workSpeed: 1.4,
    prototyping: 1.0,
    uxThinking: 0.9,
    uiSense: 0.5,
    brandingSense: 0.2,
  },
  pm: {},
};

const PROJECT_SATISFACTION_SPECIALIST_WEIGHTS: Record<Role, SpecialistWeights> = {
  developer: {
    codeQuality: 1.2,
    problemSolving: 0.8,
    securitySense: 0.6,
    techBreadth: 0.4,
    codingSpeed: 0.2,
  },
  designer: {
    uiSense: 1.0,
    uxThinking: 1.0,
    brandingSense: 0.8,
    prototyping: 0.4,
    workSpeed: 0.2,
  },
  pm: {
    clientManagement: 0.8,
    requirementAnalysis: 0.7,
    riskDetection: 0.5,
    teamCoordination: 0.4,
    scheduleManagement: 0.2,
  },
};

const MAIN_REVENUE_SPECIALIST_WEIGHTS: Record<Role, SpecialistWeights> = {
  developer: {
    codingSpeed: 0.008,
    codeQuality: 0.012,
    problemSolving: 0.01,
    techBreadth: 0.008,
    securitySense: 0.012,
  },
  designer: {
    uiSense: 0.012,
    uxThinking: 0.012,
    workSpeed: 0.008,
    brandingSense: 0.012,
    prototyping: 0.008,
  },
  pm: {
    scheduleManagement: 0.01,
    requirementAnalysis: 0.012,
    riskDetection: 0.01,
    clientManagement: 0.012,
    teamCoordination: 0.012,
  },
};

const PROJECT_COMMON_WEIGHTS: Record<keyof CommonStats, number> = {
  stamina: 0.03,
  communication: 0.02,
  mental: 0.02,
  growthRate: 0.015,
  loyalty: 0.015,
};

const MAIN_REVENUE_COMMON_WEIGHTS: Record<keyof CommonStats, number> = {
  stamina: 0.01,
  communication: 0.015,
  mental: 0.01,
  growthRate: 0.0075,
  loyalty: 0.0075,
};

const PM_PROGRESS_SUPPORT_WEIGHTS: Partial<Record<keyof PmStats, number>> = {
  scheduleManagement: 0.012,
  teamCoordination: 0.012,
  riskDetection: 0.008,
  requirementAnalysis: 0.006,
  clientManagement: 0.004,
};

const ROLE_LABELS: Record<Role, string> = {
  developer: '개발자',
  designer: '디자이너',
  pm: 'PM',
};

const STAT_LABELS: Record<string, string> = {
  codingSpeed: '구현속도',
  codeQuality: '코드품질',
  problemSolving: '문제해결력',
  techBreadth: '기술폭',
  securitySense: '보안감각',
  uiSense: 'UI감각',
  uxThinking: 'UX사고력',
  workSpeed: '작업속도',
  brandingSense: '브랜딩감각',
  prototyping: '프로토타이핑',
  scheduleManagement: '일정관리',
  requirementAnalysis: '요구사항분석',
  riskDetection: '리스크감지',
  clientManagement: '고객응대',
  teamCoordination: '팀조율력',
  stamina: '체력',
  communication: '소통',
  mental: '멘탈',
  growthRate: '성장속도',
  loyalty: '충성도',
};

interface RolePerformancePolicy {
  readonly role: Role;
  progressEffects?(employee: Employee): LayerEffect[];
  qualityEffects?(employee: Employee): LayerEffect[];
  revenueEffects?(employee: Employee, focusRatio: number, project: Project): LayerEffect[];
}

function specialistProgressEffects(
  employee: Employee,
  role: Role,
  weights: SpecialistWeights,
): LayerEffect[] {
  return Object.entries(weights).flatMap(([key, weight]) => {
    const value = Number((employee.specialistStats as unknown as Record<string, number>)[key]);
    if (!value || !weight) return [];
    return [createAddEffect(PROGRESS_METRIC, value * weight, employee, role, key, 'project.progress')];
  });
}

function centeredSpecialistEffects(
  metric: typeof SATISFACTION_METRIC | typeof RECURRING_REVENUE_METRIC,
  employee: Employee,
  role: Role,
  weights: SpecialistWeights,
  sourceRulePrefix: string,
  focusRatio = 1,
  targetProject?: Project,
): LayerEffect[] {
  return Object.entries(weights).flatMap(([key, weight]) => {
    const value = Number((employee.specialistStats as unknown as Record<string, number>)[key]);
    if (!weight) return [];
    const delta = (value - 5) * weight * focusRatio;
    if (delta === 0) return [];
    return [createEffect(metric, delta, employee, role, key, sourceRulePrefix, targetProject)];
  });
}

function createAddEffect(
  metric: typeof PROGRESS_METRIC,
  value: number,
  employee: Employee,
  role: Role,
  key: string,
  sourceRulePrefix: string,
): LayerEffect {
  return {
    layer: 'deterministic',
    metric,
    operation: 'add',
    value,
    reason: `${employee.name} ${ROLE_LABELS[role]} ${STAT_LABELS[key] ?? key}`,
    sourceRuleId: `${sourceRulePrefix}.${role}.${key}`,
    targetId: employee.id,
    sourceName: employee.name,
  };
}

function createEffect(
  metric: typeof SATISFACTION_METRIC | typeof RECURRING_REVENUE_METRIC | typeof PROGRESS_METRIC,
  value: number,
  employee: Employee,
  role: Role,
  key: string,
  sourceRulePrefix: string,
  targetProject?: Project,
): LayerEffect {
  return {
    layer: 'deterministic',
    metric,
    operation: metric === PROGRESS_METRIC ? 'percent' : metric === SATISFACTION_METRIC ? 'add' : 'percent',
    value,
    reason: `${employee.name} ${ROLE_LABELS[role]} ${STAT_LABELS[key] ?? key}`,
    sourceRuleId: `${sourceRulePrefix}.${role}.${key}`,
    targetId: targetProject?.id ?? employee.id,
    sourceName: targetProject?.name ?? employee.name,
  };
}

export class DeveloperContributionPolicy implements RolePerformancePolicy {
  readonly role = 'developer' as const;

  progressEffects(employee: Employee): LayerEffect[] {
    return specialistProgressEffects(employee, this.role, PROJECT_PROGRESS_SPECIALIST_WEIGHTS.developer);
  }

  qualityEffects(employee: Employee): LayerEffect[] {
    return centeredSpecialistEffects(
      SATISFACTION_METRIC,
      employee,
      this.role,
      PROJECT_SATISFACTION_SPECIALIST_WEIGHTS.developer,
      'project.satisfaction',
    );
  }

  revenueEffects(employee: Employee, focusRatio: number, project: Project): LayerEffect[] {
    return centeredSpecialistEffects(
      RECURRING_REVENUE_METRIC,
      employee,
      this.role,
      MAIN_REVENUE_SPECIALIST_WEIGHTS.developer,
      'economy.recurring-revenue.specialist',
      focusRatio,
      project,
    );
  }
}

export class DesignerContributionPolicy implements RolePerformancePolicy {
  readonly role = 'designer' as const;

  progressEffects(employee: Employee): LayerEffect[] {
    return specialistProgressEffects(employee, this.role, PROJECT_PROGRESS_SPECIALIST_WEIGHTS.designer);
  }

  qualityEffects(employee: Employee): LayerEffect[] {
    return centeredSpecialistEffects(
      SATISFACTION_METRIC,
      employee,
      this.role,
      PROJECT_SATISFACTION_SPECIALIST_WEIGHTS.designer,
      'project.satisfaction',
    );
  }

  revenueEffects(employee: Employee, focusRatio: number, project: Project): LayerEffect[] {
    return centeredSpecialistEffects(
      RECURRING_REVENUE_METRIC,
      employee,
      this.role,
      MAIN_REVENUE_SPECIALIST_WEIGHTS.designer,
      'economy.recurring-revenue.specialist',
      focusRatio,
      project,
    );
  }
}

export class PmContributionPolicy implements RolePerformancePolicy {
  readonly role = 'pm' as const;

  qualityEffects(employee: Employee): LayerEffect[] {
    return centeredSpecialistEffects(
      SATISFACTION_METRIC,
      employee,
      this.role,
      PROJECT_SATISFACTION_SPECIALIST_WEIGHTS.pm,
      'project.satisfaction',
    );
  }

  revenueEffects(employee: Employee, focusRatio: number, project: Project): LayerEffect[] {
    return centeredSpecialistEffects(
      RECURRING_REVENUE_METRIC,
      employee,
      this.role,
      MAIN_REVENUE_SPECIALIST_WEIGHTS.pm,
      'economy.recurring-revenue.specialist',
      focusRatio,
      project,
    );
  }
}

export class EmployeeContributionPolicyRegistry {
  private readonly policies: RolePerformancePolicy[];

  constructor(
    policies: RolePerformancePolicy[] = [
      new DeveloperContributionPolicy(),
      new DesignerContributionPolicy(),
      new PmContributionPolicy(),
    ],
  ) {
    this.policies = policies;
  }

  projectProgressEffects(assignedEmployees: Employee[]): LayerEffect[] {
    return assignedEmployees.flatMap((employee) =>
      this.policies.find((candidate) => candidate.role === employee.role)?.progressEffects?.(employee) ?? [],
    );
  }

  pmSupportEffects(assignedEmployees: Employee[]): LayerEffect[] {
    const pms = assignedEmployees.filter((employee) => employee.role === 'pm');
    if (pms.length === 0) return [];

    return Object.entries(PM_PROGRESS_SUPPORT_WEIGHTS).flatMap(([key, weight]) => {
      if (!weight) return [];
      const averageValue = average(
        pms.map((employee) => Number((employee.specialistStats as unknown as Record<string, number>)[key] ?? 0)),
      );
      const percent = clamp((averageValue - 5) * weight, -0.05, 0.07);
      if (percent === 0) return [];
      return [{
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'percent',
        value: percent,
        reason: `PM 평균 ${STAT_LABELS[key] ?? key} ${averageValue.toFixed(1)}`,
        sourceRuleId: `project.progress.pm-support.${key}`,
      } satisfies LayerEffect];
    });
  }

  deliveryQualityEffects(assignedEmployees: Employee[]): LayerEffect[] {
    return assignedEmployees.flatMap((employee) =>
      this.policies.find((candidate) => candidate.role === employee.role)?.qualityEffects?.(employee) ?? [],
    );
  }

  mainRevenueSpecialistEffects(
    project: Project,
    assignedEmployees: Array<{ employee: Employee; focusRatio: number }>,
  ): LayerEffect[] {
    return assignedEmployees.flatMap(({ employee, focusRatio }) =>
      this.policies.find((candidate) => candidate.role === employee.role)?.revenueEffects?.(employee, focusRatio, project) ?? [],
    );
  }
}

export class TeamProductivityPolicy {
  effects(assignedEmployees: Employee[]): LayerEffect[] {
    if (assignedEmployees.length === 0) return [];
    return (Object.entries(PROJECT_COMMON_WEIGHTS) as Array<[keyof CommonStats, number]>).flatMap(([key, weight]) => {
      const avg = average(assignedEmployees.map((employee) => employee.commonStats[key]));
      const percent = clamp((avg - 2) * weight, -0.09, 0.09);
      if (percent === 0) return [];
      return [{
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'percent',
        value: percent,
        reason: `팀 평균 ${STAT_LABELS[key]} ${avg.toFixed(1)}`,
        sourceRuleId: `project.progress.common-stats.${key}`,
      } satisfies LayerEffect];
    });
  }
}

export class ProbationPenaltyPolicy {
  percent(assignedEmployees: Employee[]): number {
    if (assignedEmployees.length === 0) return 0;
    const probationCount = assignedEmployees.filter((employee) => employee.probationTurnsLeft > 0).length;
    if (probationCount === 0) return 0;
    return -0.2 * (probationCount / assignedEmployees.length);
  }
}

export class OvertimeProgressPolicy {
  percent(project: Project): number {
    return project.overtimeActive ? 0.25 : 0;
  }
}

export class DeliveryTimingPolicy {
  satisfaction(project: Project): number {
    return project.turnsElapsed <= project.turnsRequired ? 8 : -10;
  }
}

export interface MainRevenueOperation {
  contributionRatio: number;
  avgCommunication: number;
  assignedCount: number;
}

interface MainRevenueAssignment {
  employee: Employee;
  focusRatio: number;
}

export class MainRevenueOperationPolicy {
  findMainRevenueProject(projects: Project[]): Project | null {
    return projects.find((project) => project.isMainRevenue && project.status === 'operating') ?? null;
  }

  operation(projects: Project[], employees: Employee[], mainProject: Project): MainRevenueOperation | null {
    const assigned = this.assignedEmployees(projects, employees, mainProject);
    if (assigned.length === 0) return null;

    return {
      contributionRatio: average(assigned.map(({ focusRatio }) => focusRatio)),
      avgCommunication: average(assigned.map(({ employee }) => employee.commonStats.communication)),
      assignedCount: assigned.length,
    };
  }

  focusEffect(projects: Project[], employees: Employee[], mainProject: Project): LayerEffect | null {
    const assigned = this.assignedEmployees(projects, employees, mainProject);
    if (assigned.length === 0) {
      return this.percentEffect(mainProject, -1, '주수입원 배정 직원 없음');
    }
    const averageFocus = average(assigned.map(({ focusRatio }) => focusRatio));
    return this.percentEffect(
      mainProject,
      averageFocus - 1,
      `주수입원 운영 집중도 ${(averageFocus * 100).toFixed(0)}%`,
    );
  }

  commonEffects(projects: Project[], employees: Employee[], mainProject: Project): LayerEffect[] {
    return this.assignedEmployees(projects, employees, mainProject).flatMap(({ employee, focusRatio }) =>
      (Object.entries(MAIN_REVENUE_COMMON_WEIGHTS) as Array<[keyof CommonStats, number]>).flatMap(([key, weight]) => {
        const delta = (employee.commonStats[key] - 2) * weight * focusRatio;
        if (delta === 0) return [];
        return [{
          layer: 'deterministic',
          metric: RECURRING_REVENUE_METRIC,
          operation: 'percent',
          value: delta,
          reason: `${employee.name} ${STAT_LABELS[key]}`,
          sourceRuleId: `economy.recurring-revenue.common.${key}`,
          targetId: mainProject.id,
          sourceName: mainProject.name,
        } satisfies LayerEffect];
      }),
    );
  }

  assignedEmployees(
    projects: Project[],
    employees: Employee[],
    mainProject: Project,
  ): MainRevenueAssignment[] {
    const employeeProjectCount = new Map<string, number>();
    for (const project of projects) {
      if (project.status !== 'active' && project.status !== 'operating') continue;
      for (const employeeId of project.assignedEmployeeIds) {
        employeeProjectCount.set(employeeId, (employeeProjectCount.get(employeeId) ?? 0) + 1);
      }
    }

    return mainProject.assignedEmployeeIds.flatMap((employeeId) => {
      const employee = employees.find((candidate) => candidate.id === employeeId);
      if (!employee) return [];
      const totalProjects = employeeProjectCount.get(employeeId) ?? 1;
      return [{
        employee,
        focusRatio: 1 / totalProjects,
      }];
    });
  }

  percentEffect(mainProject: Project, value: number, reason: string): LayerEffect {
    return {
      layer: 'deterministic',
      metric: RECURRING_REVENUE_METRIC,
      operation: 'percent',
      value,
      reason,
      sourceRuleId: 'economy.recurring-revenue.effective-operation',
      targetId: mainProject.id,
      sourceName: mainProject.name,
    };
  }
}

export const defaultEmployeeContributionRegistry = new EmployeeContributionPolicyRegistry();
export const defaultTeamProductivityPolicy = new TeamProductivityPolicy();
export const defaultProbationPenaltyPolicy = new ProbationPenaltyPolicy();
export const defaultOvertimeProgressPolicy = new OvertimeProgressPolicy();
export const defaultDeliveryTimingPolicy = new DeliveryTimingPolicy();
export const defaultMainRevenueOperationPolicy = new MainRevenueOperationPolicy();

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
