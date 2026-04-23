import { employeeSpecialistTotal } from '../../domain/employee';
import { estimateProjectCompletion, type ProjectEstimate } from '../../domain/project';
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
): ProjectEstimate | null {
  return estimateProjectCompletion(project, selectedEmployees, currentTurn);
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
