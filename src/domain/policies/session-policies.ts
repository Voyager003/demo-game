import { EconomyLedger } from '../economy';
import { resolveEconomyDeterministicMetrics } from '../layers/deterministic-layer';
import { createEventLog } from '../logging';
import { EmployeeRoster } from '../employee';
import { ProjectPortfolio } from '../project';
import type { EndingGrade, GameState, GameStatus } from '../../types/core';
import type { Employee } from '../../types/employee';
import type { LogEntry, PendingEvent } from '../../types/event';
import type { Project } from '../../types/project';
import type { LayerTraceInput } from '../logging';
import type { IdGenerator } from '../generation';
import { TimestampIdGenerator } from '../generation';

export interface SessionLogSpec {
  message: string;
  layer?: LogEntry['layer'];
  source: string;
  layerTrace: LayerTraceInput;
}

export interface CrisisTransition {
  gameStatus: GameStatus;
  crisisGraceTurnsLeft: number;
  endingGrade: EndingGrade | null;
  logs: SessionLogSpec[];
}

export interface SettlementTransition {
  capital: number;
  activeProjects: Project[];
  logs: SessionLogSpec[];
}

export interface EventResolution {
  employees: Employee[];
  activeProjects: Project[];
  availableProjects: Project[];
  capital?: number;
  companyRating?: number;
  investment?: GameState['investment'];
  logs: SessionLogSpec[];
}

export class PendingEventFactory {
  private readonly ids: IdGenerator;

  constructor(ids: IdGenerator = new TimestampIdGenerator()) {
    this.ids = ids;
  }

  create(
    state: Pick<GameState, 'turn' | 'capital' | 'employees' | 'activeProjects' | 'pendingEvents' | 'investment'>,
  ): PendingEvent[] {
    const events: PendingEvent[] = [];
    const existingKeys = new Set(
      state.pendingEvents.map((event) => `${event.type}:${event.targetId ?? 'global'}`),
    );

    for (const employee of state.employees) {
      if (
        employee.probationTurnsLeft === 0 &&
        employee.employmentType === 'regular' &&
        !existingKeys.has(`probationConversion:${employee.id}`)
      ) {
        events.push({
          id: this.ids.next('evt_'),
          type: 'probationConversion',
          layer: 'deterministic',
          title: `${employee.name} 수습 전환`,
          description: `${employee.name}(${employee.role})의 수습 기간이 종료되었습니다. 정규직으로 전환하시겠습니까?`,
          choices: [
            { label: '정규직 전환', effect: '직원 유지, 충성도 +2' },
            { label: '계약 종료', effect: '직원 퇴사' },
          ],
          targetId: employee.id,
        });
      }

      const tenure = state.turn - employee.hiredOnTurn;
      if (
        employee.commonStats.loyalty <= 1 &&
        tenure > 0 &&
        tenure % 12 === 0 &&
        employee.probationTurnsLeft < 0 &&
        !existingKeys.has(`salaryNegotiation:${employee.id}`)
      ) {
        events.push({
          id: this.ids.next('evt_'),
          type: 'salaryNegotiation',
          layer: 'deterministic',
          title: `${employee.name} 연봉 협상 요청`,
          description: `${employee.name}이(가) 연봉 인상을 요청합니다. 현재 연봉: ${employee.salary.toLocaleString()}만원`,
          choices: [
            { label: '10% 인상 수락', effect: '충성도 +2, 연봉 +10%' },
            { label: '5% 인상 수락', effect: '충성도 +1, 연봉 +5%' },
            { label: '거절', effect: '충성도 -2' },
          ],
          targetId: employee.id,
        });
      }
    }

    for (const project of state.activeProjects) {
      const turnsRemaining = project.turnsRequired - project.turnsElapsed;
      if (
        project.status === 'active' &&
        turnsRemaining === 3 &&
        !existingKeys.has(`deadlineApproaching:${project.id}`)
      ) {
        events.push({
          id: this.ids.next('evt_'),
          type: 'deadlineApproaching',
          layer: 'deterministic',
          title: `납기 임박: ${project.name}`,
          description: `[${project.name}] 납기까지 ${turnsRemaining}턴 남았습니다. 현재 진척도: ${Math.round(project.progress)}%`,
          choices: [{ label: '확인', effect: '알림 확인' }],
          targetId: project.id,
        });
      }
    }

    if (state.capital <= 500 && state.capital > 0 && !existingKeys.has('capitalCrisis:global')) {
      events.push({
        id: this.ids.next('evt_'),
        type: 'capitalCrisis',
        layer: 'deterministic',
        title: '자본 위기 경고',
        description: `잔여 자본이 ${state.capital.toLocaleString()}만원입니다. 런웨이를 확인하세요.`,
        choices: [{ label: '확인', effect: '알림 확인' }],
      });
    }

    const pendingInvestmentResult = state.investment.pendingResult;
    if (
      state.investment.status === 'underReview'
      && pendingInvestmentResult
      && state.investment.reviewEndsOnTurn !== null
      && state.turn >= state.investment.reviewEndsOnTurn
      && !existingKeys.has('investmentResult:global')
    ) {
      events.push({
        id: this.ids.next('evt_'),
        type: 'investmentResult',
        layer: 'probabilistic',
        title: pendingInvestmentResult.success ? '투자 심사 통과' : '투자 심사 보류',
        description: pendingInvestmentResult.success
          ? `투자 심사가 완료되었습니다. 성공 확률 ${Math.round(pendingInvestmentResult.successProbability * 100)}%의 결과가 확정되었습니다.`
          : `투자 심사가 완료되었습니다. 성공 확률 ${Math.round(pendingInvestmentResult.successProbability * 100)}%였지만 이번 라운드는 실패했습니다.`,
        choices: [{ label: '결과 확인', effect: pendingInvestmentResult.success ? '투자금 수령 및 조직 사기 상승' : '회사 평가 하락 및 재도전 대기' }],
      });
    }

    return events;
  }
}

export class CrisisPolicy {
  evaluate(
    state: Pick<GameState, 'capital' | 'gameStatus' | 'crisisGraceTurnsLeft' | 'activeProjects' | 'endingGrade'>,
  ): CrisisTransition {
    if (state.capital > 0 && state.gameStatus === 'crisis') {
      return {
        gameStatus: 'playing',
        crisisGraceTurnsLeft: 0,
        endingGrade: state.endingGrade,
        logs: [{
          message: '위기를 벗어났습니다.',
          source: 'GameSession.updateCrisisState',
          layerTrace: {
            rule: '자본 회복 위기 해제',
            trigger: 'capital > 0이고 gameStatus=crisis',
            inputs: [`capital=${state.capital}만원`],
            effects: ['gameStatus=playing', 'crisisGraceTurnsLeft=0'],
          },
        }],
      };
    }

    if (state.capital <= 0 && state.gameStatus === 'playing') {
      const hasReceivables = state.activeProjects.some(
        (project) => project.status === 'completed' && !project.finalPaid,
      );
      const crisisGraceTurnsLeft = hasReceivables ? 8 : 4;
      return {
        gameStatus: 'crisis',
        crisisGraceTurnsLeft,
        endingGrade: state.endingGrade,
        logs: [{
          message: '자본 고갈! 위기 상태 진입. 유예 기간이 시작됩니다.',
          layer: 'chain',
          source: 'GameSession.updateCrisisState',
          layerTrace: {
            rule: '자본 고갈 위기 진입',
            trigger: 'capital <= 0이고 gameStatus=playing',
            inputs: [`capital=${state.capital}만원`, `hasReceivables=${hasReceivables}`],
            effects: ['gameStatus=crisis', `crisisGraceTurnsLeft=${crisisGraceTurnsLeft}`],
          },
        }],
      };
    }

    if (state.capital <= 0 && state.gameStatus === 'crisis') {
      const crisisGraceTurnsLeft = Math.max(0, state.crisisGraceTurnsLeft - 1);
      return {
        gameStatus: crisisGraceTurnsLeft === 0 ? 'ended' : 'crisis',
        crisisGraceTurnsLeft,
        endingGrade: crisisGraceTurnsLeft === 0 ? 'F' : state.endingGrade,
        logs: [],
      };
    }

    return {
      gameStatus: state.gameStatus,
      crisisGraceTurnsLeft: state.crisisGraceTurnsLeft,
      endingGrade: state.endingGrade,
      logs: [],
    };
  }
}

export class MonthlySettlementPolicy {
  apply(state: Pick<GameState, 'turn' | 'capital' | 'activeProjects' | 'employees'>): SettlementTransition {
    if (state.turn % 4 !== 0) {
      return {
        capital: state.capital,
        activeProjects: state.activeProjects,
        logs: [],
      };
    }

    let capital = state.capital;
    const logs: SessionLogSpec[] = [];
    const revenueResolution = resolveEconomyDeterministicMetrics(
      state.activeProjects,
      state.employees,
    );
    const baseRevenue = revenueResolution.baseRevenue;
    const recurringRevenue = revenueResolution.recurringRevenue.finalValue;
    const salaries = EconomyLedger.monthlySalaries(state.employees);
    const operating = EconomyLedger.monthlyOperatingCosts(state.employees.length);

    if (recurringRevenue > 0) {
      capital += recurringRevenue;
      const revenueMessage =
        recurringRevenue < baseRevenue
          ? `주수입원 매출 입금: +${recurringRevenue.toLocaleString()}만원 (기본 ${baseRevenue.toLocaleString()}만원 중 외주 투입으로 감소)`
          : `주수입원 매출 입금: +${recurringRevenue.toLocaleString()}만원`;
      logs.push({
        message: revenueMessage,
        source: 'GameSession.applyWeeklySettlement',
        layerTrace: {
          ...revenueResolution.recurringRevenue.trace,
          trigger: `turn=${state.turn}, ${revenueResolution.recurringRevenue.trace.trigger}`,
          effects: [
            ...revenueResolution.recurringRevenue.trace.effects,
            recurringRevenue < baseRevenue
              ? '외주 투입으로 주수입원 실효 매출 감소'
              : '주수입원 실효 매출이 기본 매출 이상 유지',
            'capital에 월 반복 실효 수입 입금',
            '주수입원 프로젝트는 완료/잔금 흐름에 포함하지 않음',
          ],
        },
      });
    }

    capital -= salaries + operating;
    logs.push({
      message: `인건비 차감: -${salaries.toLocaleString()}만원`,
      source: 'GameSession.applyWeeklySettlement',
      layerTrace: {
        rule: '월 인건비 정산',
        trigger: 'turn % 4 === 0 월 정산',
        inputs: [`employees=${state.employees.length}명`, `salaries=${salaries}만원`],
        effects: ['capital에서 직원별 월 환산 급여 합계 차감'],
      },
    });
    logs.push({
      message: `운영비 차감: -${operating.toLocaleString()}만원`,
      source: 'GameSession.applyWeeklySettlement',
      layerTrace: {
        rule: '월 운영비 정산',
        trigger: 'turn % 4 === 0 월 정산',
        inputs: [`employeeCount=${state.employees.length}`, `operating=${operating}만원`],
        effects: ['capital에서 기본 운영비와 인원 비례 운영비 차감'],
      },
    });

    const activeProjects = state.activeProjects.map((project) => {
      if (project.status !== 'completed' || project.finalPaid) return project;
      const payment = EconomyLedger.finalPayment(project);
      capital += payment;
      logs.push({
        message: `[${project.name}] 잔금 수령: +${payment.toLocaleString()}만원`,
        source: 'GameSession.applyWeeklySettlement',
        layerTrace: {
          rule: '완료 외주 프로젝트 잔금 정산',
          trigger: 'status=completed이고 finalPaid=false인 프로젝트 존재',
          inputs: [
            `project=${project.name}`,
            `totalAmount=${project.totalAmount}만원`,
            `clientSatisfaction=${project.clientSatisfaction}%`,
            `payment=${payment}만원`,
          ],
          effects: ['capital에 만족도 보정 잔금 입금', 'project.finalPaid=true'],
        },
      });
      return { ...project, finalPaid: true };
    });

    return {
      capital,
      activeProjects,
      logs,
    };
  }
}

export class ProbationEventResolver {
  resolve(
    employees: Employee[],
    activeProjects: Project[],
    availableProjects: Project[],
    employeeId: string,
    choiceIndex: number,
  ): EventResolution {
    const employee = employees.find((candidate) => candidate.id === employeeId);
    if (!employee) {
      return { employees, activeProjects, availableProjects, logs: [] };
    }

    if (choiceIndex === 0) {
      return {
        employees: employees.map((candidate) =>
          candidate.id === employeeId
            ? {
                ...candidate,
                probationTurnsLeft: -1,
                commonStats: {
                  ...candidate.commonStats,
                  loyalty: Math.min(5, candidate.commonStats.loyalty + 2),
                },
              }
            : candidate,
        ),
        activeProjects,
        availableProjects,
        logs: [{
          message: `${employee.name} 정규직 전환`,
          source: 'GameSession.resolveProbationEvent',
          layerTrace: {
            rule: '수습 종료 선택지: 정규직 전환',
            trigger: 'probationConversion 이벤트에서 choiceIndex=0 선택',
            inputs: [`employee=${employee.name}`, `employeeId=${employeeId}`, `choiceIndex=${choiceIndex}`],
            effects: ['employee.probationTurnsLeft=-1', 'employee.commonStats.loyalty +2'],
          },
        }],
      };
    }

    const nextEmployees = new EmployeeRoster(employees).remove(employeeId).toSnapshots();
    const portfolio = new ProjectPortfolio(activeProjects, availableProjects).removeEmployee(employeeId);
    const snapshots = portfolio.toSnapshots();
    return {
      employees: nextEmployees,
      activeProjects: snapshots.activeProjects,
      availableProjects: snapshots.availableProjects,
      logs: [{
        message: `${employee.name} 계약 종료`,
        source: 'GameSession.resolveProbationEvent',
        layerTrace: {
          rule: '수습 종료 선택지: 계약 종료',
          trigger: 'probationConversion 이벤트에서 정규직 전환 외 선택',
          inputs: [`employee=${employee.name}`, `employeeId=${employeeId}`, `choiceIndex=${choiceIndex}`],
          effects: ['employees에서 대상 직원 제거', '모든 프로젝트 assignedEmployeeIds에서 대상 직원 제거'],
        },
      }],
    };
  }
}

export class SalaryNegotiationResolver {
  resolve(
    employees: Employee[],
    activeProjects: Project[],
    availableProjects: Project[],
    employeeId: string,
    choiceIndex: number,
  ): EventResolution {
    const target = employees.find((employee) => employee.id === employeeId);
    if (!target) {
      return { employees, activeProjects, availableProjects, logs: [] };
    }

    const oldSalary = target.salary;
    const nextEmployees = employees.map((employee) => {
      if (employee.id !== employeeId) return employee;
      if (choiceIndex === 0) {
        return {
          ...employee,
          salary: Math.round(employee.salary * 1.1),
          commonStats: {
            ...employee.commonStats,
            loyalty: Math.min(5, employee.commonStats.loyalty + 2),
          },
        };
      }
      if (choiceIndex === 1) {
        return {
          ...employee,
          salary: Math.round(employee.salary * 1.05),
          commonStats: {
            ...employee.commonStats,
            loyalty: Math.min(5, employee.commonStats.loyalty + 1),
          },
        };
      }
      return {
        ...employee,
        commonStats: {
          ...employee.commonStats,
          loyalty: Math.max(-1, employee.commonStats.loyalty - 2),
        },
      };
    });

    const updated = nextEmployees.find((employee) => employee.id === employeeId)!;
    const effect =
      choiceIndex === 0
        ? '연봉 10% 인상, loyalty +2'
        : choiceIndex === 1
          ? '연봉 5% 인상, loyalty +1'
          : '연봉 유지, loyalty -2';

    return {
      employees: nextEmployees,
      activeProjects,
      availableProjects,
      logs: [{
        message: `${updated.name} 연봉 협상 처리: ${effect}`,
        source: 'GameSession.resolveSalaryEvent',
        layerTrace: {
          rule: '연봉 협상 선택지 처리',
          trigger: 'salaryNegotiation 이벤트 선택',
          inputs: [
            `employee=${updated.name}`,
            `employeeId=${employeeId}`,
            `choiceIndex=${choiceIndex}`,
            `oldSalary=${oldSalary}만원`,
            `newSalary=${updated.salary}만원`,
          ],
          effects: [effect],
        },
      }],
    };
  }
}

export interface SessionPolicies {
  pendingEventFactory: PendingEventFactory;
  crisisPolicy: CrisisPolicy;
  monthlySettlementPolicy: MonthlySettlementPolicy;
  probationEventResolver: ProbationEventResolver;
  salaryNegotiationResolver: SalaryNegotiationResolver;
}

export function appendSessionLogs(
  turn: number,
  currentLogs: LogEntry[],
  logs: SessionLogSpec[],
): LogEntry[] {
  return [
    ...currentLogs,
    ...logs.map((log) =>
      createEventLog({
        turn,
        message: log.message,
        layer: log.layer,
        source: log.source,
        layerTrace: log.layerTrace,
      }),
    ),
  ];
}

export const defaultSessionPolicies: SessionPolicies = {
  pendingEventFactory: new PendingEventFactory(),
  crisisPolicy: new CrisisPolicy(),
  monthlySettlementPolicy: new MonthlySettlementPolicy(),
  probationEventResolver: new ProbationEventResolver(),
  salaryNegotiationResolver: new SalaryNegotiationResolver(),
};
