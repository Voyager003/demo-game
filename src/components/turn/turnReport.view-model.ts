import { EconomyLedger } from '../../domain/economy';
import type { GameState } from '../../types/core';
import type { LogEntry } from '../../types/event';

export interface TurnReportSummary {
  capitalDelta: number;
  monthlyBurn: number;
  recurringRevenue: number;
  monthlyNetBurn: number;
  runway: number;
  recentLogs: LogEntry[];
  employeeCount: number;
}

export function buildTurnReportSummary(
  state: GameState,
  previousState: GameState | null,
): TurnReportSummary {
  const monthlyBurn = EconomyLedger.monthlyBurn(state.employees);
  const recurringRevenue = EconomyLedger.effectiveRecurringRevenue(state.activeProjects, state.employees);
  const monthlyNetBurn = EconomyLedger.effectiveMonthlyNetBurn(state.employees, state.activeProjects);

  return {
    capitalDelta: previousState ? state.capital - previousState.capital : 0,
    monthlyBurn,
    recurringRevenue,
    monthlyNetBurn,
    runway: EconomyLedger.runwayInTurns(state.capital, monthlyNetBurn),
    recentLogs: state.eventLog.slice(-8).reverse(),
    employeeCount: state.employees.length,
  };
}
