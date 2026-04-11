import { calcProgressPerTurn, deliverProject, checkProjectFailure } from './projectEngine';
import { applyMonthlySettlement, calcMonthlyBurn } from './economyEngine';
import { recalcTeamChemistry, applyCommonStatChemistryEffects } from './chemistryEngine';
import { decrementCooldowns } from './fatigue';
import { revealTraits } from './hiringEngine';
import { checkCrisisEntry, checkEndingConditions, checkEmployeeTurnover } from './endingEngine';
import type { GameState } from '../types/core';
import type { Project } from '../types/project';
import type { LogEntry } from '../types/event';

function makeLog(turn: number, message: string, layer: LogEntry['layer'] = 'deterministic'): LogEntry {
  return { turn, layer, message, timestamp: Date.now() };
}

// ─── Phase 3: 실행 (자동) ────────────────────────────────────
export function runPhase3Execution(state: GameState): Partial<GameState> {
  const logs: LogEntry[] = [];
  let activeProjects = [...state.activeProjects];
  const completedThisTurn: Project[] = [];
  let employees = state.employees.map((emp) => {
    // 수습 카운트 감소
    if (emp.probationTurnsLeft > 0) {
      const updated = { ...emp, probationTurnsLeft: emp.probationTurnsLeft - 1 };
      return revealTraits(updated);
    }
    return emp;
  });

  const hasCTO = employees.some(
    (e) => e.role === 'developer' && e.specialistStats &&
    Object.values(e.specialistStats).reduce((a, b) => a + b, 0) >= 40,
  );

  // 프로젝트 진척도 계산
  activeProjects = activeProjects.map((proj) => {
    if (proj.status !== 'active') return proj;

    const assigned = employees.filter((e) =>
      proj.assignedEmployeeIds.includes(e.id),
    );
    const progressGain = calcProgressPerTurn(
      proj,
      assigned,
      state.teamChemistry,
      state.ceo.stats.techUnderstanding,
      hasCTO,
    );

    const newProgress = Math.min(100, proj.progress + progressGain);
    const newElapsed = proj.turnsElapsed + 1;

    // 납품 조건 충족
    if (newProgress >= 100) {
      const delivered = deliverProject(
        { ...proj, progress: newProgress, turnsElapsed: newElapsed },
        assigned,
      );
      completedThisTurn.push(delivered);
      logs.push(makeLog(state.turn, `[${proj.name}] 납품 완료 (만족도 ${delivered.clientSatisfaction}%)`));
      return delivered;
    }

    // 실패 판정
    if (checkProjectFailure({ ...proj, turnsElapsed: newElapsed })) {
      logs.push(makeLog(state.turn, `[${proj.name}] 프로젝트 실패 (인력 부족)`, 'probabilistic'));
      return { ...proj, status: 'failed' as const, turnsElapsed: newElapsed };
    }

    return { ...proj, progress: newProgress, turnsElapsed: newElapsed };
  });

  // 쿨타임 감소
  const actionCooldowns = decrementCooldowns(state.actionCooldowns);

  return {
    activeProjects,
    employees,
    actionCooldowns,
    eventLog: [...state.eventLog, ...logs],
  };
}

// ─── Phase 4: 정산 (자동) ────────────────────────────────────
export function runPhase4Settlement(state: GameState): Partial<GameState> {
  const logs: LogEntry[] = [];
  let capital = state.capital;
  let gameStatus = state.gameStatus;
  let crisisGraceTurnsLeft = state.crisisGraceTurnsLeft;
  let outsourcingProfitTurns = state.outsourcingProfitTurns;

  // 완료된 프로젝트 수집 (잔금 미수령)
  const completedUnpaid = state.activeProjects.filter(
    (p) => p.status === 'completed' && !p.finalPaid,
  );

  // 4턴마다 월 정산
  let activeProjects = [...state.activeProjects];
  if (state.turn % 4 === 0) {
    const { capitalDelta, log: settlementLog } = applyMonthlySettlement(
      state,
      completedUnpaid,
    );
    capital += capitalDelta;
    logs.push(...settlementLog.map((msg) => makeLog(state.turn, msg)));

    // 잔금 처리된 프로젝트 완료 표시
    activeProjects = activeProjects.map((p) =>
      completedUnpaid.find((cp) => cp.id === p.id)
        ? { ...p, finalPaid: true }
        : p,
    );

    // 흑자 턴 카운트
    const monthlyBurn = calcMonthlyBurn(state.employees);
    const monthlyIncome = completedUnpaid.reduce(
      (sum, p) => sum + p.totalAmount * 0.7 * (p.clientSatisfaction / 100),
      0,
    );
    if (monthlyIncome > monthlyBurn) {
      outsourcingProfitTurns += 1;
    } else {
      outsourcingProfitTurns = 0; // 연속 흑자 리셋
    }
  }

  // 팀 케미 재계산
  let teamChemistry = recalcTeamChemistry(
    state.employees,
    state.pairChemistry,
    state.ceo.stats.leadership,
  );
  teamChemistry = applyCommonStatChemistryEffects(teamChemistry, state.employees);

  // 이직 판정
  const quitIds = checkEmployeeTurnover(state.employees);
  let employees = state.employees.filter((e) => !quitIds.includes(e.id));
  for (const id of quitIds) {
    const emp = state.employees.find((e) => e.id === id);
    if (emp) {
      logs.push(makeLog(state.turn, `${emp.name}이(가) 이직했습니다.`, 'probabilistic'));
    }
  }

  // 위기 진입 판정
  const { enter, graceTurns } = checkCrisisEntry({ ...state, capital });
  if (enter) {
    gameStatus = 'crisis';
    crisisGraceTurnsLeft = graceTurns;
    logs.push(makeLog(state.turn, '자본 고갈! 위기 상태 진입. 유예 기간이 시작됩니다.', 'chain'));
  } else if (gameStatus === 'crisis') {
    crisisGraceTurnsLeft = Math.max(0, crisisGraceTurnsLeft - 1);
    if (capital > 0) {
      gameStatus = 'playing';
      logs.push(makeLog(state.turn, '위기를 벗어났습니다!'));
    }
  }

  // 엔딩 판정
  const endingGrade = checkEndingConditions({
    ...state,
    capital,
    gameStatus,
    crisisGraceTurnsLeft,
    outsourcingProfitTurns,
    employees,
  });

  return {
    capital,
    activeProjects,
    employees,
    teamChemistry,
    gameStatus: endingGrade ? 'ended' : gameStatus,
    crisisGraceTurnsLeft,
    outsourcingProfitTurns,
    endingGrade: endingGrade ?? state.endingGrade,
    eventLog: [...state.eventLog, ...logs],
  };
}
