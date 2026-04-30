import { EconomyLedger } from '../../domain/economy';
import { EmployeeRoster } from '../../domain/employee';
import { employeeSpecialistTotal } from '../../domain/employee';
import { estimateProjectCompletion, ProjectPortfolio, type ProjectEstimate } from '../../domain/project';
import {
  defaultCompanyStagePressurePolicy,
} from '../../domain/policies/company-stage-policies';
import type { CompanyStageState } from '../../types/company-stage';
import type { Employee } from '../../types/employee';
import type { Project } from '../../types/project';

export function getSpecSum(employee: Employee): number {
  return employeeSpecialistTotal(employee);
}

export function statValClass(value: number): string {
  if (value >= 1) return 'positive';
  if (value <= -1) return 'danger';
  return 'neutral';
}

export function buildAssignmentEstimate(
  project: Project,
  selectedEmployees: Employee[],
  currentTurn: number,
  companyStage?: CompanyStageState,
  allProjects: Project[] = [project],
  allEmployees: Employee[] = selectedEmployees,
  teamChem = 50,
): ProjectEstimate | null {
  const pressure = companyStage
    ? defaultCompanyStagePressurePolicy.evaluate({
        companyStage,
        employees: allEmployees,
        activeProjects: allProjects,
        organization: {
          chemistry: {
            teamChem,
            pairChem: {},
            recentTensions: [],
            cultureHints: [],
          },
        },
      })
    : null;
  return estimateProjectCompletion(
    project,
    selectedEmployees,
    currentTurn,
    pressure?.projectEffects,
  );
}

export interface MainRevenueEstimate {
  effectiveRevenue: number;
  revenueRatio: number;
  summary: string;
}

export function buildMainRevenueEstimate(
  projectId: string,
  employeeIds: string[],
  projects: Project[],
  employees: Employee[],
  teamChem = 50,
  companyStage?: CompanyStageState,
): MainRevenueEstimate | null {
  const mainProject = projects.find((project) => project.id === projectId);
  if (!mainProject) return null;

  const simulatedProjects = new ProjectPortfolio(projects, [])
    .setAssignments(projectId, employeeIds)
    .toSnapshots()
    .activeProjects;
  const simulatedEmployees = new EmployeeRoster(employees)
    .setProjectAssignments(projectId, employeeIds)
    .toSnapshots();
  const pressure = companyStage
    ? defaultCompanyStagePressurePolicy.evaluate({
        companyStage,
        employees: simulatedEmployees,
        activeProjects: simulatedProjects,
        organization: {
          chemistry: {
            teamChem,
            pairChem: {},
            recentTensions: [],
            cultureHints: [],
          },
        },
      })
    : null;
  const effectiveRevenue = EconomyLedger.effectiveRecurringRevenue(
    simulatedProjects,
    simulatedEmployees,
    teamChem,
    pressure?.recurringRevenueEffects ?? [],
  );
  if (effectiveRevenue <= 0) return null;

  const revenueRatio = mainProject.monthlyRevenue > 0
    ? Math.round((effectiveRevenue / mainProject.monthlyRevenue) * 100)
    : 0;
  const summary =
    revenueRatio >= 100
      ? '집중 운영'
      : revenueRatio >= 70
        ? '부분 운영'
        : '외주 병행 손실';

  return { effectiveRevenue, revenueRatio, summary };
}

export function getOtherProjectCount(
  projects: Project[],
  projectId: string,
  employeeId: string,
): number {
  return projects.filter(
    (project) =>
      project.id !== projectId &&
      (project.status === 'active' || project.status === 'operating') &&
      project.assignedEmployeeIds.includes(employeeId),
  ).length;
}

export function isEmployeeAtCapacity(
  projects: Project[],
  projectId: string,
  selectedIds: string[],
  employee: Pick<Employee, 'id' | 'maxConcurrentProjects'>,
): boolean {
  return !selectedIds.includes(employee.id) &&
    getOtherProjectCount(projects, projectId, employee.id) >= employee.maxConcurrentProjects;
}
