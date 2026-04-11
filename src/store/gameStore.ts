import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { DOMAIN_INITIAL_STATS } from '../constants/domainStats';
import { calcMaxFatigue, canPerformAction, applyActionCost } from '../engine/fatigue';
import { generateResumes } from '../engine/hiringEngine';
import { buildPairChemistryMap } from '../engine/chemistryEngine';
import { runPhase3Execution, runPhase4Settlement } from '../engine/phaseRunner';
import { generatePendingEvents } from '../engine/eventEngine';
import { LV1_PROJECT_TEMPLATES } from '../constants/projectTemplates';
import type { GameState, ActionType } from '../types/core';
import type { Domain } from '../types/ceo';
import type { Employee } from '../types/employee';
import type { Project } from '../types/project';

const INITIAL_REPUTATION = 20;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateInitialProjects(): Project[] {
  const pool = [...LV1_PROJECT_TEMPLATES];
  const count = 3;
  const selected: Project[] = [];

  for (let i = 0; i < count; i++) {
    const tmpl = randFrom(pool);
    selected.push({
      id: generateId(),
      name: tmpl.name,
      level: tmpl.level,
      totalAmount: randInt(tmpl.minAmount, tmpl.maxAmount),
      advancePaid: false,
      finalPaid: false,
      turnsRequired: randInt(tmpl.minTurns, tmpl.maxTurns),
      turnsElapsed: 0,
      progress: 0,
      assignedEmployeeIds: [],
      status: 'available',
      clientSatisfaction: 0,
      overtimeActive: false,
    });
  }

  return selected;
}

function createInitialCooldowns(): Record<ActionType, number> {
  return {
    postJobListing: 0,
    conductInterview: 0,
    fireEmployee: 0,
    adjustSalary: 0,
    signContract: 0,
    changeAssignment: 0,
    orderOvertime: 0,
  };
}

// ─── Store 인터페이스 ─────────────────────────────────────────
interface GameStore {
  state: GameState;
  prevTurnSnapshot: GameState | null;

  // 게임 시작
  initGame: (domain: Domain, companyName: string, foundingMember: Employee) => void;

  // 턴 진행
  advancePhase: () => void;
  endTurn: () => void; // Phase2에서 즉시 Phase5로

  // 의사결정 Phase 액션
  postJobListing: () => void;
  conductInterview: (candidateId: string) => void;
  fireEmployee: (employeeId: string) => void;
  adjustSalary: (employeeId: string, newSalary: number) => void;
  signContract: (projectId: string) => void;
  changeAssignment: (employeeId: string, projectId: string, percentage: number) => void;
  setProjectAssignments: (projectId: string, employeeIds: string[]) => void;
  orderOvertime: (projectId: string) => void;

  // 이벤트 해결
  resolveEvent: (eventId: string, choiceIndex: number) => void;
}

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    state: null as unknown as GameState,
    prevTurnSnapshot: null,

    // ─── 게임 시작 ────────────────────────────────────────────
    initGame: (domain, companyName, foundingMember) => {
      const stats = DOMAIN_INITIAL_STATS[domain];
      const maxFatigue = calcMaxFatigue(stats.leadership);

      // 창업 멤버: 수습 없음, 모든 특성 공개, 충성도 최대
      const founder: Employee = {
        ...foundingMember,
        probationTurnsLeft: -1, // 수습 없음 (창업 멤버)
        hiredOnTurn: 1,
        commonStats: {
          ...foundingMember.commonStats,
          loyalty: Math.min(5, foundingMember.commonStats.loyalty + 2),
        },
        traits: foundingMember.traits.map((t) => ({
          ...t,
          disclosureState: 'revealed' as const,
        })),
      };

      set((store) => {
        store.state = {
          turn: 1,
          phase: 1,
          companyName,
          ceo: { domain, stats },
          capital: 2000,
          currentFatigue: maxFatigue,
          actionCooldowns: createInitialCooldowns(),
          employees: [founder],
          pendingResumes: [],
          activeProjects: [],
          availableProjects: generateInitialProjects(),
          completedProjectCount: 0,
          consecutiveProfitTurns: 0,
          teamChemistry: 50,
          pairChemistry: {},
          eventLog: [{
            turn: 1,
            layer: 'deterministic',
            message: `${founder.name}(개발자)이(가) 공동 창업 멤버로 합류했습니다.`,
            timestamp: Date.now(),
          }],
          pendingEvents: [],
          gameStatus: 'playing',
          crisisGraceTurnsLeft: 0,
          endingGrade: null,
          outsourcingProfitTurns: 0,
        };
        store.prevTurnSnapshot = null;
      });
    },

    // ─── Phase 진행 ───────────────────────────────────────────
    advancePhase: () => {
      set((store) => {
        const currentPhase = store.state.phase;

        if (currentPhase === 1) {
          // Phase1 → Phase2: 이벤트 생성
          const pending = generatePendingEvents(store.state as GameState);
          store.state.pendingEvents = [...store.state.pendingEvents, ...pending];
          store.state.phase = 2;
        } else if (currentPhase === 2) {
          // Phase2 → Phase3 (자동 실행)
          store.state.phase = 3;
          const result = runPhase3Execution(store.state as GameState);
          Object.assign(store.state, result);
          // Phase3 → Phase4 자동
          store.state.phase = 4;
          const result4 = runPhase4Settlement(store.state as GameState);
          Object.assign(store.state, result4);
          // Phase4 → Phase5
          store.state.phase = 5;
        } else if (currentPhase === 5) {
          // Phase5 → 다음 턴 Phase1
          store.prevTurnSnapshot = JSON.parse(JSON.stringify(store.state));
          store.state.turn += 1;
          store.state.phase = 1;
          // 피로도 리셋
          const maxFatigue = calcMaxFatigue(store.state.ceo.stats.leadership);
          store.state.currentFatigue = maxFatigue;
          // 새 프로젝트 보충 (available 3개 유지)
          if (store.state.availableProjects.length < 2) {
            const newProjects = generateInitialProjects();
            store.state.availableProjects.push(...newProjects.slice(0, 2));
          }
        }
      });
    },

    // Phase2에서 즉시 Phase5로 (남은 피로도 포기)
    endTurn: () => {
      set((store) => {
        if (store.state.phase !== 2) return;
        store.state.phase = 3;
        const result3 = runPhase3Execution(store.state as GameState);
        Object.assign(store.state, result3);
        store.state.phase = 4;
        const result4 = runPhase4Settlement(store.state as GameState);
        Object.assign(store.state, result4);
        store.state.phase = 5;
      });
    },

    // ─── 채용 공고 ────────────────────────────────────────────
    postJobListing: () => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'postJobListing')) return;
        const cost = applyActionCost(store.state as GameState, 'postJobListing');
        Object.assign(store.state, cost);

        const resumes = generateResumes(randInt(3, 5), INITIAL_REPUTATION, store.state.turn);
        store.state.pendingResumes = resumes;
        store.state.eventLog.push({
          turn: store.state.turn,
          layer: 'deterministic',
          message: `채용 공고 게시 — 이력서 ${resumes.length}장 수집됨`,
          timestamp: Date.now(),
        });
      });
    },

    // ─── 면접 및 채용 확정 ────────────────────────────────────
    conductInterview: (candidateId) => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'conductInterview')) return;
        const candidate = store.state.pendingResumes.find((r) => r.id === candidateId);
        if (!candidate) return;

        const cost = applyActionCost(store.state as GameState, 'conductInterview');
        Object.assign(store.state, cost);

        store.state.pendingResumes = store.state.pendingResumes.filter((r) => r.id !== candidateId);
        store.state.employees.push(candidate);

        // 쌍 케미 업데이트
        const newMap = buildPairChemistryMap(store.state.employees as Employee[]);
        store.state.pairChemistry = newMap;

        store.state.eventLog.push({
          turn: store.state.turn,
          layer: 'deterministic',
          message: `${candidate.name}(${candidate.role}) 채용 확정`,
          timestamp: Date.now(),
        });
      });
    },

    // ─── 해고 ─────────────────────────────────────────────────
    fireEmployee: (employeeId) => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'fireEmployee')) return;
        const emp = store.state.employees.find((e) => e.id === employeeId);
        if (!emp) return;

        const cost = applyActionCost(store.state as GameState, 'fireEmployee');
        Object.assign(store.state, cost);

        store.state.employees = store.state.employees.filter((e) => e.id !== employeeId);
        // 프로젝트 배정 해제
        store.state.activeProjects = store.state.activeProjects.map((p) => ({
          ...p,
          assignedEmployeeIds: p.assignedEmployeeIds.filter((id) => id !== employeeId),
        }));

        // 케미 페널티 (갑작스러운 해고)
        store.state.teamChemistry = Math.max(0, store.state.teamChemistry - 10);

        store.state.eventLog.push({
          turn: store.state.turn,
          layer: 'deterministic',
          message: `${emp.name} 해고 — 팀 케미 -10`,
          timestamp: Date.now(),
        });
      });
    },

    // ─── 연봉 조정 ────────────────────────────────────────────
    adjustSalary: (employeeId, newSalary) => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'adjustSalary')) return;
        const emp = store.state.employees.find((e) => e.id === employeeId);
        if (!emp) return;

        const cost = applyActionCost(store.state as GameState, 'adjustSalary');
        Object.assign(store.state, cost);

        const oldSalary = emp.salary;
        emp.salary = newSalary;
        if (newSalary > oldSalary) {
          emp.commonStats.loyalty = Math.min(5, emp.commonStats.loyalty + 2);
        }
        store.state.eventLog.push({
          turn: store.state.turn,
          layer: 'deterministic',
          message: `${emp.name} 연봉 조정: ${oldSalary.toLocaleString()} → ${newSalary.toLocaleString()}만원`,
          timestamp: Date.now(),
        });
      });
    },

    // ─── 외주 계약 체결 ───────────────────────────────────────
    signContract: (projectId) => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'signContract')) return;
        const proj = store.state.availableProjects.find((p) => p.id === projectId);
        if (!proj) return;

        const cost = applyActionCost(store.state as GameState, 'signContract');
        Object.assign(store.state, cost);

        const advance = Math.round(proj.totalAmount * 0.3);
        store.state.capital += advance;
        store.state.availableProjects = store.state.availableProjects.filter((p) => p.id !== projectId);
        store.state.activeProjects.push({ ...proj, status: 'active', advancePaid: true });

        store.state.eventLog.push({
          turn: store.state.turn,
          layer: 'deterministic',
          message: `[${proj.name}] 계약 체결 — 선금 +${advance.toLocaleString()}만원`,
          timestamp: Date.now(),
        });
      });
    },

    // ─── 업무 배분 변경 ───────────────────────────────────────
    changeAssignment: (employeeId, projectId, percentage) => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'changeAssignment')) return;
        const emp = store.state.employees.find((e) => e.id === employeeId);
        const proj = store.state.activeProjects.find((p) => p.id === projectId);
        if (!emp || !proj) return;

        const cost = applyActionCost(store.state as GameState, 'changeAssignment');
        Object.assign(store.state, cost);

        emp.projectAssignments[projectId] = percentage;

        // assignedEmployeeIds 동기화
        if (percentage > 0 && !proj.assignedEmployeeIds.includes(employeeId)) {
          proj.assignedEmployeeIds.push(employeeId);
        } else if (percentage === 0) {
          proj.assignedEmployeeIds = proj.assignedEmployeeIds.filter((id) => id !== employeeId);
        }
      });
    },

    // ─── 일괄 인력 배정 ──────────────────────────────────────
    setProjectAssignments: (projectId, employeeIds) => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'changeAssignment')) return;
        const proj = store.state.activeProjects.find((p) => p.id === projectId);
        if (!proj) return;

        const cost = applyActionCost(store.state as GameState, 'changeAssignment');
        Object.assign(store.state, cost);

        proj.assignedEmployeeIds = [...employeeIds];

        for (const emp of store.state.employees) {
          if (employeeIds.includes(emp.id)) {
            emp.projectAssignments[projectId] = 100;
          } else {
            delete emp.projectAssignments[projectId];
          }
        }

        store.state.eventLog.push({
          turn: store.state.turn,
          layer: 'deterministic',
          message: `[${proj.name}] 인력 배정 변경 — ${employeeIds.length}명`,
          timestamp: Date.now(),
        });
      });
    },

    // ─── 야근 지시 ────────────────────────────────────────────
    orderOvertime: (projectId) => {
      set((store) => {
        if (!canPerformAction(store.state as GameState, 'orderOvertime')) return;
        const proj = store.state.activeProjects.find((p) => p.id === projectId);
        if (!proj) return;

        const cost = applyActionCost(store.state as GameState, 'orderOvertime');
        Object.assign(store.state, cost);

        proj.overtimeActive = true;
        store.state.eventLog.push({
          turn: store.state.turn,
          layer: 'deterministic',
          message: `[${proj.name}] 야근 지시`,
          timestamp: Date.now(),
        });
      });
    },

    // ─── 이벤트 해결 ──────────────────────────────────────────
    resolveEvent: (eventId, choiceIndex) => {
      set((store) => {
        const event = store.state.pendingEvents.find((e) => e.id === eventId);
        if (!event) return;

        store.state.pendingEvents = store.state.pendingEvents.filter((e) => e.id !== eventId);

        // 이벤트 타입별 처리
        if (event.type === 'probationConversion' && event.targetId) {
          const emp = store.state.employees.find((e) => e.id === event.targetId);
          if (emp) {
            if (choiceIndex === 0) {
              // 정규직 전환
              emp.probationTurnsLeft = -1; // 수습 완료 마킹 (이벤트 재발 방지)
              emp.commonStats.loyalty = Math.min(5, emp.commonStats.loyalty + 2);
              store.state.eventLog.push({
                turn: store.state.turn,
                layer: 'deterministic',
                message: `${emp.name} 정규직 전환`,
                timestamp: Date.now(),
              });
            } else {
              // 계약 종료
              store.state.employees = store.state.employees.filter((e) => e.id !== event.targetId);
              store.state.eventLog.push({
                turn: store.state.turn,
                layer: 'deterministic',
                message: `${emp.name} 계약 종료 (수습 탈락)`,
                timestamp: Date.now(),
              });
            }
          }
        } else if (event.type === 'salaryNegotiation' && event.targetId) {
          const emp = store.state.employees.find((e) => e.id === event.targetId);
          if (emp) {
            if (choiceIndex === 0) {
              emp.salary = Math.round(emp.salary * 1.1);
              emp.commonStats.loyalty = Math.min(5, emp.commonStats.loyalty + 2);
            } else if (choiceIndex === 1) {
              emp.salary = Math.round(emp.salary * 1.05);
              emp.commonStats.loyalty = Math.min(5, emp.commonStats.loyalty + 1);
            } else {
              emp.commonStats.loyalty = Math.max(-1, emp.commonStats.loyalty - 2);
            }
          }
        }
        // deadlineApproaching / capitalCrisis는 '확인' 선택만 있음 (효과 없음)
      });
    },
  })),
);
