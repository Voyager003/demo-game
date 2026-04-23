import type { DesignerStats, DeveloperStats, Employee, PmStats, Role } from '../../types/employee';
import type { LayerEffect } from '../../types/layer';
import type { Project } from '../../types/project';

const PROGRESS_METRIC = 'project.progressPerTurn' as const;
const SATISFACTION_METRIC = 'project.clientSatisfaction' as const;
const RECURRING_REVENUE_METRIC = 'economy.recurringRevenue' as const;

interface RolePerformancePolicy {
  readonly role: Role;
  progressContribution?(employee: Employee): number;
  qualityContribution?(employee: Employee): number;
  supportContribution?(employee: Employee): number;
  clientSupportContribution?(employee: Employee): number;
}

export class DeveloperContributionPolicy implements RolePerformancePolicy {
  readonly role = 'developer' as const;

  progressContribution(employee: Employee): number {
    const stats = employee.specialistStats as DeveloperStats;
    return (
      stats.codingSpeed * 0.45 +
      stats.problemSolving * 0.25 +
      stats.techBreadth * 0.2 +
      stats.codeQuality * 0.1
    );
  }

  qualityContribution(employee: Employee): number {
    const stats = employee.specialistStats as DeveloperStats;
    return (
      stats.codeQuality * 0.4 +
      stats.problemSolving * 0.25 +
      stats.securitySense * 0.2 +
      stats.techBreadth * 0.15
    );
  }
}

export class DesignerContributionPolicy implements RolePerformancePolicy {
  readonly role = 'designer' as const;

  progressContribution(employee: Employee): number {
    const stats = employee.specialistStats as DesignerStats;
    return (
      stats.workSpeed * 0.4 +
      stats.prototyping * 0.25 +
      stats.uxThinking * 0.25 +
      stats.uiSense * 0.1
    );
  }

  qualityContribution(employee: Employee): number {
    const stats = employee.specialistStats as DesignerStats;
    return (
      stats.uiSense * 0.35 +
      stats.uxThinking * 0.35 +
      stats.brandingSense * 0.2 +
      stats.prototyping * 0.1
    );
  }
}

export class PmContributionPolicy implements RolePerformancePolicy {
  readonly role = 'pm' as const;

  supportContribution(employee: Employee): number {
    const stats = employee.specialistStats as PmStats;
    return (
      stats.scheduleManagement * 0.4 +
      stats.teamCoordination * 0.4 +
      stats.riskDetection * 0.2
    );
  }

  clientSupportContribution(employee: Employee): number {
    const stats = employee.specialistStats as PmStats;
    return (
      stats.clientManagement * 0.35 +
      stats.requirementAnalysis * 0.3 +
      stats.riskDetection * 0.2 +
      stats.teamCoordination * 0.15
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
    const effects: LayerEffect[] = [];
    for (const employee of assignedEmployees) {
      const policy = this.policies.find((candidate) => candidate.role === employee.role);
      const contribution = policy?.progressContribution?.(employee);
      if (!contribution) continue;
      effects.push({
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'add',
        value: contribution * 4,
        reason: `${employee.name} ${this.roleLabel(employee.role)} 기여도`,
        sourceRuleId: `project.progress.${employee.role}-core`,
        targetId: employee.id,
        sourceName: employee.name,
      });
    }
    return effects;
  }

  pmSupportEffect(assignedEmployees: Employee[]): LayerEffect[] {
    const pms = assignedEmployees.filter((employee) => employee.role === 'pm');
    if (pms.length === 0) return [];
    const supportValues = pms.map((employee) =>
      this.policies.find((policy) => policy.role === 'pm')?.supportContribution?.(employee) ?? 0,
    );
    const supportScore = average(supportValues);
    const percent = clamp(Math.max(0, (supportScore - 5) * 0.03), 0, 0.12);
    if (percent <= 0) return [];
    return [{
      layer: 'deterministic',
      metric: PROGRESS_METRIC,
      operation: 'percent',
      value: percent,
      reason: `PM 일정/조율 지원 평균 ${supportScore.toFixed(1)}`,
      sourceRuleId: 'project.progress.pm-support',
    }];
  }

  deliveryQualityEffect(assignedEmployees: Employee[]): LayerEffect[] {
    const qualityScores = assignedEmployees
      .map((employee) => {
        const policy = this.policies.find((candidate) => candidate.role === employee.role);
        return policy?.qualityContribution?.(employee);
      })
      .filter((value): value is number => value !== undefined);
    if (qualityScores.length === 0) return [];
    const qualityScore = average(qualityScores);
    return [{
      layer: 'deterministic',
      metric: SATISFACTION_METRIC,
      operation: 'add',
      value: (qualityScore - 5) * 4,
      reason: `산출물 품질 평균 ${qualityScore.toFixed(1)}`,
      sourceRuleId: 'project.satisfaction.delivery-quality',
    }];
  }

  pmClientSupportEffect(assignedEmployees: Employee[]): LayerEffect[] {
    const pms = assignedEmployees.filter((employee) => employee.role === 'pm');
    if (pms.length === 0) return [];
    const supportScore = average(
      pms.map((employee) =>
        this.policies.find((policy) => policy.role === 'pm')?.clientSupportContribution?.(employee) ?? 0,
      ),
    );
    return [{
      layer: 'deterministic',
      metric: SATISFACTION_METRIC,
      operation: 'add',
      value: (supportScore - 5) * 2,
      reason: `PM 고객/요구사항 지원 평균 ${supportScore.toFixed(1)}`,
      sourceRuleId: 'project.satisfaction.pm-client-support',
    }];
  }

  private roleLabel(role: Role): string {
    if (role === 'developer') return '개발자 구현';
    if (role === 'designer') return '디자이너 제작';
    return 'PM';
  }
}

export class TeamProductivityPolicy {
  percent(assignedEmployees: Employee[]): number {
    if (assignedEmployees.length === 0) return 0;
    return clamp(average(assignedEmployees.map((employee) => {
      const { stamina, communication, mental } = employee.commonStats;
      return (stamina - 2) * 0.03 + (communication - 2) * 0.02 + (mental - 2) * 0.02;
    })), -0.25, 0.25);
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
  communicationPercent: number;
  effectiveMultiplier: number;
}

export class MainRevenueOperationPolicy {
  findMainRevenueProject(projects: Project[]): Project | null {
    return projects.find((project) => project.isMainRevenue && project.status === 'operating') ?? null;
  }

  operation(projects: Project[], employees: Employee[], mainProject: Project): MainRevenueOperation | null {
    const assignedCount = mainProject.assignedEmployeeIds.length;
    if (assignedCount === 0) return null;

    const employeeProjectCount = new Map<string, number>();
    for (const project of projects) {
      if (project.status !== 'active' && project.status !== 'operating') continue;
      for (const employeeId of project.assignedEmployeeIds) {
        employeeProjectCount.set(employeeId, (employeeProjectCount.get(employeeId) ?? 0) + 1);
      }
    }

    let mainContribution = 0;
    let communicationTotal = 0;

    for (const employeeId of mainProject.assignedEmployeeIds) {
      const employee = employees.find((candidate) => candidate.id === employeeId);
      if (!employee) continue;
      const totalProjects = employeeProjectCount.get(employeeId) ?? 1;
      mainContribution += 1 / totalProjects;
      communicationTotal += employee.commonStats.communication;
    }

    const contributionRatio = mainContribution / assignedCount;
    const avgCommunication = communicationTotal / assignedCount;
    const communicationPercent = avgCommunication * 0.03;

    return {
      contributionRatio,
      avgCommunication,
      communicationPercent,
      effectiveMultiplier: contributionRatio * (1 + communicationPercent),
    };
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
