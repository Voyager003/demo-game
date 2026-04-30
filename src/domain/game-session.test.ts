import { describe, expect, it } from 'vitest';
import { GameSession } from './game-session';
import type { RandomSource } from './generation';
import { testCooldowns, testEmployee, testGameState, testPendingEvent, testProject } from '../test/fixtures';

class StubRandomSource implements RandomSource {
  private readonly values: number[];

  constructor(values: number[]) {
    this.values = values;
  }

  next(): number {
    return this.values.shift() ?? 0;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] ?? items[0]!;
  }
}

describe('GameSession', () => {
  it('starts a new game with a reusable session state, founder, main revenue project, and logs', () => {
    const founder = testEmployee({
      id: 'founder',
      name: 'Founder',
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 4,
      },
    });

    const session = GameSession.startNewGame('fintech', 'Fin Co', founder);
    const state = session.toState();
    const functionLogs = session.drainFunctionLogs();

    expect(state.companyName).toBe('Fin Co');
    expect(state.employees).toHaveLength(1);
    expect(state.employees[0]).toMatchObject({
      id: 'founder',
      probationTurnsLeft: -1,
      hiredOnTurn: 1,
    });
    expect(state.employees[0].commonStats.loyalty).toBe(5);
    expect(state.activeProjects[0]).toMatchObject({
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 380,
      assignedEmployeeIds: ['founder'],
    });
    expect(state.employees[0].projectAssignments).toEqual({ [state.activeProjects[0].id]: 100 });
    expect(state.eventLog).toHaveLength(3);
    expect(state.companyRating).toBe(20);
    expect(state.companyStage.currentStage).toBe('solo');
    expect(state.companyStage.nextStagePreview.stage).toBe('earlyTeam');
    expect(functionLogs.map((log) => log.functionName)).toEqual(['GameSession.startNewGame']);
  });

  it('does not spend actions outside decision phase or when target is missing', () => {
    const employee = testEmployee({ id: 'emp' });
    const session = new GameSession(testGameState({
      phase: 1,
      employees: [employee],
      fatigue: {
        current: 9,
        max: 9,
        cooldowns: testCooldowns(),
      },
    }));

    session.fireEmployee('emp');
    expect(session.toState().employees).toHaveLength(1);
    expect(session.toState().fatigue.current).toBe(9);

    const decisionSession = new GameSession(testGameState({ employees: [employee] }));
    decisionSession.fireEmployee('missing');
    expect(decisionSession.toState().employees).toHaveLength(1);
    expect(decisionSession.toState().fatigue.current).toBe(9);
  });

  it('signs contracts, pays advances, spends fatigue, and logs trace metadata', () => {
    const available = testProject({
      id: 'contract',
      name: 'Client Work',
      status: 'available',
      totalAmount: 1000,
      advancePaid: false,
    });
    const session = new GameSession(testGameState({
      availableProjects: [available],
      fatigue: {
        current: 9,
        max: 9,
        cooldowns: testCooldowns(),
      },
    }));

    session.signContract('contract');
    const state = session.toState();

    expect(state.capital).toBe(2300);
    expect(state.fatigue.current).toBe(6);
    expect(state.activeProjects[0]).toMatchObject({
      id: 'contract',
      status: 'active',
      advancePaid: true,
    });
    expect(state.availableProjects).toHaveLength(0);
    expect(state.eventLog.at(-1)?.source).toBe('GameSession.signContract');
    expect(state.eventLog.at(-1)?.layerTrace?.effects).toContain('capital에 총액의 30% 선금 입금');
  });

  it('posts job listings and conducts interviews with main revenue auto-assignment', () => {
    const founder = testEmployee({ id: 'founder' });
    const candidate = testEmployee({ id: 'candidate', name: 'Candidate', role: 'designer' });
    const main = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      assignedEmployeeIds: ['founder'],
    });
    const session = new GameSession(testGameState({
      employees: [founder],
      pendingResumes: [candidate],
      activeProjects: [main],
      fatigue: {
        current: 9,
        max: 9,
        cooldowns: testCooldowns(),
      },
    }));

    session.postJobListing();
    expect(session.toState().pendingResumes.length).toBeGreaterThanOrEqual(3);
    expect(session.toState().pendingResumes.length).toBeLessThanOrEqual(5);
    expect(session.toState().fatigue.cooldowns.postJobListing).toBe(2);

    const interviewSession = new GameSession(testGameState({
      employees: [founder],
      pendingResumes: [candidate],
      activeProjects: [main],
    }));
    interviewSession.conductInterview('candidate');
    const state = interviewSession.toState();

    expect(state.pendingResumes).toEqual([]);
    expect(state.employees.map((employee) => employee.id)).toEqual(['founder', 'candidate']);
    expect(state.activeProjects[0].assignedEmployeeIds).toEqual(['founder', 'candidate']);
    expect(state.employees.find((employee) => employee.id === 'candidate')?.projectAssignments).toEqual({ main: 100 });
    expect(state.eventLog.map((log) => log.source)).toEqual([
      'GameSession.conductInterview',
      'GameSession.conductInterview',
    ]);
  });

  it('fires employees, adjusts salaries, changes assignments, and orders overtime', () => {
    const employee = testEmployee({
      id: 'emp',
      name: 'Employee',
      salary: 1000,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 1,
      },
    });
    const other = testEmployee({ id: 'other' });
    const project = testProject({
      id: 'p',
      status: 'active',
      assignedEmployeeIds: ['emp'],
    });
    const session = new GameSession(testGameState({
      employees: [employee, other],
      activeProjects: [project],
      fatigue: {
        current: 9,
        max: 9,
        cooldowns: testCooldowns(),
      },
    }));

    session.adjustSalary('emp', 1200);
    expect(session.toState().employees.find((candidate) => candidate.id === 'emp')).toMatchObject({
      salary: 1200,
      commonStats: expect.objectContaining({ loyalty: 2 }) as unknown,
    });

    session.changeAssignment('other', 'p', 100);
    expect(session.toState().activeProjects[0].assignedEmployeeIds).toEqual(['emp', 'other']);

    session.changeAssignment('emp', 'p', 0);
    expect(session.toState().activeProjects[0].assignedEmployeeIds).toEqual(['other']);

    session.orderOvertime('p');
    expect(session.toState().activeProjects[0].overtimeActive).toBe(true);

    session.fireEmployee('other');
    expect(session.toState().employees.map((candidate) => candidate.id)).toEqual(['emp']);
    expect(session.toState().activeProjects[0].assignedEmployeeIds).toEqual([]);
  });

  it('blocks investment start when current company stage gate is not met', () => {
    const session = new GameSession(testGameState({
      companyStage: {
        currentStage: 'startup',
        highestStage: 'startup',
        lastPromotedTurn: 8,
        nextStagePreview: { stage: 'scaleUp', stageLabel: '스케일업', requirements: [] },
      },
      companyRating: 40,
      organization: {
        chemistry: {
          teamChem: 40,
          pairChem: {},
          recentTensions: [],
          cultureHints: [],
        },
      },
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 100,
          assignedEmployeeIds: ['emp-1'],
        }),
      ],
    }));

    session.startInvestmentRound();
    const state = session.toState();

    expect(state.investment.status).toBe('idle');
    expect(state.fatigue.current).toBe(9);
  });

  it('updates assignments on projects and employee snapshots', () => {
    const project = testProject({ id: 'p', assignedEmployeeIds: [] });
    const employees = [
      testEmployee({ id: 'a' }),
      testEmployee({ id: 'b' }),
    ];
    const session = new GameSession(testGameState({
      activeProjects: [project],
      employees,
    }));

    session.setProjectAssignments('p', ['a', 'b']);
    const state = session.toState();

    expect(state.activeProjects[0].assignedEmployeeIds).toEqual(['a', 'b']);
    expect(state.employees.find((employee) => employee.id === 'a')?.projectAssignments).toEqual({ p: 100 });
    expect(state.employees.find((employee) => employee.id === 'b')?.projectAssignments).toEqual({ p: 100 });
    expect(state.fatigue.current).toBe(8);
  });

  it('runs automatic phases, monthly settlement, final payment, and function log drain', () => {
    const employee = testEmployee({
      id: 'emp',
      salary: 4800,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 2,
      },
    });
    const main = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 300,
      assignedEmployeeIds: ['emp'],
    });
    const completed = testProject({
      id: 'done',
      status: 'completed',
      finalPaid: false,
      totalAmount: 1000,
      clientSatisfaction: 70,
    });
    const session = new GameSession(testGameState({
      turn: 4,
      phase: 2,
      capital: 1000,
      employees: [employee],
      activeProjects: [main, completed],
    }));

    session.endTurn();
    const state = session.toState();

    expect(state.phase).toBe(5);
    expect(state.capital).toBe(1350);
    expect(state.activeProjects.find((project) => project.id === 'done')?.finalPaid).toBe(true);
    expect(state.eventLog.map((log) => log.source)).toEqual([
      'GameSession.applyWeeklySettlement',
      'GameSession.applyWeeklySettlement',
      'GameSession.applyWeeklySettlement',
      'GameSession.applyWeeklySettlement',
    ]);

    const logs = session.drainFunctionLogs();
    expect(logs.some((log) => log.functionName === 'GameSession.applyWeeklySettlement')).toBe(true);
    expect(session.drainFunctionLogs()).toEqual([]);
  });

  it('promotes only one company stage per monthly settlement', () => {
    const employees = Array.from({ length: 6 }, (_, index) => testEmployee({ id: `emp-${index}` }));
    const session = new GameSession(testGameState({
      turn: 4,
      capital: 9000,
      companyRating: 70,
      employees,
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 400,
          assignedEmployeeIds: employees.map((employee) => employee.id),
        }),
      ],
    }));

    session.endTurn();
    const state = session.toState();

    expect(state.phase).toBe(5);
    expect(state.companyStage.currentStage).toBe('earlyTeam');
    expect(state.companyStage.highestStage).toBe('earlyTeam');
    expect(state.eventLog.some((log) => log.message.includes('회사 성장 단계 상승'))).toBe(true);
  });

  it('enters crisis, counts down grace, ends, and recovers when capital is restored', () => {
    const crisisSession = new GameSession(testGameState({
      phase: 2,
      capital: -1,
      activeProjects: [],
    }));

    crisisSession.endTurn();
    expect(crisisSession.toState()).toMatchObject({
      gameStatus: 'crisis',
      crisisGraceTurnsLeft: 4,
    });

    const endingSession = new GameSession(testGameState({
      phase: 2,
      capital: -1,
      gameStatus: 'crisis',
      crisisGraceTurnsLeft: 1,
      activeProjects: [],
    }));
    endingSession.endTurn();
    expect(endingSession.toState()).toMatchObject({
      gameStatus: 'ended',
      endingGrade: 'F',
      crisisGraceTurnsLeft: 0,
    });

    const recoverySession = new GameSession(testGameState({
      phase: 2,
      capital: 1,
      gameStatus: 'crisis',
      crisisGraceTurnsLeft: 3,
      activeProjects: [],
    }));
    recoverySession.endTurn();
    expect(recoverySession.toState()).toMatchObject({
      gameStatus: 'playing',
      crisisGraceTurnsLeft: 0,
    });
  });

  it('generates deterministic pending events on phase 1 entry without duplicates', () => {
    const probation = testEmployee({
      id: 'probation',
      name: 'Probation',
      probationTurnsLeft: 0,
      employmentType: 'regular',
    });
    const salary = testEmployee({
      id: 'salary',
      name: 'Salary',
      hiredOnTurn: 1,
      probationTurnsLeft: -1,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 1,
      },
    });
    const project = testProject({
      id: 'deadline',
      status: 'active',
      turnsRequired: 5,
      turnsElapsed: 2,
      progress: 50,
    });
    const existing = testPendingEvent({
      id: 'existing',
      type: 'probationConversion',
      targetId: 'probation',
    });
    const session = new GameSession(testGameState({
      turn: 13,
      phase: 1,
      capital: 400,
      employees: [probation, salary],
      activeProjects: [project],
      pendingEvents: [existing],
    }));

    session.advancePhase();
    const events = session.toState().pendingEvents;

    expect(events.filter((event) => event.type === 'probationConversion')).toHaveLength(1);
    expect(events.some((event) => event.type === 'salaryNegotiation')).toBe(true);
    expect(events.some((event) => event.type === 'deadlineApproaching')).toBe(true);
    expect(events.some((event) => event.type === 'capitalCrisis')).toBe(true);
  });

  it('resolves probation and salary events', () => {
    const probation = testEmployee({
      id: 'probation',
      name: 'Probation',
      probationTurnsLeft: 0,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 3,
      },
    });
    const salary = testEmployee({
      id: 'salary',
      name: 'Salary',
      salary: 1000,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 0,
      },
    });
    const session = new GameSession(testGameState({
      employees: [probation, salary],
      pendingEvents: [
        testPendingEvent({
          id: 'probation-event',
          type: 'probationConversion',
          targetId: 'probation',
        }),
        testPendingEvent({
          id: 'salary-event',
          type: 'salaryNegotiation',
          targetId: 'salary',
        }),
      ],
    }));

    session.resolveEvent('probation-event', 0);
    session.resolveEvent('salary-event', 1);
    const state = session.toState();

    expect(state.pendingEvents).toEqual([]);
    expect(state.employees.find((employee) => employee.id === 'probation')).toMatchObject({
      probationTurnsLeft: -1,
      commonStats: expect.objectContaining({ loyalty: 5 }) as unknown,
    });
    expect(state.employees.find((employee) => employee.id === 'salary')).toMatchObject({
      salary: 1050,
      commonStats: expect.objectContaining({ loyalty: 1 }) as unknown,
    });
    expect(state.eventLog.map((log) => log.source)).toEqual([
      'GameSession.resolveProbationEvent',
      'GameSession.resolveSalaryEvent',
    ]);
  });

  it('starts an investment round, generates a result event, and applies success rewards', () => {
    const session = new GameSession(testGameState({
      turn: 3,
      phase: 2,
      companyRating: 30,
      completedProjectCount: 2,
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 420,
          assignedEmployeeIds: ['emp'],
        }),
      ],
      employees: [testEmployee({
        id: 'emp',
        commonStats: {
          stamina: 2,
          communication: 2,
          mental: 2,
          growthRate: 2,
          loyalty: 2,
        },
      })],
    }), {
      random: new StubRandomSource([0.01]),
    });

    session.startInvestmentRound();
    expect(session.toState().investment.status).toBe('underReview');

    const reportPhase = new GameSession(testGameState({
      turn: 5,
      phase: 1,
      companyRating: session.toState().companyRating,
      completedProjectCount: session.toState().completedProjectCount,
      activeProjects: session.toState().activeProjects,
      employees: session.toState().employees,
      investment: session.toState().investment,
    }), {
      random: new StubRandomSource([0.01]),
    });
    reportPhase.advancePhase();
    const event = reportPhase.toState().pendingEvents.find((candidate) => candidate.type === 'investmentResult');
    expect(event).toBeTruthy();

    reportPhase.resolveEvent(event!.id, 0);
    const state = reportPhase.toState();
    expect(state.capital).toBeGreaterThan(2000);
    expect(state.companyRating).toBeGreaterThan(30);
    expect(state.employees[0]?.commonStats).toMatchObject({
      loyalty: 3,
      growthRate: 3,
    });
    expect(state.investment.status).toBe('cooldown');
    expect(state.eventLog.some((log) => log.source === 'GameSession.resolveInvestmentEvent')).toBe(true);
  });

  it('applies investment failure penalties and blocks retries during cooldown', () => {
    const session = new GameSession(testGameState({
      turn: 4,
      phase: 2,
      companyRating: 20,
      activeProjects: [
        testProject({
          id: 'main',
          kind: 'ownedProduct',
          status: 'operating',
          isMainRevenue: true,
          monthlyRevenue: 200,
        }),
      ],
    }), {
      random: new StubRandomSource([0.99]),
    });

    session.startInvestmentRound();
    const reviewState = session.toState();
    const resolver = new GameSession(testGameState({
      turn: 6,
      phase: 1,
      companyRating: reviewState.companyRating,
      activeProjects: reviewState.activeProjects,
      employees: reviewState.employees,
      investment: reviewState.investment,
    }), {
      random: new StubRandomSource([0.99]),
    });
    resolver.advancePhase();
    const event = resolver.toState().pendingEvents.find((candidate) => candidate.type === 'investmentResult');
    resolver.resolveEvent(event!.id, 0);

    const failed = resolver.toState();
    expect(failed.capital).toBe(2000);
    expect(failed.companyRating).toBeLessThan(20);
    expect(failed.investment.status).toBe('cooldown');
    expect(resolver.canPerform('startInvestmentRound')).toBe(false);
  });

  it('resolves termination probation choices and salary accept/reject choices', () => {
    const probation = testEmployee({
      id: 'probation',
      name: 'Probation',
      probationTurnsLeft: 0,
    });
    const salaryRaise = testEmployee({
      id: 'raise',
      name: 'Raise',
      salary: 1000,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 3,
      },
    });
    const salaryReject = testEmployee({
      id: 'reject',
      name: 'Reject',
      salary: 1000,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 0,
      },
    });
    const project = testProject({
      id: 'p',
      assignedEmployeeIds: ['probation'],
    });
    const session = new GameSession(testGameState({
      employees: [probation, salaryRaise, salaryReject],
      activeProjects: [project],
      pendingEvents: [
        testPendingEvent({ id: 'terminate', type: 'probationConversion', targetId: 'probation' }),
        testPendingEvent({ id: 'raise', type: 'salaryNegotiation', targetId: 'raise' }),
        testPendingEvent({ id: 'reject', type: 'salaryNegotiation', targetId: 'reject' }),
      ],
    }));

    session.resolveEvent('missing', 0);
    session.resolveEvent('terminate', 1);
    session.resolveEvent('raise', 0);
    session.resolveEvent('reject', 2);
    const state = session.toState();

    expect(state.employees.map((employee) => employee.id)).toEqual(['raise', 'reject']);
    expect(state.activeProjects[0].assignedEmployeeIds).toEqual([]);
    expect(state.employees.find((employee) => employee.id === 'raise')).toMatchObject({
      salary: 1100,
      commonStats: expect.objectContaining({ loyalty: 5 }) as unknown,
    });
    expect(state.employees.find((employee) => employee.id === 'reject')).toMatchObject({
      salary: 1000,
      commonStats: expect.objectContaining({ loyalty: -1 }) as unknown,
    });
  });

  it('advances from report phase into next turn and refreshes contract offers', () => {
    const session = new GameSession(testGameState({
      turn: 5,
      phase: 5,
      availableProjects: [],
      fatigue: {
        current: 0,
        max: 9,
        cooldowns: testCooldowns({ postJobListing: 1 }),
      },
    }), {
      random: new StubRandomSource([
        0.1, // spawn extra offer
        0.0, 0.3, 0.4, 0.8, // offer 1
        0.0, 0.3, 0.4, 0.2, // offer 2
      ]),
    });

    session.advancePhase();
    const state = session.toState();

    expect(state.turn).toBe(6);
    expect(state.phase).toBe(1);
    expect(state.fatigue.current).toBe(10);
    expect(state.fatigue.cooldowns.postJobListing).toBe(1);
    expect(state.availableProjects).toHaveLength(2);
    expect(state.availableProjects.every((project) => project.offeredAtTurn === 6)).toBe(true);
    expect(state.eventLog.some((log) => log.message.includes('신규 외주 제안 도착'))).toBe(true);
  });

  it('returns unchanged for no-op phase transitions and endTurn outside decision phase', () => {
    const phaseThree = new GameSession(testGameState({ phase: 3, turn: 2 }));
    phaseThree.advancePhase();
    expect(phaseThree.toState()).toMatchObject({ phase: 3, turn: 2 });

    const phaseOne = new GameSession(testGameState({ phase: 1, turn: 2 }));
    phaseOne.endTurn();
    expect(phaseOne.toState()).toMatchObject({ phase: 1, turn: 2 });
  });
});
