import { DOMAIN_INITIAL_STATS } from '../constants/domainStats';
import { EmployeeRoster, createFounder } from './employee';
import { FatigueMeter } from './fatigue';
import { createGameSessionDependencies, type GameSessionDependencies } from './game-session-dependencies';
import { createEventLog, createFunctionLog } from './logging';
import { ProjectPortfolio } from './project';
import { TurnPhase } from './turn-phase';
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

export class GameSession {
  private state: GameState;
  private functionLogs: FunctionExecutionLogEntry[] = [];
  private functionLogSequence = 0;
  private readonly deps: GameSessionDependencies;

  constructor(state: GameState, deps: Partial<GameSessionDependencies> = {}) {
    this.state = cloneState(state);
    this.deps = createGameSessionDependencies(deps);
  }

  static startNewGame(
    domain: Domain,
    companyName: string,
    foundingMember: Employee,
    deps: Partial<GameSessionDependencies> = {},
  ): GameSession {
    const resolvedDeps = createGameSessionDependencies(deps);
    const stats = DOMAIN_INITIAL_STATS[domain];
    const fatigue = FatigueMeter.startTurn(stats.leadership).toSnapshot();
    const founderBase = createFounder(foundingMember);
    const mainRevenueProjectBase = resolvedDeps.projectFactory.generateMainRevenueProject(domain);

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
      availableProjects: resolvedDeps.projectFactory.generateInitialProjects(),
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
    }, resolvedDeps);
    session.traceFunction('GameSession.startNewGame', `domain=${domain}`);
    return session;
  }

  canPerform(action: ActionType): boolean {
    return new FatigueMeter(this.state.fatigue).canPerform(action);
  }

  advancePhase(): GameSession {
    this.traceFunction('GameSession.advancePhase');
    const phase = TurnPhase.from(this.state.phase);
    if (phase.isSetup()) {
      const next = new TurnCycle(this.state.turn, this.state.phase).toDecisionPhase();
      this.state.pendingEvents = [
        ...this.state.pendingEvents,
        ...this.generatePendingEvents(),
      ];
      this.state.phase = next.phase;
      return this;
    }

    if (phase.isDecision()) {
      return this.runAutomaticPhases();
    }

    if (phase.isReport()) {
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
    const resumes = this.deps.employeeFactory.generateResumes(
      this.deps.random.nextInt(3, 5),
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
    const transition = this.deps.monthlySettlementPolicy.apply({
      turn: this.state.turn,
      capital: this.state.capital,
      activeProjects: this.state.activeProjects,
      employees: this.state.employees,
    });
    this.state.capital = transition.capital;
    this.state.activeProjects = transition.activeProjects;
    for (const log of transition.logs) {
      this.addLog(log.message, log.layer ?? 'deterministic', {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }
  }

  private updateCrisisState(): void {
    this.traceFunction('GameSession.updateCrisisState');
    const transition = this.deps.crisisPolicy.evaluate({
      capital: this.state.capital,
      gameStatus: this.state.gameStatus,
      crisisGraceTurnsLeft: this.state.crisisGraceTurnsLeft,
      activeProjects: this.state.activeProjects,
      endingGrade: this.state.endingGrade,
    });
    this.state.gameStatus = transition.gameStatus;
    this.state.crisisGraceTurnsLeft = transition.crisisGraceTurnsLeft;
    this.state.endingGrade = transition.endingGrade;
    for (const log of transition.logs) {
      this.addLog(log.message, log.layer ?? 'deterministic', {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }
  }

  private generatePendingEvents(): PendingEvent[] {
    this.traceFunction('GameSession.generatePendingEvents');
    return this.deps.pendingEventFactory.create({
      turn: this.state.turn,
      capital: this.state.capital,
      employees: this.state.employees,
      activeProjects: this.state.activeProjects,
      pendingEvents: this.state.pendingEvents,
    });
  }

  private resolveProbationEvent(employeeId: string, choiceIndex: number): void {
    this.traceFunction(
      'GameSession.resolveProbationEvent',
      `employeeId=${employeeId}, choiceIndex=${choiceIndex}`,
    );
    const resolution = this.deps.probationEventResolver.resolve(
      this.state.employees,
      this.state.activeProjects,
      this.state.availableProjects,
      employeeId,
      choiceIndex,
    );
    this.state.employees = resolution.employees;
    this.state.activeProjects = resolution.activeProjects;
    this.state.availableProjects = resolution.availableProjects;
    for (const log of resolution.logs) {
      this.addLog(log.message, log.layer ?? 'deterministic', {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }
  }

  private resolveSalaryEvent(employeeId: string, choiceIndex: number): void {
    this.traceFunction(
      'GameSession.resolveSalaryEvent',
      `employeeId=${employeeId}, choiceIndex=${choiceIndex}`,
    );
    const resolution = this.deps.salaryNegotiationResolver.resolve(
      this.state.employees,
      this.state.activeProjects,
      this.state.availableProjects,
      employeeId,
      choiceIndex,
    );
    this.state.employees = resolution.employees;
    for (const log of resolution.logs) {
      this.addLog(log.message, log.layer ?? 'deterministic', {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }
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
