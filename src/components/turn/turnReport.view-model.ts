import { EconomyLedger } from '../../domain/economy';
import { defaultCompanyStagePressurePolicy } from '../../domain/policies/company-stage-policies';
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
  const stagePressure = defaultCompanyStagePressurePolicy.evaluate(state);
  const monthlyBurn = EconomyLedger.monthlyBurn(
    state.employees,
    stagePressure.profile.operatingCostPercent,
  );
  const recurringRevenue = EconomyLedger.effectiveRecurringRevenue(
    state.activeProjects,
    state.employees,
    state.organization.chemistry.teamChem,
    stagePressure.recurringRevenueEffects,
  );
  const monthlyNetBurn = EconomyLedger.effectiveMonthlyNetBurn(
    state.employees,
    state.activeProjects,
    state.organization.chemistry.teamChem,
    stagePressure.recurringRevenueEffects,
    stagePressure.profile.operatingCostPercent,
  );

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
