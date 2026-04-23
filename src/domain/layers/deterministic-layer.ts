import { BaseSimulationLayer, type LayerRule, type MetricResolution } from './base-simulation-layer';
import type { Employee } from '../../types/employee';
import type { GameMetricKey, LayerEffect } from '../../types/layer';
import type { Project } from '../../types/project';
import {
  defaultDeliveryTimingPolicy,
  defaultEmployeeContributionRegistry,
  defaultMainRevenueOperationPolicy,
  defaultOvertimeProgressPolicy,
  defaultProbationPenaltyPolicy,
  defaultTeamProductivityPolicy,
} from '../policies/deterministic-policies';

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
    id: 'project.progress.role-contributions',
    description: '역할별 기여 정책이 프로젝트 주간 진척도 효과를 생성합니다.',
    evaluate: ({ assignedEmployees }) => defaultEmployeeContributionRegistry.projectProgressEffects(assignedEmployees),
  },
  {
    id: 'project.progress.pm-support',
    description: 'PM 지원 정책이 일정/조율 보정을 계산합니다.',
    evaluate: ({ assignedEmployees }) => defaultEmployeeContributionRegistry.pmSupportEffects(assignedEmployees),
  },
  {
    id: 'project.progress.common-stats',
    description: '팀 평균 공통 스탯이 프로젝트 생산성에 보정으로 적용됩니다.',
    evaluate: ({ assignedEmployees }) => defaultTeamProductivityPolicy.effects(assignedEmployees),
  },
  {
    id: 'project.progress.probation-penalty',
    description: '수습 직원 비율에 따라 주간 진척도에 페널티가 적용됩니다.',
    evaluate: ({ assignedEmployees }) => {
      const percent = defaultProbationPenaltyPolicy.percent(assignedEmployees);
      if (percent === 0) return [];
      const probationCount = assignedEmployees.filter((employee) => employee.probationTurnsLeft > 0).length;
      return [{
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'percent',
        value: percent,
        reason: `수습 직원 ${probationCount}/${assignedEmployees.length}명`,
        sourceRuleId: 'project.progress.probation-penalty',
      }];
    },
  },
  {
    id: 'project.progress.overtime',
    description: '야근 지시가 해당 턴의 주간 진척도에 보정으로 적용됩니다.',
    evaluate: ({ project }) => {
      const percent = defaultOvertimeProgressPolicy.percent(project);
      if (percent === 0) return [];
      return [{
        layer: 'deterministic',
        metric: PROGRESS_METRIC,
        operation: 'percent',
        value: percent,
        reason: '야근 지시',
        sourceRuleId: 'project.progress.overtime',
        targetId: project.id,
        sourceName: project.name,
      }];
    },
  },
  {
    id: 'project.satisfaction.delivery-quality',
    description: '역할별 품질 정책이 클라이언트 만족도에 반영됩니다.',
    evaluate: ({ assignedEmployees }) => defaultEmployeeContributionRegistry.deliveryQualityEffects(assignedEmployees),
  },
  {
    id: 'project.satisfaction.delivery-timing',
    description: '납기 내 완료 여부가 클라이언트 만족도에 반영됩니다.',
    evaluate: ({ project }) => [{
      layer: 'deterministic',
      metric: SATISFACTION_METRIC,
      operation: 'add',
      value: defaultDeliveryTimingPolicy.satisfaction(project),
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
      const mainProject = defaultMainRevenueOperationPolicy.findMainRevenueProject(projects);
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
    description: '주수입원 배정 인력의 운영 집중도를 실효 매출 보정으로 적용합니다.',
    evaluate: (context) => {
      const mainProject = defaultMainRevenueOperationPolicy.findMainRevenueProject(context.projects);
      if (!mainProject) return [];
      return [defaultMainRevenueOperationPolicy.focusEffect(context.projects, context.employees, mainProject)]
        .filter((effect): effect is NonNullable<typeof effect> => Boolean(effect));
    },
  },
  {
    id: 'economy.recurring-revenue.common-stats',
    description: '주수입원 배정 직원의 공통 스탯을 실효 매출 보정으로 적용합니다.',
    evaluate: (context) => {
      const mainProject = defaultMainRevenueOperationPolicy.findMainRevenueProject(context.projects);
      if (!mainProject) return [];
      return defaultMainRevenueOperationPolicy.commonEffects(context.projects, context.employees, mainProject);
    },
  },
  {
    id: 'economy.recurring-revenue.specialist-stats',
    description: '주수입원 배정 직원의 전문 스탯을 실효 매출 보정으로 적용합니다.',
    evaluate: (context) => {
      const mainProject = defaultMainRevenueOperationPolicy.findMainRevenueProject(context.projects);
      if (!mainProject) return [];
      const assignedEmployees = defaultMainRevenueOperationPolicy.assignedEmployees(
        context.projects,
        context.employees,
        mainProject,
      );
      return defaultEmployeeContributionRegistry.mainRevenueSpecialistEffects(mainProject, assignedEmployees);
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
    const mainProject = defaultMainRevenueOperationPolicy.findMainRevenueProject(context.projects);
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

  const operation = defaultMainRevenueOperationPolicy.operation(projects, employees, mainProject);
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
