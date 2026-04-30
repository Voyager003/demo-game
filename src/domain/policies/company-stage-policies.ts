import type {
  CompanyStage,
  CompanyStagePreview,
  CompanyStageRequirementSnapshot,
  CompanyStageState,
} from '../../types/company-stage';
import type { GameState } from '../../types/core';
import type { Employee } from '../../types/employee';
import type { LayerEffect } from '../../types/layer';
import type { Project } from '../../types/project';
import type { LayerTraceInput } from '../logging';
import { resolveEconomyDeterministicMetrics } from '../layers/deterministic-layer';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const STAGE_ORDER: CompanyStage[] = ['solo', 'earlyTeam', 'startup', 'scaleUp'];

const STAGE_LABELS: Record<CompanyStage, string> = {
  solo: '1인 창업',
  earlyTeam: '초기 팀',
  startup: '소규모 스타트업',
  scaleUp: '스케일업',
};

interface StageDefinition {
  stage: CompanyStage;
  requirements: Array<{
    label: string;
    key: CompanyStageRequirementSnapshot['key'];
    required: number;
    unit?: string;
  }>;
}

interface StageProgressContext {
  employees: Employee[];
  capital: number;
  companyRating: number;
  recurringRevenue: number;
}

export interface CompanyStagePressureProfile {
  projectProgressPercent: number;
  recurringRevenuePercent: number;
  operatingCostPercent: number;
  reasons: string[];
}

export interface CompanyStagePressureEffects {
  profile: CompanyStagePressureProfile;
  projectEffects: LayerEffect[];
  recurringRevenueEffects: LayerEffect[];
}

export interface CompanyStageTransition {
  companyStage: CompanyStageState;
  promoted: boolean;
  log?: {
    message: string;
    source: string;
    layerTrace: LayerTraceInput;
  };
}

export interface CompanyStagePressureLog {
  message: string;
  source: string;
  layerTrace: LayerTraceInput;
}

export interface InvestmentGateResult {
  allowed: boolean;
  reasons: string[];
}

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    stage: 'solo',
    requirements: [],
  },
  {
    stage: 'earlyTeam',
    requirements: [
      { label: '직원 수', key: 'employees', required: 2, unit: '명' },
      { label: '자본', key: 'capital', required: 1200, unit: '만원' },
      { label: '회사 평가', key: 'companyRating', required: 25 },
    ],
  },
  {
    stage: 'startup',
    requirements: [
      { label: '직원 수', key: 'employees', required: 6, unit: '명' },
      { label: '자본', key: 'capital', required: 3000, unit: '만원' },
      { label: '회사 평가', key: 'companyRating', required: 40 },
      { label: '실효 반복수입', key: 'recurringRevenue', required: 180, unit: '만원' },
    ],
  },
  {
    stage: 'scaleUp',
    requirements: [
      { label: '직원 수', key: 'employees', required: 12, unit: '명' },
      { label: '자본', key: 'capital', required: 8000, unit: '만원' },
      { label: '회사 평가', key: 'companyRating', required: 55 },
      { label: '실효 반복수입', key: 'recurringRevenue', required: 350, unit: '만원' },
    ],
  },
];

function requirementCurrentValue(
  requirement: StageDefinition['requirements'][number],
  context: StageProgressContext,
): number {
  if (requirement.key === 'employees') return context.employees.length;
  if (requirement.key === 'capital') return context.capital;
  if (requirement.key === 'companyRating') return context.companyRating;
  return context.recurringRevenue;
}

function requirementsFor(
  stage: CompanyStage,
  context: StageProgressContext,
): CompanyStageRequirementSnapshot[] {
  const definition = STAGE_DEFINITIONS.find((candidate) => candidate.stage === stage);
  if (!definition) return [];
  return definition.requirements.map((requirement) => {
    const current = requirementCurrentValue(requirement, context);
    return {
      label: requirement.label,
      key: requirement.key,
      current,
      required: requirement.required,
      met: current >= requirement.required,
      unit: requirement.unit,
    };
  });
}

function nextStageAfter(stage: CompanyStage): CompanyStage | null {
  const index = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[index + 1] ?? null;
}

function previewFor(stage: CompanyStage | null, context: StageProgressContext): CompanyStagePreview {
  if (!stage) {
    return {
      stage: null,
      stageLabel: null,
      requirements: [],
    };
  }
  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    requirements: requirementsFor(stage, context),
  };
}

function dualLoadProjects(projects: Project[]): boolean {
  const activeContracts = projects.some((project) => project.kind === 'contract' && project.status === 'active');
  const operatingMainRevenue = projects.some((project) => project.kind === 'ownedProduct' && project.status === 'operating');
  return activeContracts && operatingMainRevenue;
}

export class CompanyStageCatalog {
  label(stage: CompanyStage): string {
    return STAGE_LABELS[stage];
  }

  initialState(context: StageProgressContext): CompanyStageState {
    return {
      currentStage: 'solo',
      highestStage: 'solo',
      lastPromotedTurn: null,
      nextStagePreview: previewFor('earlyTeam', context),
    };
  }

  preview(currentStage: CompanyStage, context: StageProgressContext): CompanyStagePreview {
    return previewFor(nextStageAfter(currentStage), context);
  }

  requirements(stage: CompanyStage, context: StageProgressContext): CompanyStageRequirementSnapshot[] {
    return requirementsFor(stage, context);
  }
}

export class CompanyStageProgressionPolicy {
  private readonly catalog: CompanyStageCatalog;

  constructor(catalog: CompanyStageCatalog = new CompanyStageCatalog()) {
    this.catalog = catalog;
  }

  initialState(context: StageProgressContext): CompanyStageState {
    return this.catalog.initialState(context);
  }

  evaluate(
    state: Pick<GameState, 'turn' | 'capital' | 'companyRating' | 'employees' | 'activeProjects' | 'organization' | 'companyStage' | 'gameStatus'>,
  ): CompanyStageTransition {
    const recurringRevenue = resolveEconomyDeterministicMetrics(
      state.activeProjects,
      state.employees,
      state.organization.chemistry.teamChem,
    ).recurringRevenue.finalValue;
    const context: StageProgressContext = {
      employees: state.employees,
      capital: state.capital,
      companyRating: state.companyRating,
      recurringRevenue,
    };
    const current = state.companyStage.currentStage;
    const next = nextStageAfter(current);
    if (state.gameStatus === 'ended' || !next) {
      return {
        companyStage: {
          ...state.companyStage,
          nextStagePreview: this.catalog.preview(current, context),
        },
        promoted: false,
      };
    }

    const requirements = this.catalog.requirements(next, context);
    const promoted = requirements.every((requirement) => requirement.met);
    if (!promoted) {
      return {
        companyStage: {
          ...state.companyStage,
          nextStagePreview: {
            stage: next,
            stageLabel: this.catalog.label(next),
            requirements,
          },
        },
        promoted: false,
      };
    }

    return {
      companyStage: {
        currentStage: next,
        highestStage: next,
        lastPromotedTurn: state.turn,
        nextStagePreview: this.catalog.preview(next, context),
      },
      promoted: true,
      log: {
        message: `회사 성장 단계 상승: ${this.catalog.label(current)} -> ${this.catalog.label(next)}`,
        source: 'GameSession.evaluateCompanyStage',
        layerTrace: {
          rule: '회사 성장 단계 승급',
          trigger: `월 정산 시점에 ${this.catalog.label(next)} 승급 조건 충족`,
          inputs: requirements.map((requirement) => {
            const unit = requirement.unit ?? '';
            return `${requirement.label}=${requirement.current}${unit}/${requirement.required}${unit}`;
          }),
          effects: [
            `companyStage.currentStage=${next}`,
            `companyStage.highestStage=${next}`,
            `lastPromotedTurn=${state.turn}`,
          ],
          finalValue: `현재 단계=${this.catalog.label(next)}`,
        },
      },
    };
  }
}

export class CompanyStagePressurePolicy {
  private readonly catalog: CompanyStageCatalog;

  constructor(catalog: CompanyStageCatalog = new CompanyStageCatalog()) {
    this.catalog = catalog;
  }

  evaluate(
    state: Pick<GameState, 'companyStage' | 'employees' | 'activeProjects' | 'organization'>,
  ): CompanyStagePressureEffects {
    const stage = state.companyStage.currentStage;
    const teamChem = state.organization.chemistry.teamChem;
    const employeeCount = state.employees.length;
    const activeProjectCount = state.activeProjects.filter((project) => project.status === 'active').length;
    const dualLoad = dualLoadProjects(state.activeProjects);

    let projectProgressPercent = 0;
    let recurringRevenuePercent = 0;
    let operatingCostPercent = 0;
    const reasons: string[] = [];

    if (stage === 'earlyTeam') {
      operatingCostPercent = 0.1;
      if (employeeCount >= 4 && teamChem < 45) {
        projectProgressPercent -= 0.05;
        recurringRevenuePercent -= 0.05;
        reasons.push(`초기 팀 조율 압박(teamChem ${teamChem})`);
      }
    }

    if (stage === 'startup') {
      operatingCostPercent = 0.25;
      if (dualLoad) {
        projectProgressPercent -= 0.08;
        recurringRevenuePercent -= 0.10;
        reasons.push('소규모 스타트업 병행 운영 압박');
      }
      if (teamChem < 55) {
        projectProgressPercent -= 0.05;
        recurringRevenuePercent -= 0.05;
        reasons.push(`소규모 스타트업 팀장 공백 압박(teamChem ${teamChem})`);
      }
    }

    if (stage === 'scaleUp') {
      operatingCostPercent = 0.45;
      if (dualLoad) {
        projectProgressPercent -= 0.12;
        recurringRevenuePercent -= 0.15;
        reasons.push('스케일업 병행 운영 압박');
      }
      if (teamChem < 60) {
        projectProgressPercent -= 0.08;
        recurringRevenuePercent -= 0.08;
        reasons.push(`스케일업 중간관리 공백(teamChem ${teamChem})`);
      }
      if (activeProjectCount >= 3) {
        projectProgressPercent -= 0.05;
        reasons.push(`스케일업 협업 오버헤드(active ${activeProjectCount}개)`);
      }
    }

    projectProgressPercent = clamp(projectProgressPercent, -0.4, 0);
    recurringRevenuePercent = clamp(recurringRevenuePercent, -0.4, 0);
    operatingCostPercent = clamp(operatingCostPercent, 0, 1);

    const stageLabel = this.catalog.label(stage);
    const projectEffects: LayerEffect[] = projectProgressPercent === 0
      ? []
      : [{
          layer: 'deterministic',
          metric: 'project.progressPerTurn',
          operation: 'percent',
          value: projectProgressPercent,
          reason: `${stageLabel} 운영 압박`,
          sourceRuleId: `company-stage.project.${stage}`,
        }];
    const recurringRevenueEffects: LayerEffect[] = recurringRevenuePercent === 0
      ? []
      : [{
          layer: 'deterministic',
          metric: 'economy.recurringRevenue',
          operation: 'percent',
          value: recurringRevenuePercent,
          reason: `${stageLabel} 운영 압박`,
          sourceRuleId: `company-stage.revenue.${stage}`,
        }];

    return {
      profile: {
        projectProgressPercent,
        recurringRevenuePercent,
        operatingCostPercent,
        reasons,
      },
      projectEffects,
      recurringRevenueEffects,
    };
  }

  createLog(
    stageState: CompanyStageState,
    effects: CompanyStagePressureEffects,
  ): CompanyStagePressureLog | null {
    if (
      effects.profile.projectProgressPercent === 0
      && effects.profile.recurringRevenuePercent === 0
      && effects.profile.operatingCostPercent === 0
    ) {
      return null;
    }
    const stageLabel = this.catalog.label(stageState.currentStage);
    return {
      message: `${stageLabel} 운영 압박 적용`,
      source: 'GameSession.applyWeeklySettlement',
      layerTrace: {
        rule: '회사 성장 단계 운영 압박',
        trigger: `${stageLabel} 단계의 월 정산/진척 계산`,
        inputs: [
          `currentStage=${stageLabel}`,
          `operatingCostPercent=${Math.round(effects.profile.operatingCostPercent * 100)}%`,
          `projectProgressPercent=${Math.round(effects.profile.projectProgressPercent * 100)}%`,
          `recurringRevenuePercent=${Math.round(effects.profile.recurringRevenuePercent * 100)}%`,
        ],
        effects: [
          ...effects.profile.reasons,
          `운영비 오버헤드 +${Math.round(effects.profile.operatingCostPercent * 100)}%`,
        ],
        finalValue: `${stageLabel} 압박 ${effects.profile.reasons.length}건`,
      },
    };
  }
}

export class CompanyStageInvestmentGatePolicy {
  isAllowed(
    state: Pick<GameState, 'companyStage' | 'companyRating' | 'activeProjects' | 'employees' | 'organization'>,
  ): InvestmentGateResult {
    const stage = state.companyStage.currentStage;
    if (stage === 'solo' || stage === 'earlyTeam') {
      return { allowed: true, reasons: [] };
    }

    const recurringRevenue = resolveEconomyDeterministicMetrics(
      state.activeProjects,
      state.employees,
      state.organization.chemistry.teamChem,
    ).recurringRevenue.finalValue;
    const reasons: string[] = [];

    const minimums = stage === 'startup'
      ? { companyRating: 45, recurringRevenue: 180, teamChem: 45 }
      : { companyRating: 60, recurringRevenue: 350, teamChem: 55 };

    if (state.companyRating < minimums.companyRating) {
      reasons.push(`회사 평가 ${minimums.companyRating}+ 필요`);
    }
    if (recurringRevenue < minimums.recurringRevenue) {
      reasons.push(`실효 반복수입 ${minimums.recurringRevenue}만원+ 필요`);
    }
    if (state.organization.chemistry.teamChem < minimums.teamChem) {
      reasons.push(`팀 케미 ${minimums.teamChem}+ 필요`);
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    };
  }
}

export const defaultCompanyStageCatalog = new CompanyStageCatalog();
export const defaultCompanyStageProgressionPolicy = new CompanyStageProgressionPolicy(defaultCompanyStageCatalog);
export const defaultCompanyStagePressurePolicy = new CompanyStagePressurePolicy(defaultCompanyStageCatalog);
export const defaultCompanyStageInvestmentGatePolicy = new CompanyStageInvestmentGatePolicy();
export function companyStageLabel(stage: CompanyStage): string {
  return defaultCompanyStageCatalog.label(stage);
}
