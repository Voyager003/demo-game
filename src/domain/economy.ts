import type { Employee } from '../types/employee';
import type { LayerEffect } from '../types/layer';
import type { Project } from '../types/project';
import { resolveEconomyDeterministicMetrics } from './layers/deterministic-layer';
import {
  DEFAULT_FINAL_PAYMENT_POLICY,
  DEFAULT_OPERATING_COST_POLICY,
  DEFAULT_RUNWAY_POLICY,
} from './policies/economy-policies';

export class EconomyLedger {
  static monthlySalaries(employees: Employee[]): number {
    return employees.reduce((sum, employee) => sum + Math.round(employee.salary / 12), 0);
  }

  static monthlyOperatingCosts(employeeCount: number, operatingCostPercent = 0): number {
    const base = DEFAULT_OPERATING_COST_POLICY.monthlyCost(employeeCount);
    return Math.round(base * (1 + operatingCostPercent));
  }

  static monthlyBurn(employees: Employee[], operatingCostPercent = 0): number {
    return this.monthlySalaries(employees) + this.monthlyOperatingCosts(employees.length, operatingCostPercent);
  }

  static monthlyRecurringRevenue(projects: Project[]): number {
    return projects.reduce((sum, project) => {
      if (project.kind !== 'ownedProduct' || project.status !== 'operating') return sum;
      return sum + project.monthlyRevenue;
    }, 0);
  }

  static effectiveRecurringRevenue(
    projects: Project[],
    employees: Employee[],
    teamChem = 50,
    externalEffects: LayerEffect[] = [],
  ): number {
    return resolveEconomyDeterministicMetrics(projects, employees, teamChem, externalEffects).recurringRevenue.finalValue;
  }

  // effectiveRecurringRevenue 기반의 실효 순현금흐름
  static effectiveMonthlyNetBurn(
    employees: Employee[],
    projects: Project[],
    teamChem = 50,
    externalEffects: LayerEffect[] = [],
    operatingCostPercent = 0,
  ): number {
    return this.monthlyBurn(employees, operatingCostPercent)
      - this.effectiveRecurringRevenue(projects, employees, teamChem, externalEffects);
  }

  static monthlyNetBurn(employees: Employee[], projects: Project[]): number {
    return this.monthlyBurn(employees) - this.monthlyRecurringRevenue(projects);
  }

  static runwayInTurns(capital: number, monthlyBurn: number): number {
    return DEFAULT_RUNWAY_POLICY.turns(capital, monthlyBurn);
  }

  static finalPayment(project: Project): number {
    return DEFAULT_FINAL_PAYMENT_POLICY.payment(project.totalAmount, project.clientSatisfaction);
  }
}
