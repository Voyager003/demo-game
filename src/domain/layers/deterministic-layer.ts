import { BaseSimulationLayer, type LayerRule, type MetricResolution } from './base-simulation-layer';
import type { DesignerStats, DeveloperStats, Employee, PmStats } from '../../types/employee';
import type { GameMetricKey, LayerEffect } from '../../types/layer';
import type { Project } from '../../types/project';

export interface ProjectDeterministicContext {
  project: Project;
  assignedEmployees: Employee[];
}

export interface ProjectDeterministicResolution {
  effects: LayerEffect[];
  progressPerTurn: MetricResolution<GameMetricKey>;
  clientSatisfaction: MetricResolution<GameMetricKey>;
}

export interface EconomyDeterministicContext {
  projects: Project[];
  employees: Employee[];
}

export interface EconomyDeterministicResolution {
  effects: LayerEffect[];
  recurringRevenue: MetricResolution<GameMetricKey>;
  baseRevenue: number;
  mainProject: Project | null;
}

const PROGRESS_METRIC: GameMetricKey = 'project.progressPerTurn';
const SATISFACTION_METRIC: GameMetricKey = 'project.clientSatisfaction';
const RECURRING_REVENUE_METRIC: GameMetricKey = 'economy.recurringRevenue';

const projectRules: LayerRule<ProjectDeterministicContext>[] = [
  {
    id: 'project.progress.developer-core',
    description: '개발자 구현 스탯이 프로젝트 주간 진척도에 더해집니다.',
    evaluate: ({ assignedEmployees }) =>
      assignedEmployees
        .filter((employee) => employee.role === 'developer')
        .map((employee) => ({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'add',
          value: developerProgressScore(employee) * 4,
          reason: `${employee.name} 개발자 구현 기여도`,
          sourceRuleId: 'project.progress.developer-core',
          targetId: employee.id,
          sourceName: employee.name,
        })),
  },
  {
    id: 'project.progress.designer-core',
    description: '디자이너 제작 스탯이 프로젝트 주간 진척도에 더해집니다.',
    evaluate: ({ assignedEmployees }) =>
      assignedEmployees
        .filter((employee) => employee.role === 'designer')
        .map((employee) => ({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'add',
          value: designerProgressScore(employee) * 4,
          reason: `${employee.name} 디자이너 제작 기여도`,
          sourceRuleId: 'project.progress.designer-core',
          targetId: employee.id,
          sourceName: employee.name,
        })),
  },
  {
    id: 'project.progress.pm-support',
    description: 'PM은 직접 산출물보다 일정/조율 보정으로 진척도를 지원합니다.',
    evaluate: ({ assignedEmployees }) => {
      const pms = assignedEmployees.filter((employee) => employee.role === 'pm');
      if (pms.length === 0) return [];
      const supportScore = average(pms.map(pmProgressSupportScore));
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
    },
  },
  {
    id: 'project.progress.common-stats',
    description: '팀 평균 공통 스탯이 프로젝트 생산성에 보정으로 적용됩니다.',
    evaluate: ({ assignedEmployees }) => {
      if (assignedEmployees.length === 0) return [];
      const percent = clamp(
        average(assignedEmployees.map(commonProductivityPercent)),
        -0.25,
        0.25,
      );
      if (percent === 0) return [];
      return [{
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'percent',
        value: percent,
        reason: '팀 평균 체력/커뮤니케이션/멘탈 보정',
        sourceRuleId: 'project.progress.common-stats',
      }];
    },
  },
  {
    id: 'project.progress.probation-penalty',
    description: '수습 직원 비율에 따라 주간 진척도에 페널티가 적용됩니다.',
    evaluate: ({ assignedEmployees }) => {
      if (assignedEmployees.length === 0) return [];
      const probationCount = assignedEmployees.filter((employee) => employee.probationTurnsLeft > 0).length;
      if (probationCount === 0) return [];
      return [{
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'percent',
        value: -0.2 * (probationCount / assignedEmployees.length),
        reason: `수습 직원 ${probationCount}/${assignedEmployees.length}명`,
        sourceRuleId: 'project.progress.probation-penalty',
      }];
    },
  },
  {
    id: 'project.progress.overtime',
    description: '야근 지시가 해당 턴의 주간 진척도에 보정으로 적용됩니다.',
    evaluate: ({ project }) => {
      if (!project.overtimeActive) return [];
      return [{
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'percent',
        value: 0.25,
        reason: '야근 지시',
        sourceRuleId: 'project.progress.overtime',
        targetId: project.id,
        sourceName: project.name,
      }];
    },
  },
  {
    id: 'project.satisfaction.delivery-quality',
    description: '개발자/디자이너 품질 스탯이 클라이언트 만족도에 반영됩니다.',
    evaluate: ({ assignedEmployees }) => {
      const qualityEmployees = assignedEmployees.filter((employee) => employee.role !== 'pm');
      if (qualityEmployees.length === 0) return [];
      const qualityScore = average(qualityEmployees.map(roleQualityScore));
      return [{
        layer: 'deterministic',
        metric: SATISFACTION_METRIC,
        operation: 'add',
        value: (qualityScore - 5) * 4,
        reason: `산출물 품질 평균 ${qualityScore.toFixed(1)}`,
        sourceRuleId: 'project.satisfaction.delivery-quality',
      }];
    },
  },
  {
    id: 'project.satisfaction.pm-client-support',
    description: 'PM의 고객/요구사항 관리 스탯이 클라이언트 만족도에 반영됩니다.',
    evaluate: ({ assignedEmployees }) => {
      const pms = assignedEmployees.filter((employee) => employee.role === 'pm');
      if (pms.length === 0) return [];
      const supportScore = average(pms.map(pmClientSupportScore));
      return [{
        layer: 'deterministic',
        metric: SATISFACTION_METRIC,
        operation: 'add',
        value: (supportScore - 5) * 2,
        reason: `PM 고객/요구사항 지원 평균 ${supportScore.toFixed(1)}`,
        sourceRuleId: 'project.satisfaction.pm-client-support',
      }];
    },
  },
  {
    id: 'project.satisfaction.delivery-timing',
    description: '납기 내 완료 여부가 클라이언트 만족도에 반영됩니다.',
    evaluate: ({ project }) => [{
      layer: 'deterministic',
      metric: SATISFACTION_METRIC,
      operation: 'add',
      value: project.turnsElapsed <= project.turnsRequired ? 8 : -10,
      reason: project.turnsElapsed <= project.turnsRequired ? '납기 내 완료' : '납기 지연 완료',
      sourceRuleId: 'project.satisfaction.delivery-timing',
      targetId: project.id,
      sourceName: project.name,
    }],
  },
];

const economyRules: LayerRule<EconomyDeterministicContext>[] = [
  {
    id: 'economy.recurring-revenue.main-product-base',
    description: '운영 중인 주수입원의 월 기본 매출을 실효 매출 기준값으로 설정합니다.',
    evaluate: ({ projects }) => {
      const mainProject = findMainRevenueProject(projects);
      if (!mainProject) return [];
      return [{
        layer: 'deterministic',
        metric: RECURRING_REVENUE_METRIC,
        operation: 'set',
        value: mainProject.monthlyRevenue,
        reason: `${mainProject.name} 월 기본 매출`,
        sourceRuleId: 'economy.recurring-revenue.main-product-base',
        targetId: mainProject.id,
        sourceName: mainProject.name,
      }];
    },
  },
  {
    id: 'economy.recurring-revenue.effective-operation',
    description: '주수입원 배정 인력의 외주 병행과 커뮤니케이션을 실효 매출 보정으로 적용합니다.',
    evaluate: (context) => {
      const mainProject = findMainRevenueProject(context.projects);
      if (!mainProject) return [];
      if (context.employees.length === 0) {
        return [mainRevenuePercentEffect(mainProject, -1, '운영 직원 없음')];
      }

      const operation = calculateMainRevenueOperation(context.projects, context.employees, mainProject);
      if (!operation) {
        return [mainRevenuePercentEffect(mainProject, -1, '주수입원 배정 직원 없음')];
      }

      return [
        mainRevenuePercentEffect(
          mainProject,
          operation.effectiveMultiplier - 1,
          `주수입원 운영 보정: 투입률 ${(operation.contributionRatio * 100).toFixed(0)}%, 커뮤니케이션 ${(operation.communicationPercent * 100).toFixed(1)}%`,
        ),
      ];
    },
  },
];

export class DeterministicLayer extends BaseSimulationLayer<
  ProjectDeterministicContext,
  ProjectDeterministicResolution
> {
  readonly kind = 'deterministic' as const;

  evaluate(context: ProjectDeterministicContext): LayerEffect[] {
    return projectRules.flatMap((rule) => rule.evaluate(context));
  }

  resolve(context: ProjectDeterministicContext): ProjectDeterministicResolution {
    const effects = this.evaluate(context);
    const progressPerTurn = this.aggregateMetric({
      metric: PROGRESS_METRIC,
      baseValue: 0,
      effects,
      min: 0,
      precision: 2,
      trace: {
        rule: '프로젝트 주간 진척도 결정',
        trigger: '프로젝트 실행 단계에서 배정 직원과 야근 상태를 평가',
        inputs: projectInputs(context),
      },
    });
    const clientSatisfaction = this.aggregateMetric({
      metric: SATISFACTION_METRIC,
      baseValue: 70,
      effects,
      min: 30,
      max: 100,
      precision: 0,
      trace: {
        rule: '프로젝트 클라이언트 만족도 결정',
        trigger: '프로젝트 완료 시 산출물 품질과 납기 상태를 평가',
        inputs: projectInputs(context),
      },
    });

    return {
      effects,
      progressPerTurn,
      clientSatisfaction,
    };
  }

  evaluateEconomy(context: EconomyDeterministicContext): LayerEffect[] {
    return economyRules.flatMap((rule) => rule.evaluate(context));
  }

  resolveEconomy(context: EconomyDeterministicContext): EconomyDeterministicResolution {
    const effects = this.evaluateEconomy(context);
    const mainProject = findMainRevenueProject(context.projects);
    const baseRevenue = mainProject?.monthlyRevenue ?? 0;
    const recurringRevenue = this.aggregateMetric({
      metric: RECURRING_REVENUE_METRIC,
      baseValue: 0,
      effects,
      min: 0,
      precision: 0,
      trace: {
        rule: '주수입원 실효 매출 결정',
        trigger: '월 정산 또는 재무 표시에서 operating 상태의 주수입원을 평가',
        inputs: economyInputs(context, mainProject),
      },
    });

    return {
      effects,
      recurringRevenue,
      baseRevenue,
      mainProject,
    };
  }
}

export const deterministicLayer = new DeterministicLayer();

export function resolveProjectDeterministicMetrics(
  project: Project,
  assignedEmployees: Employee[],
): ProjectDeterministicResolution {
  return deterministicLayer.resolve({ project, assignedEmployees });
}

export function resolveEconomyDeterministicMetrics(
  projects: Project[],
  employees: Employee[],
): EconomyDeterministicResolution {
  return deterministicLayer.resolveEconomy({ projects, employees });
}

function projectInputs({ project, assignedEmployees }: ProjectDeterministicContext): string[] {
  return [
    `project=${project.name}`,
    `assignedEmployees=${assignedEmployees.length}명`,
    `turnsElapsed=${project.turnsElapsed}`,
    `turnsRequired=${project.turnsRequired}`,
    `overtimeActive=${project.overtimeActive}`,
  ];
}

function economyInputs(
  { projects, employees }: EconomyDeterministicContext,
  mainProject: Project | null,
): string[] {
  if (!mainProject) {
    return [
      'mainRevenueProject=없음',
      `operatingOwnedProducts=${projects.filter((project) => project.kind === 'ownedProduct' && project.status === 'operating').length}개`,
      `employees=${employees.length}명`,
    ];
  }

  const operation = calculateMainRevenueOperation(projects, employees, mainProject);
  return [
    `mainRevenueProject=${mainProject.name}`,
    `baseRevenue=${mainProject.monthlyRevenue}만원`,
    `assignedEmployees=${mainProject.assignedEmployeeIds.length}명`,
    `employees=${employees.length}명`,
    operation
      ? `contributionRatio=${(operation.contributionRatio * 100).toFixed(0)}%`
      : 'contributionRatio=0%',
    operation
      ? `avgCommunication=${operation.avgCommunication.toFixed(1)}`
      : 'avgCommunication=0.0',
  ];
}

function findMainRevenueProject(projects: Project[]): Project | null {
  return projects.find((project) => project.isMainRevenue && project.status === 'operating') ?? null;
}

function mainRevenuePercentEffect(
  mainProject: Project,
  value: number,
  reason: string,
): LayerEffect {
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

interface MainRevenueOperation {
  contributionRatio: number;
  avgCommunication: number;
  communicationPercent: number;
  effectiveMultiplier: number;
}

function calculateMainRevenueOperation(
  projects: Project[],
  employees: Employee[],
  mainProject: Project,
): MainRevenueOperation | null {
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

function developerProgressScore(employee: Employee): number {
  if (employee.role !== 'developer') return 0;
  const stats = employee.specialistStats as DeveloperStats;
  return (
    stats.codingSpeed * 0.45 +
    stats.problemSolving * 0.25 +
    stats.techBreadth * 0.2 +
    stats.codeQuality * 0.1
  );
}

function designerProgressScore(employee: Employee): number {
  if (employee.role !== 'designer') return 0;
  const stats = employee.specialistStats as DesignerStats;
  return (
    stats.workSpeed * 0.4 +
    stats.prototyping * 0.25 +
    stats.uxThinking * 0.25 +
    stats.uiSense * 0.1
  );
}

function pmProgressSupportScore(employee: Employee): number {
  if (employee.role !== 'pm') return 0;
  const stats = employee.specialistStats as PmStats;
  return (
    stats.scheduleManagement * 0.4 +
    stats.teamCoordination * 0.4 +
    stats.riskDetection * 0.2
  );
}

function roleQualityScore(employee: Employee): number {
  if (employee.role === 'developer') {
    const stats = employee.specialistStats as DeveloperStats;
    return (
      stats.codeQuality * 0.4 +
      stats.problemSolving * 0.25 +
      stats.securitySense * 0.2 +
      stats.techBreadth * 0.15
    );
  }

  if (employee.role === 'designer') {
    const stats = employee.specialistStats as DesignerStats;
    return (
      stats.uiSense * 0.35 +
      stats.uxThinking * 0.35 +
      stats.brandingSense * 0.2 +
      stats.prototyping * 0.1
    );
  }

  return 0;
}

function pmClientSupportScore(employee: Employee): number {
  if (employee.role !== 'pm') return 0;
  const stats = employee.specialistStats as PmStats;
  return (
    stats.clientManagement * 0.35 +
    stats.requirementAnalysis * 0.3 +
    stats.riskDetection * 0.2 +
    stats.teamCoordination * 0.15
  );
}

function commonProductivityPercent(employee: Employee): number {
  const { stamina, communication, mental } = employee.commonStats;
  return (stamina - 2) * 0.03 + (communication - 2) * 0.02 + (mental - 2) * 0.02;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
