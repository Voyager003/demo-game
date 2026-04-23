import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { useUIStore } from './uiStore';
import { testCooldowns, testEmployee, testGameState, testProject } from '../test/fixtures';

function resetGameStore(): void {
  useGameStore.setState({
    state: null,
    prevTurnSnapshot: null,
    functionLogs: [],
  });
  useGameStore.getState().canPerformAction('postJobListing');
}

function resetUIStore(): void {
  useUIStore.setState({
    activePanel: 'financial',
    modalType: null,
    modalTargetId: null,
    showReport: false,
  });
}

describe('useGameStore', () => {
  beforeEach(() => {
    resetGameStore();
  });

  it('initializes a new game and records startup function logs', () => {
    useGameStore.getState().initGame('b2bsaas', 'Store Co', testEmployee({ id: 'founder' }));

    const store = useGameStore.getState();
    expect(store.state?.companyName).toBe('Store Co');
    expect(store.state?.activeProjects[0].isMainRevenue).toBe(true);
    expect(store.functionLogs.map((log) => log.functionName)).toEqual(['GameSession.startNewGame']);
    expect(store.prevTurnSnapshot).toBeNull();
  });

  it('reuses the active session across actions and appends function logs', () => {
    useGameStore.setState({
      state: testGameState({
        phase: 2,
        employees: [testEmployee({ id: 'emp' })],
        availableProjects: [
          testProject({
            id: 'contract',
            status: 'available',
            totalAmount: 1000,
          }),
        ],
      }),
      prevTurnSnapshot: null,
      functionLogs: [],
    });

    useGameStore.getState().signContract('contract');
    useGameStore.getState().setProjectAssignments('contract', ['emp']);

    const state = useGameStore.getState().state;
    expect(state?.capital).toBe(2300);
    expect(state?.activeProjects[0].assignedEmployeeIds).toEqual(['emp']);
    expect(state?.employees[0].projectAssignments).toEqual({ contract: 100 });
    expect(useGameStore.getState().functionLogs.map((log) => log.functionName)).toContain('GameSession.applyAssignments');
  });

  it('captures previous snapshots when leaving decision phase through advancePhase or endTurn', () => {
    const state = testGameState({
      phase: 2,
      activeProjects: [],
      fatigue: {
        current: 9,
        max: 9,
        cooldowns: testCooldowns(),
      },
    });
    useGameStore.setState({ state, prevTurnSnapshot: null, functionLogs: [] });

    useGameStore.getState().advancePhase();
    expect(useGameStore.getState().prevTurnSnapshot).toMatchObject({
      phase: 2,
      turn: 1,
    });
    expect(useGameStore.getState().state?.phase).toBe(5);

    resetGameStore();
    useGameStore.setState({ state, prevTurnSnapshot: null, functionLogs: [] });
    useGameStore.getState().endTurn();
    expect(useGameStore.getState().prevTurnSnapshot).toMatchObject({
      phase: 2,
      turn: 1,
    });
  });

  it('guards canPerformAction and clears function logs', () => {
    expect(useGameStore.getState().canPerformAction('postJobListing')).toBe(false);

    useGameStore.setState({
      state: testGameState({
        fatigue: {
          current: 3,
          max: 9,
          cooldowns: testCooldowns(),
        },
      }),
      functionLogs: [{ id: 'fn', functionName: 'fn', turn: 1, phase: 2, timestamp: 1 }],
    });

    expect(useGameStore.getState().canPerformAction('postJobListing')).toBe(true);
    useGameStore.getState().clearFunctionLogs();
    expect(useGameStore.getState().functionLogs).toEqual([]);
  });

  it('starts an investment round and stores the review state', () => {
    useGameStore.setState({
      state: testGameState({
        phase: 2,
        activeProjects: [
          testProject({
            id: 'main',
            kind: 'ownedProduct',
            status: 'operating',
            isMainRevenue: true,
            monthlyRevenue: 400,
            assignedEmployeeIds: ['emp'],
          }),
        ],
        employees: [testEmployee({ id: 'emp' })],
        completedProjectCount: 2,
        companyRating: 28,
      }),
      prevTurnSnapshot: null,
      functionLogs: [],
    });

    useGameStore.getState().startInvestmentRound();

    const state = useGameStore.getState().state;
    expect(state?.investment.status).toBe('underReview');
    expect(state?.investment.pendingResult).not.toBeNull();
    expect(useGameStore.getState().functionLogs.map((log) => log.functionName)).toContain('GameSession.startInvestmentRound');
  });
});

describe('useUIStore', () => {
  beforeEach(() => {
    resetUIStore();
  });

  it('updates active panels, modal state, and report visibility', () => {
    useUIStore.getState().setActivePanel('events');
    useUIStore.getState().openModal('employee', 'emp-1');
    useUIStore.getState().setShowReport(true);

    expect(useUIStore.getState()).toMatchObject({
      activePanel: 'events',
      modalType: 'employee',
      modalTargetId: 'emp-1',
      showReport: true,
    });

    useUIStore.getState().closeModal();
    expect(useUIStore.getState()).toMatchObject({
      modalType: null,
      modalTargetId: null,
    });
  });
});
