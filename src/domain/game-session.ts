import { DOMAIN_INITIAL_STATS } from '../constants/domainStats';
import { ChemistryBoard } from './chemistry';
import { EmployeeRoster, createFounder } from './employee';
import { FatigueMeter } from './fatigue';
import { createGameSessionDependencies, type GameSessionDependencies } from './game-session-dependencies';
import { resolveEconomyDeterministicMetrics, resolveProjectDeterministicMetrics } from './layers/deterministic-layer';
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
import type { TraitId, TraitRevealTriggerType } from '../types/trait';
import { formatUnlockedTraitLog, getTraitDefinition } from './traits';

const INITIAL_COMPANY_RATING = 20;

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
      companyRating: INITIAL_COMPANY_RATING,
      fatigue,
      employees: [founder],
      pendingResumes: [],
      activeProjects: [mainRevenueProject],
      availableProjects: resolvedDeps.projectFactory.generateInitialProjects(3, 1, resolvedDeps.contractOfferLifecyclePolicy),
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
      investment: {
        status: 'idle',
        reviewEndsOnTurn: null,
        cooldownEndsOnTurn: null,
        pendingResult: null,
        attemptCount: 0,
      },
      organization: {
        chemistry: ChemistryBoard.initialize([founder]),
      },
      companyStage: resolvedDeps.companyStageProgressionPolicy.initialState({
        employees: [founder],
        capital: 2000,
        companyRating: INITIAL_COMPANY_RATING,
        recurringRevenue: resolveEconomyDeterministicMetrics(
          [mainRevenueProject],
          [founder],
          50,
        ).recurringRevenue.finalValue,
      }),
      gameStatus: 'playing',
      crisisGraceTurnsLeft: 0,
      endingGrade: null,
    }, resolvedDeps);
    session.traceFunction('GameSession.startNewGame', `domain=${domain}`);
    return session;
  }

  canPerform(action: ActionType): boolean {
    if (action === 'startInvestmentRound') {
      this.refreshInvestmentState();
      if (this.state.investment.status !== 'idle') return false;
      if (!this.deps.companyStageInvestmentGatePolicy.isAllowed(this.state).allowed) return false;
    }
    return new FatigueMeter(this.state.fatigue).canPerform(action);
  }

  advancePhase(): GameSession {
    this.traceFunction('GameSession.advancePhase');
    this.refreshInvestmentState();
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
      const refresh = new ProjectPortfolio(
        this.state.activeProjects,
        this.state.availableProjects,
      ).refreshAvailableContracts(next.turn, this.deps.random, {
        projectFactory: this.deps.projectFactory,
        lifecyclePolicy: this.deps.contractOfferLifecyclePolicy,
        spawnPolicy: this.deps.contractOfferSpawnPolicy,
      });
      const snapshots = refresh.portfolio.toSnapshots();
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
      for (const log of refresh.logs) {
        this.addLog(log.message, 'deterministic', {
          source: log.source,
          layerTrace: log.layerTrace,
        });
      }
    }

    return this;
  }

  endTurn(): GameSession {
    this.traceFunction('GameSession.endTurn');
    this.refreshInvestmentState();
    if (this.state.phase !== 2) return this;
    return this.runAutomaticPhases();
  }

  postJobListing(): GameSession {
    this.traceFunction('GameSession.postJobListing');
    if (!this.spendAction('postJobListing')) return this;
    const resumes = this.deps.employeeFactory.generateResumes(
      this.deps.random.nextInt(3, 5),
      this.state.companyRating,
      this.state.turn,
    );
    this.state.pendingResumes = resumes;
    this.addLog(`채용 공고 게시 — 이력서 ${resumes.length}장 수집됨`, 'deterministic', {
      source: 'GameSession.postJobListing',
      layerTrace: {
        rule: '채용 공고 실행',
        trigger: 'postJobListing 액션 성공',
        inputs: [
          `companyRating=${this.state.companyRating}`,
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

  startInvestmentRound(): GameSession {
    this.traceFunction('GameSession.startInvestmentRound');
    this.refreshInvestmentState();
    const gate = this.deps.companyStageInvestmentGatePolicy.isAllowed(this.state);
    if (this.state.investment.status !== 'idle' || !gate.allowed || !this.spendAction('startInvestmentRound')) return this;

    const review = this.deps.investmentReviewPolicy.start({
      turn: this.state.turn,
      ceo: this.state.ceo,
      companyRating: this.state.companyRating,
      completedProjectCount: this.state.completedProjectCount,
      activeProjects: this.state.activeProjects,
      employees: this.state.employees,
    }, this.state.investment);
    this.state.investment = review.investment;

    this.addLog('투자 유치 라운드를 시작했습니다.', 'deterministic', {
      source: 'GameSession.startInvestmentRound',
      layerTrace: {
        ...review.deterministicTrace,
        effects: [
          ...review.deterministicTrace.effects,
          `successProbability=${Math.round((review.investment.pendingResult?.successProbability ?? 0) * 100)}%`,
          'startInvestmentRound 피로도/쿨타임 적용',
        ],
      },
    });
    this.addLog('투자 심사 확률이 계산되었습니다.', 'probabilistic', {
      source: 'GameSession.startInvestmentRound',
      layerTrace: review.probabilisticTrace,
    });
    return this;
  }

  conductInterview(candidateId: string): GameSession {
    this.traceFunction('GameSession.conductInterview', `candidateId=${candidateId}`);
    const candidate = this.state.pendingResumes.find((resume) => resume.id === candidateId);
    if (!candidate || !this.spendAction('conductInterview')) return this;
    this.state.pendingResumes = this.state.pendingResumes.filter((resume) => resume.id !== candidateId);
    this.state.employees = new EmployeeRoster(this.state.employees).add(candidate).toSnapshots();
    this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
      .sync(this.state.employees)
      .toSnapshot();
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
    this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
      .applyRemoval(this.state.employees)
      .toSnapshot();
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
      this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
        .applySalaryDecision(this.state.employees, employeeId, newSalary > oldSalary)
        .toSnapshot();
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
    this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
      .applyOvertime(this.state.employees, project.assignedEmployeeIds)
      .toSnapshot();
    this.revealTraitsForEmployees(project.assignedEmployeeIds, 'overtime', '야근 패턴이 드러남');
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

    if (event.type === 'investmentResult') {
      this.resolveInvestmentEvent();
    }

    if (event.type === 'employeeBurnout' && event.targetId) {
      this.resolveBurnoutEvent(event.targetId);
    }

    if (event.type === 'employeeQuit' && event.targetId) {
      this.resolveQuitEvent(event.targetId);
    }

    if (event.type === 'teamConflict') {
      this.resolveTeamConflictEvent();
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
      const assignedEmployees = this.state.employees.filter((employee) => employeeIds.includes(employee.id));
      if (project.kind === 'ownedProduct') {
        const pressure = this.deps.companyStagePressurePolicy.evaluate(this.state);
        const revenueResolution = resolveEconomyDeterministicMetrics(
          this.state.activeProjects,
          this.state.employees,
          this.state.organization.chemistry.teamChem,
          pressure.recurringRevenueEffects,
        );
        const recurringRevenue = revenueResolution.recurringRevenue.finalValue;
        this.addLog(
          `[${project.name}] 인력 배정 변경 — 예상 실효 수입 ${recurringRevenue.toLocaleString()}만원`,
          'deterministic',
          {
            source: 'GameSession.applyAssignments',
            layerTrace: {
              ...revenueResolution.recurringRevenue.trace,
              rule: '주수입원 인력 배정 결정론 미리보기',
              trigger: 'changeAssignment 또는 setProjectAssignments 액션 성공',
              inputs: [
                `project=${project.name}`,
                `projectId=${projectId}`,
                `employeeCount=${employeeIds.length}`,
                ...revenueResolution.recurringRevenue.trace.inputs,
              ],
              effects: [
                'project.assignedEmployeeIds를 선택 직원 목록으로 교체',
                '각 employee.projectAssignments에 프로젝트 배정 100% 또는 제거 반영',
                ...revenueResolution.recurringRevenue.trace.effects,
                'changeAssignment 피로도 적용',
              ],
              finalValue: `예상 실효 수입=${recurringRevenue}만원`,
            },
          },
        );
      } else {
        const pressure = this.deps.companyStagePressurePolicy.evaluate(this.state);
        const progressResolution = resolveProjectDeterministicMetrics(
          project,
          assignedEmployees,
          this.state.organization.chemistry.teamChem,
          pressure.projectEffects,
        );
        const progressPerTurn = progressResolution.progressPerTurn.finalValue;
        const turnsLeft = progressPerTurn > 0
          ? Math.ceil((100 - project.progress) / progressPerTurn)
          : null;
        const finishTurn = turnsLeft === null ? null : this.state.turn + turnsLeft;
        this.addLog(
          `[${project.name}] 인력 배정 변경 — 예상 완료 ${finishTurn ? `Turn ${finishTurn}` : '불가'}`,
          'deterministic',
          {
            source: 'GameSession.applyAssignments',
            layerTrace: {
              ...progressResolution.progressPerTurn.trace,
              rule: '외주 인력 배정 결정론 미리보기',
              trigger: 'changeAssignment 또는 setProjectAssignments 액션 성공',
              inputs: [
                `project=${project.name}`,
                `projectId=${projectId}`,
                `employeeCount=${employeeIds.length}`,
                ...progressResolution.progressPerTurn.trace.inputs,
              ],
              effects: [
                'project.assignedEmployeeIds를 선택 직원 목록으로 교체',
                '각 employee.projectAssignments에 프로젝트 배정 100% 또는 제거 반영',
                ...progressResolution.progressPerTurn.trace.effects,
                'changeAssignment 피로도 적용',
              ],
              finalValue: finishTurn
                ? `예상 완료 Turn ${finishTurn}, progressPerTurn=${progressPerTurn.toFixed(2)}%`
                : '배정 인원이 부족해 예상 완료를 계산할 수 없음',
            },
          },
        );
      }
    }
    return this;
  }

  private runAutomaticPhases(): GameSession {
    this.traceFunction('GameSession.runAutomaticPhases');
    this.state.phase = new TurnCycle(this.state.turn, this.state.phase).toExecutionPhase().phase;
    const stagePressure = this.deps.companyStagePressurePolicy.evaluate(this.state);
    const portfolio = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects);
    const progress = portfolio.advanceWeek(this.state.employees, {
      teamChem: this.state.organization.chemistry.teamChem,
      externalEffects: stagePressure.projectEffects,
    });
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
    for (const completedProject of progress.completedProjects) {
      this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
        .applyProjectOutcome(this.state.employees, completedProject.assignedEmployeeIds, true)
        .toSnapshot();
      this.revealTraitsForEmployees(
        completedProject.assignedEmployeeIds,
        'projectCompleted',
        `${completedProject.name} 완료를 통해 업무 성향이 드러남`,
      );
    }
    this.revealLowHpTraits();

    this.state.phase = new TurnCycle(this.state.turn, this.state.phase).toSettlementPhase().phase;
    this.applyWeeklySettlement(stagePressure);
    this.updateCrisisState();
    this.evaluateCompanyStage();

    this.state.phase = new TurnCycle(this.state.turn, this.state.phase).toReportPhase().phase;
    return this;
  }

  private applyWeeklySettlement(stagePressure = this.deps.companyStagePressurePolicy.evaluate(this.state)): void {
    this.traceFunction('GameSession.applyWeeklySettlement');
    const pressureLog = this.deps.companyStagePressurePolicy.createLog(this.state.companyStage, stagePressure);
    const transition = this.deps.monthlySettlementPolicy.apply({
      turn: this.state.turn,
      capital: this.state.capital,
      activeProjects: this.state.activeProjects,
      employees: this.state.employees,
      organization: this.state.organization,
      companyStage: this.state.companyStage,
    }, {
      recurringRevenueEffects: stagePressure.recurringRevenueEffects,
      operatingCostPercent: stagePressure.profile.operatingCostPercent,
      pressureLog,
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

  private evaluateCompanyStage(): void {
    this.traceFunction('GameSession.evaluateCompanyStage');
    const transition = this.deps.companyStageProgressionPolicy.evaluate(this.state);
    this.state.companyStage = transition.companyStage;
    if (transition.promoted && transition.log) {
      this.addLog(transition.log.message, 'chain', {
        source: transition.log.source,
        layerTrace: transition.log.layerTrace,
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
    const deterministicEvents = this.deps.pendingEventFactory.create({
      turn: this.state.turn,
      capital: this.state.capital,
      employees: this.state.employees,
      activeProjects: this.state.activeProjects,
      pendingEvents: this.state.pendingEvents,
      investment: this.state.investment,
    });
    const probabilistic = this.deps.traitProbabilisticEventPolicy.evaluate({
      turn: this.state.turn,
      employees: this.state.employees,
      organization: this.state.organization,
      pendingEvents: [...this.state.pendingEvents, ...deterministicEvents],
    });
    for (const log of probabilistic.logs) {
      this.addLog(log.message, 'probabilistic', {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }
    return [...deterministicEvents, ...probabilistic.pendingEvents];
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
    this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
      .sync(this.state.employees)
      .toSnapshot();
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
    this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
      .sync(this.state.employees)
      .toSnapshot();
    this.revealTraitsForEmployees([employeeId], 'salaryNegotiation', '연봉 협상으로 성향이 드러남');
    for (const log of resolution.logs) {
      this.addLog(log.message, log.layer ?? 'deterministic', {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }
  }

  private resolveInvestmentEvent(): void {
    this.traceFunction('GameSession.resolveInvestmentEvent');
    const resolution = this.deps.investmentResultResolver.resolve({
      capital: this.state.capital,
      companyRating: this.state.companyRating,
      employees: this.state.employees,
      investment: this.state.investment,
      turn: this.state.turn,
    });
    this.state.capital = resolution.capital;
    this.state.companyRating = resolution.companyRating;
    this.state.employees = resolution.employees;
    this.state.investment = resolution.investment;
    this.revealTraitsForEmployees(
      this.state.employees.map((employee) => employee.id),
      'supportEvent',
      '투자 유치 이후 성장/지원 성향이 드러남',
    );
    for (const log of resolution.logs) {
      this.addLog(log.message, log.layer, {
        source: log.source,
        layerTrace: log.layerTrace,
      });
    }
  }

  private resolveBurnoutEvent(employeeId: string): void {
    this.traceFunction('GameSession.resolveBurnoutEvent', `employeeId=${employeeId}`);
    this.state.employees = this.state.employees.map((employee) =>
      employee.id === employeeId
        ? {
            ...employee,
            hp: Math.max(0, employee.hp - 20),
            commonStats: {
              ...employee.commonStats,
              loyalty: Math.max(-1, employee.commonStats.loyalty - 1),
            },
          }
        : employee,
    );
    this.revealTraitsForEmployees([employeeId], 'lowHp', '저체력 위기로 번아웃 성향이 드러남');
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);
    if (employee) {
      this.addLog(`${employee.name} 번아웃 여파로 체력과 충성도가 하락했습니다.`, 'probabilistic', {
        source: 'GameSession.resolveBurnoutEvent',
        layerTrace: {
          layer: 'probabilistic',
          rule: '번아웃 결과 적용',
          trigger: 'employeeBurnout 이벤트 확인',
          inputs: [`employee=${employee.name}`],
          effects: ['employee.hp -20', 'employee.commonStats.loyalty -1'],
        },
      });
    }
  }

  private resolveQuitEvent(employeeId: string): void {
    this.traceFunction('GameSession.resolveQuitEvent', `employeeId=${employeeId}`);
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);
    if (!employee) return;
    this.state.employees = new EmployeeRoster(this.state.employees).remove(employeeId).toSnapshots();
    const portfolio = new ProjectPortfolio(this.state.activeProjects, this.state.availableProjects).removeEmployee(employeeId);
    const snapshots = portfolio.toSnapshots();
    this.state.activeProjects = snapshots.activeProjects;
    this.state.availableProjects = snapshots.availableProjects;
    this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
      .applyRemoval(this.state.employees)
      .toSnapshot();
    this.addLog(`${employee.name}이(가) 회사를 떠났습니다.`, 'probabilistic', {
      source: 'GameSession.resolveQuitEvent',
      layerTrace: {
        layer: 'probabilistic',
        rule: '이직 결과 적용',
        trigger: 'employeeQuit 이벤트 확인',
        inputs: [`employee=${employee.name}`, `employeeId=${employeeId}`],
        effects: ['employees에서 대상 직원 제거', '프로젝트 배정 제거', 'organization.chemistry 재계산'],
      },
    });
  }

  private resolveTeamConflictEvent(): void {
    this.traceFunction('GameSession.resolveTeamConflictEvent');
    this.state.organization.chemistry = new ChemistryBoard(this.state.organization.chemistry)
      .applyConflict()
      .toSnapshot();
    this.revealTraitsForEmployees(
      this.state.employees.map((employee) => employee.id),
      'teamConflict',
      '팀 갈등 과정에서 사회성 특성이 드러남',
    );
    this.addLog('팀 갈등으로 조직 분위기가 악화되었습니다.', 'probabilistic', {
      source: 'GameSession.resolveTeamConflictEvent',
      layerTrace: {
        layer: 'probabilistic',
        rule: '팀 갈등 결과 적용',
        trigger: 'teamConflict 이벤트 확인',
        inputs: [`teamChem=${this.state.organization.chemistry.teamChem}`],
        effects: ['organization.chemistry.teamChem 하락', '사회성 특성 해금 시도'],
      },
    });
  }

  private refreshInvestmentState(): void {
    const { investment, turn } = this.state;
    if (
      investment.status === 'cooldown'
      && investment.cooldownEndsOnTurn !== null
      && turn >= investment.cooldownEndsOnTurn
    ) {
      this.state.investment = {
        ...investment,
        status: 'idle',
        cooldownEndsOnTurn: null,
      };
    }
  }

  private revealTraitsForEmployees(
    employeeIds: string[],
    trigger: TraitRevealTriggerType,
    note: string,
  ): void {
    const targetIds = new Set(employeeIds);
    const logs: Array<{ employee: Employee; traitId: TraitId }> = [];
    this.state.employees = this.state.employees.map((employee) => {
      if (!targetIds.has(employee.id)) return employee;
      const revealed = this.deps.traitRevealPolicy.reveal(employee, trigger, this.state.turn, note);
      for (const record of revealed.unlocked) {
        logs.push({ employee: revealed.employee, traitId: record.traitId });
      }
      return revealed.employee;
    });
    for (const log of logs) {
      this.addLog(formatUnlockedTraitLog(log.employee, {
        traitId: log.traitId,
        trigger,
        turn: this.state.turn,
        note,
      }), 'deterministic', {
        source: 'GameSession.revealTraitsForEmployees',
        layerTrace: {
          rule: '특성 해금',
          trigger: note,
          inputs: [`employee=${log.employee.name}`, `trait=${getTraitDefinition(log.traitId).label}`],
          effects: ['직원 상세와 로그에 특성 공개'],
        },
      });
    }
  }

  private revealLowHpTraits(): void {
    const lowHpIds = this.state.employees
      .filter((employee) => employee.hp <= 30)
      .map((employee) => employee.id);
    if (lowHpIds.length === 0) return;
    this.revealTraitsForEmployees(lowHpIds, 'lowHp', '저HP 상태로 리스크 특성이 드러남');
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
