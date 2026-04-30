import { EconomyLedger } from '../../domain/economy';
import { defaultCompanyStagePressurePolicy } from '../../domain/policies/company-stage-policies';
import type { GameState } from '../../types/core';
import type { Employee } from '../../types/employee';
import type { Project } from '../../types/project';

export const MAIN_REVENUE_ROLE_LABELS: Record<string, string> = {
  developer: '개발자',
  designer: '디자이너',
  pm: 'PM',
};

export interface MainRevenueEmployeeContribution {
  employee: Employee;
  employeeId: string;
  roleLabel: string;
  totalProjects: number;
  contribution: number;
}

export interface MainRevenueViewModel {
  mainProject: Project;
  baseRevenue: number;
  effectiveRevenue: number;
  revenueRatio: number;
  revenueColor: string;
  isPhase2: boolean;
  assignedEmployees: Employee[];
  employeeContributions: MainRevenueEmployeeContribution[];
  unassignedEmployeeNames: string[];
  avgCommunication: number;
  chemBonus: number;
}

export function buildMainRevenueViewModel(state: GameState): MainRevenueViewModel | null {
  const mainProject = state.activeProjects.find((project) => project.isMainRevenue);
  if (!mainProject) return null;

  const baseRevenue = mainProject.monthlyRevenue;
  const stagePressure = defaultCompanyStagePressurePolicy.evaluate(state);
  const effectiveRevenue = EconomyLedger.effectiveRecurringRevenue(
    state.activeProjects,
    state.employees,
    state.organization.chemistry.teamChem,
    stagePressure.recurringRevenueEffects,
  );
  const revenueRatio = baseRevenue > 0 ? Math.round((effectiveRevenue / baseRevenue) * 100) : 0;
  const assignedEmployees = state.employees.filter((employee) =>
    mainProject.assignedEmployeeIds.includes(employee.id),
  );
  const avgCommunication = assignedEmployees.length > 0
    ? assignedEmployees.reduce((sum, employee) => sum + employee.commonStats.communication, 0) / assignedEmployees.length
    : 0;
  const employeeProjectCount = countEmployeeProjects(state.activeProjects);

  return {
    mainProject,
    baseRevenue,
    effectiveRevenue,
    revenueRatio,
    revenueColor: getMainRevenueColor(revenueRatio),
    isPhase2: state.phase === 2,
    assignedEmployees,
    employeeContributions: assignedEmployees.map((employee) => {
      const totalProjects = employeeProjectCount.get(employee.id) ?? 1;
      return {
        employee,
        employeeId: employee.id,
        roleLabel: MAIN_REVENUE_ROLE_LABELS[employee.role] ?? employee.role,
        totalProjects,
        contribution: Math.round((1 / totalProjects) * 100),
      };
    }),
    unassignedEmployeeNames: state.employees
      .filter((employee) => !mainProject.assignedEmployeeIds.includes(employee.id))
      .map((employee) => employee.name),
    avgCommunication,
    chemBonus: (state.organization.chemistry.teamChem - 50) + Math.round(avgCommunication * 3),
  };
}

export function getMainRevenueColor(revenueRatio: number): string {
  if (revenueRatio >= 90) return 'positive';
  if (revenueRatio >= 60) return '';
  if (revenueRatio >= 30) return 'warning';
  return 'danger';
}

function countEmployeeProjects(projects: Project[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const project of projects) {
    if (project.status !== 'active' && project.status !== 'operating') continue;
    for (const employeeId of project.assignedEmployeeIds) {
      counts.set(employeeId, (counts.get(employeeId) ?? 0) + 1);
    }
  }
  return counts;
}
