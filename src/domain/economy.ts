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

  static monthlyRecurringRevenue(projects: Project[]): number {
    return projects.reduce((sum, project) => {
      if (project.kind !== 'ownedProduct' || project.status !== 'operating') return sum;
      return sum + project.monthlyRevenue;
    }, 0);
  }

  // 외주 투입 현황 및 팀 케미를 반영한 실효 주수입원 매출
  static effectiveRecurringRevenue(projects: Project[], employees: Employee[]): number {
    const mainProject = projects.find((p) => p.isMainRevenue && p.status === 'operating');
    if (!mainProject) return 0;
    if (employees.length === 0) return 0;

    // 각 직원이 투입된 활성 프로젝트 수 집계
    const employeeProjectCount = new Map<string, number>();
    for (const project of projects) {
      if (project.status !== 'active' && project.status !== 'operating') continue;
      for (const empId of project.assignedEmployeeIds) {
        employeeProjectCount.set(empId, (employeeProjectCount.get(empId) ?? 0) + 1);
      }
    }

    const assignedCount = mainProject.assignedEmployeeIds.length;
    if (assignedCount === 0) return 0;

    // 주수입원 배정 직원들의 실질 기여도 합산 (외주 병행 시 분할)
    // 분모는 전체 직원이 아닌 주수입원 배정 직원 수 — 미배정 직원은 영향 없음
    let mainContribution = 0;
    let commSum = 0;

    for (const empId of mainProject.assignedEmployeeIds) {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) continue;
      const totalProjects = employeeProjectCount.get(empId) ?? 1;
      mainContribution += 1 / totalProjects;
      commSum += emp.commonStats.communication;
    }

    const contributionRatio = mainContribution / assignedCount;

    // 결정론적 케미 보정: 배정 직원 평균 소통 스탯 (-1~5) → -3%~+15%
    const avgComm = commSum / assignedCount;
    const chemMultiplier = 1 + avgComm * 0.03;

    return Math.max(0, Math.round(mainProject.monthlyRevenue * contributionRatio * chemMultiplier));
  }

  // effectiveRecurringRevenue 기반의 실효 순현금흐름
  static effectiveMonthlyNetBurn(employees: Employee[], projects: Project[]): number {
    return this.monthlyBurn(employees) - this.effectiveRecurringRevenue(projects, employees);
  }

  static monthlyNetBurn(employees: Employee[], projects: Project[]): number {
    return this.monthlyBurn(employees) - this.monthlyRecurringRevenue(projects);
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
