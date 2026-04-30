import { resolveEconomyDeterministicMetrics } from '../layers/deterministic-layer';
import type { RandomSource } from '../generation';
import type { LayerTraceInput } from '../logging';
import type { CEO } from '../../types/ceo';
import type {
  InvestmentState,
  PendingInvestmentResult,
} from '../../types/core';
import type { Employee } from '../../types/employee';
import type { Project } from '../../types/project';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface InvestmentReviewContext {
  turn: number;
  ceo: CEO;
  companyRating: number;
  completedProjectCount: number;
  activeProjects: Project[];
  employees: Employee[];
}

export interface InvestmentReviewStart {
  investment: InvestmentState;
  recurringRevenue: number;
  deterministicTrace: LayerTraceInput;
  probabilisticTrace: LayerTraceInput;
}

export interface InvestmentResolution {
  capital: number;
  companyRating: number;
  employees: Employee[];
  investment: InvestmentState;
  logs: Array<{
    message: string;
    layer: 'deterministic' | 'probabilistic';
    source: string;
    layerTrace: LayerTraceInput;
  }>;
}

export class InvestmentReviewPolicy {
  private readonly random: RandomSource;

  constructor(random: RandomSource) {
    this.random = random;
  }

  start(context: InvestmentReviewContext, previous: InvestmentState): InvestmentReviewStart {
    const recurringRevenue = resolveEconomyDeterministicMetrics(
      context.activeProjects,
      context.employees,
    ).recurringRevenue.finalValue;
    const potential = this.calculatePotential(context.ceo.stats.vision, context.completedProjectCount, recurringRevenue);
    const deterministicScore = clamp(
      Math.round(
        potential
        + clamp(context.companyRating * 0.4, 0, 20)
        + clamp(context.ceo.stats.vision * 2, 0, 20),
      ),
      5,
      95,
    );
    const successProbability = clamp(
      Number((0.15 + deterministicScore * 0.007).toFixed(3)),
      0.15,
      0.9,
    );
    const success = this.random.next() < successProbability;
    const capitalDelta = success ? 1200 + deterministicScore * 8 : 0;
    const companyRatingDelta = success ? 8 : -5;
    const pendingResult: PendingInvestmentResult = {
      success,
      deterministicScore,
      successProbability,
      capitalDelta,
      companyRatingDelta,
      employeeLoyaltyDelta: success ? 1 : 0,
      employeeGrowthRateDelta: success ? 1 : 0,
      summary: [
        `포텐셜=${potential}`,
        `vision=${context.ceo.stats.vision}`,
        `completedProjects=${context.completedProjectCount}`,
        `recurringRevenue=${recurringRevenue}만원`,
        `companyRating=${context.companyRating}`,
      ],
    };

    return {
      investment: {
        status: 'underReview',
        reviewEndsOnTurn: context.turn + 2,
        cooldownEndsOnTurn: null,
        pendingResult,
        attemptCount: previous.attemptCount + 1,
      },
      recurringRevenue,
      deterministicTrace: {
        rule: '투자 심사 결정론 점수 산출',
        trigger: 'startInvestmentRound 액션 성공 후 투자 심사 시작',
        inputs: [
          `vision=${context.ceo.stats.vision}`,
          `completedProjectCount=${context.completedProjectCount}`,
          `recurringRevenue=${recurringRevenue}만원`,
          `companyRating=${context.companyRating}`,
          `potential=${potential}`,
        ],
        effects: [
          `deterministicScore=${deterministicScore}`,
          '포텐셜은 비전 + 실적 + 반복 수입의 합성 신호로 계산',
          `reviewEndsOnTurn=${context.turn + 2}`,
        ],
        finalValue: `투자 심사 점수=${deterministicScore}`,
      },
      probabilisticTrace: {
        layer: 'probabilistic',
        rule: '투자 심사 확률 판정',
        trigger: '결정론 점수를 투자 성공 확률로 변환',
        inputs: [
          `deterministicScore=${deterministicScore}`,
          `successProbability=${Math.round(successProbability * 100)}%`,
        ],
        effects: [
          success ? `success=true, capitalDelta=${capitalDelta}만원` : 'success=false',
          success ? '투자 확정 시 직원 loyalty/growthRate 보너스 예약' : '실패 시 companyRating 하락 예정',
        ],
        finalValue: success
          ? `성공 확률 ${Math.round(successProbability * 100)}%, 투자 유치 성공`
          : `성공 확률 ${Math.round(successProbability * 100)}%, 투자 유치 실패`,
      },
    };
  }

  private calculatePotential(vision: number, completedProjectCount: number, recurringRevenue: number): number {
    const visionScore = vision * 4;
    const deliveryScore = clamp(completedProjectCount * 8, 0, 24);
    const revenueScore = clamp(Math.round(recurringRevenue / 15), 0, 32);
    return clamp(visionScore + deliveryScore + revenueScore, 0, 70);
  }
}

export class InvestmentResultResolver {
  resolve(
    state: {
      capital: number;
      companyRating: number;
      employees: Employee[];
      investment: InvestmentState;
      turn: number;
    },
  ): InvestmentResolution {
    const result = state.investment.pendingResult;
    if (!result) {
      return {
        capital: state.capital,
        companyRating: state.companyRating,
        employees: state.employees,
        investment: state.investment,
        logs: [],
      };
    }

    const companyRating = clamp(state.companyRating + result.companyRatingDelta, 0, 100);
    const employees = result.success
      ? state.employees.map((employee) => ({
          ...employee,
          commonStats: {
            ...employee.commonStats,
            loyalty: clamp(employee.commonStats.loyalty + result.employeeLoyaltyDelta, -1, 5),
            growthRate: clamp(employee.commonStats.growthRate + result.employeeGrowthRateDelta, -1, 5),
          },
        }))
      : state.employees;
    const investment: InvestmentState = {
      ...state.investment,
      status: 'cooldown',
      reviewEndsOnTurn: null,
      cooldownEndsOnTurn: state.turn + 8,
      pendingResult: null,
    };

    const logs: InvestmentResolution['logs'] = [];
    logs.push({
      message: result.success
        ? `투자 유치 성공: +${result.capitalDelta.toLocaleString()}만원`
        : '투자 유치 실패',
      layer: 'probabilistic',
      source: 'GameSession.resolveInvestmentEvent',
      layerTrace: {
        layer: 'probabilistic',
        rule: '투자 심사 결과 적용',
        trigger: 'investmentResult 이벤트 확인',
        inputs: [
          `deterministicScore=${result.deterministicScore}`,
          `successProbability=${Math.round(result.successProbability * 100)}%`,
          ...result.summary,
        ],
        effects: result.success
          ? [
              `capital +${result.capitalDelta}만원`,
              `companyRating +${result.companyRatingDelta}`,
              `직원 loyalty +${result.employeeLoyaltyDelta}`,
              `직원 growthRate +${result.employeeGrowthRateDelta}`,
              `investment.cooldownEndsOnTurn=${state.turn + 8}`,
            ]
          : [
              `companyRating ${result.companyRatingDelta}`,
              `investment.cooldownEndsOnTurn=${state.turn + 8}`,
            ],
        finalValue: result.success
          ? `투자금=${result.capitalDelta}만원, companyRating=${companyRating}`
          : `companyRating=${companyRating}`,
      },
    });

    if (result.success) {
      logs.push({
        message: '투자 유치 효과로 직원 사기와 성장 기대가 상승했습니다.',
        layer: 'deterministic',
        source: 'GameSession.resolveInvestmentEvent',
        layerTrace: {
          rule: '투자 유치 후 조직 사기 상승',
          trigger: '투자 유치 성공 후 후속 효과 적용',
          inputs: [
            `employeeCount=${state.employees.length}`,
            `loyaltyDelta=${result.employeeLoyaltyDelta}`,
            `growthRateDelta=${result.employeeGrowthRateDelta}`,
          ],
          effects: [
            '모든 재직 직원 commonStats.loyalty 상승',
            '모든 재직 직원 commonStats.growthRate 상승',
          ],
        },
      });
    }

    return {
      capital: state.capital + result.capitalDelta,
      companyRating,
      employees,
      investment,
      logs,
    };
  }
}
