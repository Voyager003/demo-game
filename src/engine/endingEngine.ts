import type { GameState, EndingGrade } from '../types/core';
import type { Employee } from '../types/employee';

// ─── 위기 유예 기간 계산 ──────────────────────────────────────
export function getCrisisGraceTurns(state: GameState): number {
  const hasReceivables = state.activeProjects.some(
    (p) => p.status === 'active' && !p.finalPaid,
  );
  return hasReceivables ? 8 : 4;
}

// ─── 위기 진입 판정 ───────────────────────────────────────────
export function checkCrisisEntry(
  state: GameState,
): { enter: boolean; graceTurns: number } {
  if (state.capital <= 0 && state.gameStatus === 'playing') {
    return { enter: true, graceTurns: getCrisisGraceTurns(state) };
  }
  return { enter: false, graceTurns: 0 };
}

// ─── 엔딩 조건 판정 ───────────────────────────────────────────
export function checkEndingConditions(state: GameState): EndingGrade | null {
  // F등급: 위기 + 유예 소진
  if (state.gameStatus === 'crisis' && state.crisisGraceTurnsLeft <= 0) {
    return 'F';
  }

  // B등급: 외주 수익 20턴+ 흑자
  if (state.outsourcingProfitTurns >= 20) {
    return 'B';
  }

  // C등급: 50턴 생존 + 흑자 (위기 아님)
  if (state.turn >= 50 && state.gameStatus === 'playing') {
    return 'C';
  }

  return null;
}

// ─── 직원 이직 판정 (Phase4 마다) ────────────────────────────
// loyalty -1인 직원: 30% 확률 이직
export function checkEmployeeTurnover(employees: Employee[]): string[] {
  const quitIds: string[] = [];
  for (const emp of employees) {
    if (emp.commonStats.loyalty === -1) {
      if (Math.random() < 0.3) {
        quitIds.push(emp.id);
      }
    }
  }
  return quitIds;
}
