import { DOMAIN_INITIAL_STATS } from '../constants/domainStats';
import { EmployeeRoster, createFounder } from './employee';
import { EconomyLedger } from './economy';
import { FatigueMeter } from './fatigue';
import { resolveEconomyDeterministicMetrics } from './layers/deterministic-layer';
import { createEventLog, createFunctionLog } from './logging';
import { ProjectPortfolio, generateInitialProjects, generateMainRevenueProject } from './project';
import { TurnCycle } from './turn-cycle';
import type { ActionType, GameState } from '../types/core';
import type { Domain } from '../types/ceo';
import type { FunctionExecutionLogEntry } from '../types/debug';
import type { Employee } from '../types/employee';
import type { LogEntry, PendingEvent } from '../types/event';
import type { LayerTraceInput } from './logging';

const INITIAL_REPUTATION = 20;

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeEventId(): string {
  return 'evt_' + Math.random().toString(36).slice(2, 9);
}

export class GameSession {
  private state: GameState;
  private functionLogs: FunctionExecutionLogEntry[] = [];
  private functionLogSequence = 0;

  constructor(state: GameState) {
    this.state = cloneState(state);
  }

  static startNewGame(domain: Domain, companyName: string, foundingMember: Employee): GameSession {
    const stats = DOMAIN_INITIAL_STATS[domain];
    const fatigue = FatigueMeter.startTurn(stats.leadership).toSnapshot();
    const founderBase = createFounder(foundingMember);
    const mainRevenueProjectBase = generateMainRevenueProject(domain);

    // 창업 멤버를 주수입원에 자동 배정
    const mainRevenueProject = {
      ...mainRevenueProjectBase,
      assignedEmployeeIds: [founderBase.id],
    };
    const founder = {
      ...founderBase,
      projectAssignments: { [mainRevenueProject.id]: 100 },
    };

    const session = new GameSession({
      turn: 1,
      phase: 1,
      companyName,
      ceo: { domain, stats },
      capital: 2000,
      fatigue,
      employees: [founder],
      pendingResumes: [],
      activeProjects: [mainRevenueProject],
      availableProjects: generateInitialProjects(),
      completedProjectCount: 0,
      eventLog: [
        createEventLog({
          turn: 1,
          message: `${founder.name}(개발자)이(가) 공동 창업 멤버로 합류했습니다.`,
          source: 'GameSession.startNewGame',
          layerTrace: {
            rule: '창업 멤버 초기 합류',
            trigger: '새 게임 시작 시 선택한 창업 멤버가 회사 직원 목록에 등록됨',
            inputs: [
              `founder=${founder.name}`,
              `role=${founder.role}`,
              'probationTurnsLeft=-1',
            ],
            effects: [
              'employees에 창업 멤버 1명 추가',
              '창업 멤버 수습 기간 제거',
              '창업 멤버 충성도 +2 보정',
            ],
          },
        }),
        createEventLog({
          turn: 1,
          message: `[${mainRevenueProject.name}] 회사 주수입원으로 등록되었습니다.`,
          source: 'GameSession.startNewGame',
          layerTrace: {
            rule: '도메인 기반 주수입원 등록',
            trigger: '새 게임 시작 시 선택 도메인으로 자체 서비스 프로젝트 생성',
            inputs: [
              `domain=${domain}`,
              `project=${mainRevenueProject.name}`,
              `monthlyRevenue=${mainRevenueProject.monthlyRevenue}만원`,
            ],
            effects: [
              'activeProjects에 ownedProduct 주수입원 추가',
              'status=operating으로 설정',
              '창업 멤버를 주수입원 assignedEmployeeIds에 자동 배정',
              '4턴마다 월 반복 수입 정산 대상 등록',
            ],
          },
        }),
        createEventLog({
          turn: 1,
          message: `${founder.name}이(가) 주수입원에 자동 배정되었습니다.`,
          source: 'GameSession.startNewGame',
          layerTrace: {
            rule: '창업 멤버 주수입원 자동 배정',
            trigger: '새 게임 시작 시 창업 멤버가 회사 주수입원 운영 인력으로 등록됨',
            inputs: [
              `founder=${founder.name}`,
              `project=${mainRevenueProject.name}`,
              'assignment=100%',
            ],
            effects: [
              'mainRevenueProject.assignedEmployeeIds에 창업 멤버 ID 추가',
              'founder.projectAssignments에 주수입원 100% 배정 기록',
            ],
          },
        }),
      ],
      pendingEvents: [],
      gameStatus: 'playing',
      crisisGraceTurnsLeft: 0,
      endingGrade: null,
    });
    session.traceFunction('GameSession.startNewGame', `domain=${domain}`);
    return session;
  }

  canPerform(action: ActionType): boolean {
    return new FatigueMeter(this.state.fatigue).canPerform(action);
  }

  advancePhase(): GameSession {
    this.traceFunction('GameSession.advancePhase');
    if (this.state.phase === 1) {
      const next = new TurnCycle(this.state.turn, this.state.phase).toDecisionPhase();
      this.state.pendingEvents = [
        ...this.state.pendingEvents,
        ...this.generatePendingEvents(),
      ];
      this.state.phase = next.phase;
      return this;
    }

    if (this.state.phase === 2) {
      return this.runAutomaticPhases();
    }

    if (this.state.phase === 5) {
      const next = new TurnCycle(this.state.turn, this.state.phase).startNextTurn();
      const portfolio = new ProjectPortfolio(
        this.state.activeProjects,
        this.state.availableProjects,
      ).replenishAvailable();
      const snapshots = portfolio.toSnapshots();
      this.state = {
        ...this.state,
        turn: next.turn,
        phase: next.phase,
        fatigue: new FatigueMeter(this.state.fatigue)
          .resetForLeadership(this.state.ceo.stats.leadership)
          .toSnapshot(),
        activeProjects: snapshots.activeProjects,
        availableProjects: snapshots.availableProjects,
      };
    }

    return this;
  }

  endTurn(): GameSession {
    this.traceFunction('GameSession.endTurn');
    if (this.state.phase !== 2) return this;
    return this.runAutomaticPhases();
  }

  postJobListing(): GameSession {
    this.traceFunction('GameSession.postJobListing');
    if (!this.spendAction('postJobListing')) return this;
    const resumes = EmployeeRoster.generateResumes(
      randInt(3, 5),
      INITIAL_REPUTATION,
      this.state.turn,
    );
    this.state.pendingResumes = resumes;
    this.addLog(`채용 공고 게시 — 이력서 ${resumes.length}장 수집됨`, 'deterministic', {
      source: 'GameSession.postJobListing',
      layerTrace: {
        rule: '채용 공고 실행',
        trigger: 'postJobListing 액션 성공',
        inputs: [
          `reputation=${INITIAL_REPUTATION}`,
          `turn=${this.state.turn}`,
          `generatedResumes=${resumes.length}장`,
        ],
        effects: [
          'pendingResumes를 새 이력서 목록으로 교체',
          'postJobListing 피로도/쿨타임 적용',
        ],
      },
    });
    return this;
  }

  conductInterview(candidateId: string): GameSession {
    this.traceFunction('GameSession.conductInterview', `candidateId=${candidateId}`);
    const candidate = this.state.pendingResumes.find((resume) => resume.id === candidateId);
    if (!candidate || !this.spendAction('conductInterview')) return this;
    this.state.pendingResumes = this.state.pendingResumes.filter((resume) => resume.id !== candidateId);
    this.state.employees = new EmployeeRoster(this.state.employees).add(candidate).toSnapshots();
    this.addLog(`${candidate.name}(${candidate.role}) 채용 확정`, 'deterministic', {
      source: 'GameSession.conductInterview',
      layerTrace: {
        rule: '면접 후보 채용 확정',
        trigger: '선택한 candidateId가 pendingResumes에 있고 면접 액션이 성공',
        inputs: [
          `candidate=${candidate.name}`,
          `role=${candidate.role}`,
          `salary=${candidate.salary}만원`,
        ],
        effects: [
          'pendingResumes에서 후보 제거',
          'employees에 후보 추가',
          'conductInterview 피로도 적용',
        ],
      },
    });

    const mainProject = this.state.activeProjects.find((project) => project.isMainRevenue);
    if (mainProject) {
      const newIds = [...mainProject.assignedEmployeeIds, candidate.id];
      const portfolio = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects)
        .setAssignments(mainProject.id, newIds);
      const snapshots = portfolio.toSnapshots();
      this.state.activeProjects = snapshots.activeProjects;
      this.state.availableProjects = snapshots.availableProjects;
      this.state.employees = new EmployeeRoster(this.state.employees)
        .setProjectAssignments(mainProject.id, newIds)
        .toSnapshots();
      this.addLog(`${candidate.name}이(가) 주수입원에 자동 배정되었습니다.`, 'deterministic', {
        source: 'GameSession.conductInterview',
        layerTrace: {
          rule: '신규 직원 주수입원 자동 배정',
          trigger: '면접 채용 확정 후 operating 상태의 주수입원 프로젝트가 존재',
          inputs: [
            `employee=${candidate.name}`,
            `project=${mainProject.name}`,
            `assignedEmployeesBefore=${mainProject.assignedEmployeeIds.length}명`,
          ],
          effects: [
            'mainRevenueProject.assignedEmployeeIds에 신규 직원 ID 추가',
            'employee.projectAssignments에 주수입원 100% 배정 기록',
            '주수입원 실효 매출 계산 대상에 신규 직원 포함',
          ],
        },
      });
    }
    return this;
  }

  fireEmployee(employeeId: string): GameSession {
    this.traceFunction('GameSession.fireEmployee', `employeeId=${employeeId}`);
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);
    if (!employee || !this.spendAction('fireEmployee')) return this;
    this.state.employees = new EmployeeRoster(this.state.employees).remove(employeeId).toSnapshots();
    const portfolio = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects).removeEmployee(employeeId);
    const snapshots = portfolio.toSnapshots();
    this.state.activeProjects = snapshots.activeProjects;
    this.state.availableProjects = snapshots.availableProjects;
    this.addLog(`${employee.name} 해고`, 'deterministic', {
      source: 'GameSession.fireEmployee',
      layerTrace: {
        rule: '직원 해고 및 프로젝트 배정 제거',
        trigger: 'fireEmployee 액션 성공',
        inputs: [
          `employee=${employee.name}`,
          `employeeId=${employeeId}`,
          `role=${employee.role}`,
        ],
        effects: [
          'employees에서 대상 직원 제거',
          '모든 프로젝트 assignedEmployeeIds에서 대상 직원 제거',
          'fireEmployee 피로도/쿨타임 적용',
        ],
      },
    });
    return this;
  }

  adjustSalary(employeeId: string, newSalary: number): GameSession {
    this.traceFunction('GameSession.adjustSalary', `employeeId=${employeeId}`);
    const target = this.state.employees.find((candidate) => candidate.id === employeeId);
    if (!target || !this.spendAction('adjustSalary')) return this;
    const oldSalary = target.salary;
    this.state.employees = this.state.employees.map((employee) => {
      if (employee.id !== employeeId) return employee;
      const loyaltyDelta = newSalary > employee.salary ? 1 : 0;
      return {
        ...employee,
        salary: newSalary,
        commonStats: {
          ...employee.commonStats,
          loyalty: Math.min(5, employee.commonStats.loyalty + loyaltyDelta),
        },
      };
    });
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);
    if (employee) {
      this.addLog(`${employee.name} 연봉 조정: ${newSalary.toLocaleString()}만원`, 'deterministic', {
        source: 'GameSession.adjustSalary',
        layerTrace: {
          rule: '수동 연봉 조정',
          trigger: 'adjustSalary 액션 성공',
          inputs: [
            `employee=${employee.name}`,
            `oldSalary=${oldSalary}만원`,
            `newSalary=${newSalary}만원`,
          ],
          effects: [
            'employee.salary를 입력값으로 변경',
            newSalary > oldSalary ? '연봉 인상으로 loyalty +1' : '연봉 인상이 아니므로 loyalty 변화 없음',
            'adjustSalary 피로도/쿨타임 적용',
          ],
        },
      });
    }
    return this;
  }

  signContract(projectId: string): GameSession {
    this.traceFunction('GameSession.signContract', `projectId=${projectId}`);
    const result = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects).signContract(projectId);
    if (!result || !this.spendAction('signContract')) return this;
    const snapshots = result.portfolio.toSnapshots();
    this.state.activeProjects = snapshots.activeProjects;
    this.state.availableProjects = snapshots.availableProjects;
    this.state.capital += result.advance;
    this.addLog(`[${result.projectName}] 계약 체결 — 선금 +${result.advance.toLocaleString()}만원`, 'deterministic', {
      source: 'GameSession.signContract',
      layerTrace: {
        rule: '외주 계약 체결 선금 지급',
        trigger: 'availableProjects에서 선택한 projectId 계약 성공',
        inputs: [
          `project=${result.projectName}`,
          `advance=${result.advance}만원`,
          `projectId=${projectId}`,
        ],
        effects: [
          'availableProjects에서 프로젝트 제거',
          'activeProjects에 status=active 프로젝트 추가',
          'capital에 총액의 30% 선금 입금',
          'signContract 피로도/쿨타임 적용',
        ],
      },
    });
    return this;
  }

  changeAssignment(employeeId: string, projectId: string, percentage: number): GameSession {
    this.traceFunction(
      'GameSession.changeAssignment',
      `employeeId=${employeeId}, projectId=${projectId}, percentage=${percentage}`,
    );
    const project = this.state.activeProjects.find((candidate) => candidate.id === projectId);
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);
    if (!project || !employee || !this.spendAction('changeAssignment')) return this;
    const employeeIds =
      percentage > 0
        ? [...new Set([...project.assignedEmployeeIds, employeeId])]
        : project.assignedEmployeeIds.filter((id) => id !== employeeId);
    return this.applyAssignments(projectId, employeeIds);
  }

  setProjectAssignments(projectId: string, employeeIds: string[]): GameSession {
    this.traceFunction(
      'GameSession.setProjectAssignments',
      `projectId=${projectId}, employeeCount=${employeeIds.length}`,
    );
    const project = this.state.activeProjects.find((candidate) => candidate.id === projectId);
    if (!project || !this.spendAction('changeAssignment')) return this;
    return this.applyAssignments(projectId, employeeIds);
  }

  orderOvertime(projectId: string): GameSession {
    this.traceFunction('GameSession.orderOvertime', `projectId=${projectId}`);
    const project = this.state.activeProjects.find((candidate) => candidate.id === projectId);
    if (!project || !this.spendAction('orderOvertime')) return this;
    const portfolio = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects).orderOvertime(projectId);
    const snapshots = portfolio.toSnapshots();
    this.state.activeProjects = snapshots.activeProjects;
    this.state.availableProjects = snapshots.availableProjects;
    this.addLog(`[${project.name}] 야근 지시`, 'deterministic', {
      source: 'GameSession.orderOvertime',
      layerTrace: {
        rule: '프로젝트 야근 플래그 적용',
        trigger: 'orderOvertime 액션 성공',
        inputs: [
          `project=${project.name}`,
          `projectId=${projectId}`,
          `assignedEmployees=${project.assignedEmployeeIds.length}명`,
        ],
        effects: [
          '해당 active 프로젝트 overtimeActive=true',
          '다음 자동 실행에서 진척도 1.25배 적용',
          '배정 직원은 턴 종료 시 HP 감소 대상',
          'orderOvertime 피로도/쿨타임 적용',
        ],
      },
    });
    return this;
  }

  resolveEvent(eventId: string, choiceIndex: number): GameSession {
    this.traceFunction('GameSession.resolveEvent', `eventId=${eventId}, choiceIndex=${choiceIndex}`);
    const event = this.state.pendingEvents.find((candidate) => candidate.id === eventId);
    if (!event) return this;
    this.state.pendingEvents = this.state.pendingEvents.filter((candidate) => candidate.id !== eventId);

    if (event.type === 'probationConversion' && event.targetId) {
      this.resolveProbationEvent(event.targetId, choiceIndex);
    }

    if (event.type === 'salaryNegotiation' && event.targetId) {
      this.resolveSalaryEvent(event.targetId, choiceIndex);
    }

    return this;
  }

  toState(): GameState {
    return cloneState(this.state);
  }

  drainFunctionLogs(): FunctionExecutionLogEntry[] {
    const logs = this.functionLogs;
    this.functionLogs = [];
    return logs;
  }

  private spendAction(action: ActionType): boolean {
    this.traceFunction('GameSession.spendAction', `action=${action}`);
    const fatigue = new FatigueMeter(this.state.fatigue);
    if (!fatigue.canPerform(action) || this.state.phase !== 2) return false;
    this.state.fatigue = fatigue.spend(action).toSnapshot();
    return true;
  }

  private applyAssignments(projectId: string, employeeIds: string[]): GameSession {
    this.traceFunction(
      'GameSession.applyAssignments',
      `projectId=${projectId}, employeeCount=${employeeIds.length}`,
    );
    const portfolio = new ProjectPortfolio(
      this.state.activeProjects,
      this.state.availableProjects,
    ).setAssignments(projectId, employeeIds);
    const snapshots = portfolio.toSnapshots();
    this.state.activeProjects = snapshots.activeProjects;
    this.state.availableProjects = snapshots.availableProjects;
    this.state.employees = new EmployeeRoster(this.state.employees)
      .setProjectAssignments(projectId, employeeIds)
      .toSnapshots();
    const project = this.state.activeProjects.find((candidate) => candidate.id === projectId);
    if (project) {
      this.addLog(`[${project.name}] 인력 배정 변경 — ${employeeIds.length}명`, 'deterministic', {
        source: 'GameSession.applyAssignments',
        layerTrace: {
          rule: '프로젝트 인력 배정 동기화',
          trigger: 'changeAssignment 또는 setProjectAssignments 액션 성공',
          inputs: [
            `project=${project.name}`,
            `projectId=${projectId}`,
            `employeeCount=${employeeIds.length}`,
          ],
          effects: [
            'project.assignedEmployeeIds를 선택 직원 목록으로 교체',
            '각 employee.projectAssignments에 프로젝트 배정 100% 또는 제거 반영',
            'changeAssignment 피로도 적용',
          ],
        },
      });
    }
    return this;
  }

  private runAutomaticPhases(): GameSession {
    this.traceFunction('GameSession.runAutomaticPhases');
    this.state.phase = new TurnCycle(this.state.turn, this.state.phase).toExecutionPhase().phase;
    const portfolio = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects);
    const progress = portfolio.advanceWeek(this.state.employees);
    this.state.activeProjects = progress.projects;
    this.state.completedProjectCount += progress.completedProjects.length;
    this.state.employees = new EmployeeRoster(this.state.employees)
      .applyOvertime(progress.overtimeEmployeeIds)
      .tickWeek()
      .toSnapshots();
    this.state.fatigue = new FatigueMeter(this.state.fatigue).decrementCooldowns().toSnapshot();
    for (const log of progress.logs) {
      this.addLog(log.message, 'deterministic', {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }

    this.state.phase = new TurnCycle(this.state.turn, this.state.phase).toSettlementPhase().phase;
    this.applyWeeklySettlement();
    this.updateCrisisState();

    this.state.phase = new TurnCycle(this.state.turn, this.state.phase).toReportPhase().phase;
    return this;
  }

  private applyWeeklySettlement(): void {
    this.traceFunction('GameSession.applyWeeklySettlement');
    if (this.state.turn % 4 !== 0) return;
    const revenueResolution = resolveEconomyDeterministicMetrics(
      this.state.activeProjects,
      this.state.employees,
    );
    const baseRevenue = revenueResolution.baseRevenue;
    const recurringRevenue = revenueResolution.recurringRevenue.finalValue;
    const salaries = EconomyLedger.monthlySalaries(this.state.employees);
    const operating = EconomyLedger.monthlyOperatingCosts(this.state.employees.length);
    if (recurringRevenue > 0) {
      this.state.capital += recurringRevenue;
      const revenueMessage =
        recurringRevenue < baseRevenue
          ? `주수입원 매출 입금: +${recurringRevenue.toLocaleString()}만원 (기본 ${baseRevenue.toLocaleString()}만원 중 외주 투입으로 감소)`
          : `주수입원 매출 입금: +${recurringRevenue.toLocaleString()}만원`;
      this.addLog(revenueMessage, 'deterministic', {
        source: 'GameSession.applyWeeklySettlement',
        layerTrace: {
          ...revenueResolution.recurringRevenue.trace,
          trigger: `turn=${this.state.turn}, ${revenueResolution.recurringRevenue.trace.trigger}`,
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
    this.state.capital -= salaries + operating;
    this.addLog(`인건비 차감: -${salaries.toLocaleString()}만원`, 'deterministic', {
      source: 'GameSession.applyWeeklySettlement',
      layerTrace: {
        rule: '월 인건비 정산',
        trigger: 'turn % 4 === 0 월 정산',
        inputs: [
          `employees=${this.state.employees.length}명`,
          `salaries=${salaries}만원`,
        ],
        effects: [
          'capital에서 직원별 월 환산 급여 합계 차감',
        ],
      },
    });
    this.addLog(`운영비 차감: -${operating.toLocaleString()}만원`, 'deterministic', {
      source: 'GameSession.applyWeeklySettlement',
      layerTrace: {
        rule: '월 운영비 정산',
        trigger: 'turn % 4 === 0 월 정산',
        inputs: [
          `employeeCount=${this.state.employees.length}`,
          `operating=${operating}만원`,
        ],
        effects: [
          'capital에서 기본 운영비와 인원 비례 운영비 차감',
        ],
      },
    });

    const completedUnpaid = this.state.activeProjects.filter(
      (project) => project.status === 'completed' && !project.finalPaid,
    );

    this.state.activeProjects = this.state.activeProjects.map((project) => {
      if (!completedUnpaid.some((completed) => completed.id === project.id)) return project;
      const payment = EconomyLedger.finalPayment(project);
      this.state.capital += payment;
      this.addLog(`[${project.name}] 잔금 수령: +${payment.toLocaleString()}만원`, 'deterministic', {
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
          effects: [
            'capital에 만족도 보정 잔금 입금',
            'project.finalPaid=true',
          ],
        },
      });
      return { ...project, finalPaid: true };
    });
  }

  private updateCrisisState(): void {
    this.traceFunction('GameSession.updateCrisisState');
    if (this.state.capital > 0 && this.state.gameStatus === 'crisis') {
      this.state.gameStatus = 'playing';
      this.state.crisisGraceTurnsLeft = 0;
      this.addLog('위기를 벗어났습니다.', 'deterministic', {
        source: 'GameSession.updateCrisisState',
        layerTrace: {
          rule: '자본 회복 위기 해제',
          trigger: 'capital > 0이고 gameStatus=crisis',
          inputs: [
            `capital=${this.state.capital}만원`,
          ],
          effects: [
            'gameStatus=playing',
            'crisisGraceTurnsLeft=0',
          ],
        },
      });
      return;
    }

    if (this.state.capital <= 0 && this.state.gameStatus === 'playing') {
      const hasReceivables = this.state.activeProjects.some(
        (project) => project.status === 'completed' && !project.finalPaid,
      );
      this.state.gameStatus = 'crisis';
      this.state.crisisGraceTurnsLeft = hasReceivables ? 8 : 4;
      this.addLog('자본 고갈! 위기 상태 진입. 유예 기간이 시작됩니다.', 'chain', {
        source: 'GameSession.updateCrisisState',
        layerTrace: {
          rule: '자본 고갈 위기 진입',
          trigger: 'capital <= 0이고 gameStatus=playing',
          inputs: [
            `capital=${this.state.capital}만원`,
            `hasReceivables=${hasReceivables}`,
          ],
          effects: [
            'gameStatus=crisis',
            `crisisGraceTurnsLeft=${this.state.crisisGraceTurnsLeft}`,
          ],
        },
      });
      return;
    }

    if (this.state.capital <= 0 && this.state.gameStatus === 'crisis') {
      this.state.crisisGraceTurnsLeft = Math.max(0, this.state.crisisGraceTurnsLeft - 1);
      if (this.state.crisisGraceTurnsLeft === 0) {
        this.state.gameStatus = 'ended';
        this.state.endingGrade = 'F';
      }
    }
  }

  private generatePendingEvents(): PendingEvent[] {
    this.traceFunction('GameSession.generatePendingEvents');
    const events: PendingEvent[] = [];
    const existingKeys = new Set(
      this.state.pendingEvents.map((event) => `${event.type}:${event.targetId ?? 'global'}`),
    );

    for (const employee of this.state.employees) {
      if (
        employee.probationTurnsLeft === 0 &&
        employee.employmentType === 'regular' &&
        !existingKeys.has(`probationConversion:${employee.id}`)
      ) {
        events.push({
          id: makeEventId(),
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

      const tenure = this.state.turn - employee.hiredOnTurn;
      if (
        employee.commonStats.loyalty <= 1 &&
        tenure > 0 &&
        tenure % 12 === 0 &&
        employee.probationTurnsLeft < 0 &&
        !existingKeys.has(`salaryNegotiation:${employee.id}`)
      ) {
        events.push({
          id: makeEventId(),
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

    for (const project of this.state.activeProjects) {
      const turnsRemaining = project.turnsRequired - project.turnsElapsed;
      if (
        project.status === 'active' &&
        turnsRemaining === 3 &&
        !existingKeys.has(`deadlineApproaching:${project.id}`)
      ) {
        events.push({
          id: makeEventId(),
          type: 'deadlineApproaching',
          layer: 'deterministic',
          title: `납기 임박: ${project.name}`,
          description: `[${project.name}] 납기까지 ${turnsRemaining}턴 남았습니다. 현재 진척도: ${Math.round(project.progress)}%`,
          choices: [{ label: '확인', effect: '알림 확인' }],
          targetId: project.id,
        });
      }
    }

    if (this.state.capital <= 500 && this.state.capital > 0 && !existingKeys.has('capitalCrisis:global')) {
      events.push({
        id: makeEventId(),
        type: 'capitalCrisis',
        layer: 'deterministic',
        title: '자본 위기 경고',
        description: `잔여 자본이 ${this.state.capital.toLocaleString()}만원입니다. 런웨이를 확인하세요.`,
        choices: [{ label: '확인', effect: '알림 확인' }],
      });
    }

    return events;
  }

  private resolveProbationEvent(employeeId: string, choiceIndex: number): void {
    this.traceFunction(
      'GameSession.resolveProbationEvent',
      `employeeId=${employeeId}, choiceIndex=${choiceIndex}`,
    );
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);
    if (!employee) return;
    if (choiceIndex === 0) {
      this.state.employees = this.state.employees.map((candidate) =>
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
      );
      this.addLog(`${employee.name} 정규직 전환`, 'deterministic', {
        source: 'GameSession.resolveProbationEvent',
        layerTrace: {
          rule: '수습 종료 선택지: 정규직 전환',
          trigger: 'probationConversion 이벤트에서 choiceIndex=0 선택',
          inputs: [
            `employee=${employee.name}`,
            `employeeId=${employeeId}`,
            `choiceIndex=${choiceIndex}`,
          ],
          effects: [
            'employee.probationTurnsLeft=-1',
            'employee.commonStats.loyalty +2',
          ],
        },
      });
      return;
    }

    this.state.employees = new EmployeeRoster(this.state.employees).remove(employeeId).toSnapshots();
    const portfolio = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects).removeEmployee(employeeId);
    const snapshots = portfolio.toSnapshots();
    this.state.activeProjects = snapshots.activeProjects;
    this.state.availableProjects = snapshots.availableProjects;
    this.addLog(`${employee.name} 계약 종료`, 'deterministic', {
      source: 'GameSession.resolveProbationEvent',
      layerTrace: {
        rule: '수습 종료 선택지: 계약 종료',
        trigger: 'probationConversion 이벤트에서 정규직 전환 외 선택',
        inputs: [
          `employee=${employee.name}`,
          `employeeId=${employeeId}`,
          `choiceIndex=${choiceIndex}`,
        ],
        effects: [
          'employees에서 대상 직원 제거',
          '모든 프로젝트 assignedEmployeeIds에서 대상 직원 제거',
        ],
      },
    });
  }

  private resolveSalaryEvent(employeeId: string, choiceIndex: number): void {
    this.traceFunction(
      'GameSession.resolveSalaryEvent',
      `employeeId=${employeeId}, choiceIndex=${choiceIndex}`,
    );
    const target = this.state.employees.find((employee) => employee.id === employeeId);
    if (!target) return;
    const oldSalary = target.salary;
    this.state.employees = this.state.employees.map((employee) => {
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
    const updated = this.state.employees.find((employee) => employee.id === employeeId);
    if (!updated) return;
    const effect =
      choiceIndex === 0
        ? '연봉 10% 인상, loyalty +2'
        : choiceIndex === 1
        ? '연봉 5% 인상, loyalty +1'
        : '연봉 유지, loyalty -2';
    this.addLog(`${updated.name} 연봉 협상 처리: ${effect}`, 'deterministic', {
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
        effects: [
          effect,
        ],
      },
    });
  }

  private addLog(
    message: string,
    layer: LogEntry['layer'] = 'deterministic',
    options: {
      source?: string;
      layerTrace?: LayerTraceInput;
    } = {},
  ): void {
    this.state.eventLog.push(
      createEventLog({
        turn: this.state.turn,
        message,
        layer,
        source: options.source,
        layerTrace: options.layerTrace,
      }),
    );
  }

  private traceFunction(functionName: string, detail?: string): void {
    this.functionLogs.push(createFunctionLog({
      functionName,
      turn: this.state.turn,
      phase: this.state.phase,
      sequence: this.functionLogSequence++,
      detail,
    }));
  }
}
