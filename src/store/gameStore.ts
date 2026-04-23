import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GameSession } from '../domain';
import type { GameState, ActionType } from '../types/core';
import type { Domain } from '../types/ceo';
import type { FunctionExecutionLogEntry } from '../types/debug';
import type { Employee } from '../types/employee';

const MAX_FUNCTION_LOGS = 120;

interface GameStore {
  state: GameState | null;
  prevTurnSnapshot: GameState | null;
  functionLogs: FunctionExecutionLogEntry[];

  initGame: (domain: Domain, companyName: string, foundingMember: Employee) => void;
  advancePhase: () => void;
  endTurn: () => void;

  postJobListing: () => void;
  conductInterview: (candidateId: string) => void;
  fireEmployee: (employeeId: string) => void;
  adjustSalary: (employeeId: string, newSalary: number) => void;
  signContract: (projectId: string) => void;
  changeAssignment: (employeeId: string, projectId: string, percentage: number) => void;
  setProjectAssignments: (projectId: string, employeeIds: string[]) => void;
  orderOvertime: (projectId: string) => void;
  startInvestmentRound: () => void;

  canPerformAction: (action: ActionType) => boolean;
  resolveEvent: (eventId: string, choiceIndex: number) => void;
  clearFunctionLogs: () => void;
}

let activeSession: GameSession | null = null;

function getActiveSession(state: GameState | null): GameSession | null {
  if (!state) {
    activeSession = null;
    return null;
  }

  activeSession ??= new GameSession(state);
  return activeSession;
}

function appendFunctionLogs(
  store: Pick<GameStore, 'functionLogs'>,
  logs: FunctionExecutionLogEntry[],
): void {
  if (logs.length === 0) return;
  store.functionLogs.push(...logs);
  if (store.functionLogs.length > MAX_FUNCTION_LOGS) {
    store.functionLogs.splice(0, store.functionLogs.length - MAX_FUNCTION_LOGS);
  }
}

function runSession(
  store: Pick<GameStore, 'state' | 'functionLogs'>,
  command: (session: GameSession) => GameSession,
): void {
  const session = getActiveSession(store.state);
  if (!session) return;
  activeSession = command(session);
  appendFunctionLogs(store, activeSession.drainFunctionLogs());
  store.state = activeSession.toState();
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    state: null,
    prevTurnSnapshot: null,
    functionLogs: [],

    initGame: (domain, companyName, foundingMember) => {
      set((store) => {
        activeSession = GameSession.startNewGame(domain, companyName, foundingMember);
        store.state = activeSession.toState();
        store.prevTurnSnapshot = null;
        store.functionLogs = [];
        appendFunctionLogs(store, activeSession.drainFunctionLogs());
      });
    },

    advancePhase: () => {
      set((store) => {
        if (!store.state) return;
        if (store.state.phase === 2) {
          store.prevTurnSnapshot = JSON.parse(JSON.stringify(store.state)) as GameState;
        }
        runSession(store, (session) => session.advancePhase());
      });
    },

    endTurn: () => {
      set((store) => {
        if (!store.state || store.state.phase !== 2) return;
        store.prevTurnSnapshot = JSON.parse(JSON.stringify(store.state)) as GameState;
        runSession(store, (session) => session.endTurn());
      });
    },

    postJobListing: () => {
      set((store) => {
        runSession(store, (session) => session.postJobListing());
      });
    },

    conductInterview: (candidateId) => {
      set((store) => {
        runSession(store, (session) => session.conductInterview(candidateId));
      });
    },

    fireEmployee: (employeeId) => {
      set((store) => {
        runSession(store, (session) => session.fireEmployee(employeeId));
      });
    },

    adjustSalary: (employeeId, newSalary) => {
      set((store) => {
        runSession(store, (session) => session.adjustSalary(employeeId, newSalary));
      });
    },

    signContract: (projectId) => {
      set((store) => {
        runSession(store, (session) => session.signContract(projectId));
      });
    },

    changeAssignment: (employeeId, projectId, percentage) => {
      set((store) => {
        runSession(store, (session) =>
          session.changeAssignment(employeeId, projectId, percentage),
        );
      });
    },

    setProjectAssignments: (projectId, employeeIds) => {
      set((store) => {
        runSession(store, (session) =>
          session.setProjectAssignments(projectId, employeeIds),
        );
      });
    },

    orderOvertime: (projectId) => {
      set((store) => {
        runSession(store, (session) => session.orderOvertime(projectId));
      });
    },

    startInvestmentRound: () => {
      set((store) => {
        runSession(store, (session) => session.startInvestmentRound());
      });
    },

    canPerformAction: (action) => {
      const session = getActiveSession(get().state);
      return session ? session.canPerform(action) : false;
    },

    resolveEvent: (eventId, choiceIndex) => {
      set((store) => {
        runSession(store, (session) =>
          session.resolveEvent(eventId, choiceIndex),
        );
      });
    },

    clearFunctionLogs: () => {
      set((store) => {
        store.functionLogs = [];
      });
    },
  })),
);
