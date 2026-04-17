import type { Employee } from '../types/employee';
import type { Project } from '../types/project';

export class EconomyLedger {
  static monthlySalaries(employees: Employee[]): number {
    return employees.reduce((sum, employee) => sum + Math.round(employee.salary / 12), 0);
  }

  static monthlyOperatingCosts(employeeCount: number): number {
    return 200 + employeeCount * 50;
  }

  static monthlyBurn(employees: Employee[]): number {
    return this.monthlySalaries(employees) + this.monthlyOperatingCosts(employees.length);
  }

  static runwayInTurns(capital: number, monthlyBurn: number): number {
    if (monthlyBurn <= 0) return Infinity;
    return Math.max(0, Math.floor((capital / monthlyBurn) * 4));
  }

  static finalPayment(project: Project): number {
    return Math.round(project.totalAmount * 0.7 * this.satisfactionMultiplier(project.clientSatisfaction));
  }

  private static satisfactionMultiplier(satisfaction: number): number {
    if (satisfaction >= 90) return 1.05;
    if (satisfaction >= 70) return 1;
    if (satisfaction >= 50) return 0.9;
    if (satisfaction >= 30) return 0.7;
    return 0.5;
  }
}
