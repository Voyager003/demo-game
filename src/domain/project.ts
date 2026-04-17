import { LV1_PROJECT_TEMPLATES } from '../constants/projectTemplates';
import { employeeWeeklyContribution } from './employee';
import type { Employee } from '../types/employee';
import type { Project } from '../types/project';

export interface ProjectEstimate {
  progressPerTurn: number;
  turnsLeft: number;
  finishTurn: number;
}

export interface ProjectProgressResult {
  projects: Project[];
  completedProjects: Project[];
  overtimeEmployeeIds: string[];
  logs: string[];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function generateInitialProjects(count = 3): Project[] {
  const projects: Project[] = [];
  for (let i = 0; i < count; i += 1) {
    const template = randFrom(LV1_PROJECT_TEMPLATES);
    projects.push({
      id: generateId(),
      name: template.name,
      level: 1,
      totalAmount: randInt(template.minAmount, template.maxAmount),
      advancePaid: false,
      finalPaid: false,
      turnsRequired: randInt(template.minTurns, template.maxTurns),
      turnsElapsed: 0,
      progress: 0,
      assignedEmployeeIds: [],
      status: 'available',
      clientSatisfaction: 0,
      overtimeActive: false,
    });
  }
  return projects;
}

export function calculateProgressPerTurn(project: Project, assignedEmployees: Employee[]): number {
  if (assignedEmployees.length === 0) return 0;
  const baseContribution = assignedEmployees.reduce(
    (sum, employee) => sum + employeeWeeklyContribution(employee),
    0,
  );
  const overtimeMultiplier = project.overtimeActive ? 1.25 : 1;
  return baseContribution * 5 * overtimeMultiplier;
}

export function estimateProjectCompletion(
  project: Project,
  selectedEmployees: Employee[],
  currentTurn: number,
): ProjectEstimate | null {
  const progressPerTurn = calculateProgressPerTurn(
    { ...project, assignedEmployeeIds: selectedEmployees.map((employee) => employee.id) },
    selectedEmployees,
  );
  if (progressPerTurn <= 0) return null;
  const turnsLeft = Math.ceil((100 - project.progress) / progressPerTurn);
  return {
    progressPerTurn,
    turnsLeft,
    finishTurn: currentTurn + turnsLeft,
  };
}

function calculateClientSatisfaction(project: Project, assignedEmployees: Employee[]): number {
  const avgContribution =
    assignedEmployees.length === 0
      ? 0
      : assignedEmployees.reduce((sum, employee) => sum + employeeWeeklyContribution(employee), 0) /
        assignedEmployees.length;
  const onTimeBonus = project.turnsElapsed <= project.turnsRequired ? 10 : -15;
  return clamp(Math.round(65 + avgContribution * 3 + onTimeBonus), 30, 100);
}

function completeProject(project: Project, assignedEmployees: Employee[]): Project {
  return {
    ...project,
    status: 'completed',
    progress: 100,
    clientSatisfaction: calculateClientSatisfaction(project, assignedEmployees),
    overtimeActive: false,
  };
}

export class ProjectPortfolio {
  private readonly activeProjects: Project[];
  private readonly availableProjects: Project[];

  constructor(activeProjects: Project[], availableProjects: Project[]) {
    this.activeProjects = activeProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] }));
    this.availableProjects = availableProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] }));
  }

  signContract(projectId: string): { portfolio: ProjectPortfolio; advance: number; projectName: string } | null {
    const project = this.availableProjects.find((candidate) => candidate.id === projectId);
    if (!project) return null;
    const advance = Math.round(project.totalAmount * 0.3);
    const contracted: Project = {
      ...project,
      status: 'active',
      advancePaid: true,
    };
    return {
      portfolio: new ProjectPortfolio(
        [...this.activeProjects, contracted],
        this.availableProjects.filter((candidate) => candidate.id !== projectId),
      ),
      advance,
      projectName: project.name,
    };
  }

  setAssignments(projectId: string, employeeIds: string[]): ProjectPortfolio {
    return new ProjectPortfolio(
      this.activeProjects.map((project) =>
        project.id === projectId
          ? { ...project, assignedEmployeeIds: [...employeeIds] }
          : project,
      ),
      this.availableProjects,
    );
  }

  removeEmployee(employeeId: string): ProjectPortfolio {
    return new ProjectPortfolio(
      this.activeProjects.map((project) => ({
        ...project,
        assignedEmployeeIds: project.assignedEmployeeIds.filter((id) => id !== employeeId),
      })),
      this.availableProjects,
    );
  }

  orderOvertime(projectId: string): ProjectPortfolio {
    return new ProjectPortfolio(
      this.activeProjects.map((project) =>
        project.id === projectId && project.status === 'active'
          ? { ...project, overtimeActive: true }
          : project,
      ),
      this.availableProjects,
    );
  }

  advanceWeek(employees: Employee[]): ProjectProgressResult {
    const logs: string[] = [];
    const completedProjects: Project[] = [];
    const overtimeEmployeeIds: string[] = [];

    const projects = this.activeProjects.map((project) => {
      if (project.status !== 'active') return project;
      const assigned = employees.filter((employee) =>
        project.assignedEmployeeIds.includes(employee.id),
      );
      if (project.overtimeActive) overtimeEmployeeIds.push(...project.assignedEmployeeIds);

      const progressGain = calculateProgressPerTurn(project, assigned);
      const turnsElapsed = project.turnsElapsed + 1;
      const progress = Math.min(100, project.progress + progressGain);

      if (progress >= 100) {
        const completed = completeProject({ ...project, progress, turnsElapsed }, assigned);
        completedProjects.push(completed);
        logs.push(`[${project.name}] 납품 완료 (만족도 ${completed.clientSatisfaction}%)`);
        return completed;
      }

      if (assigned.length === 0 && turnsElapsed > project.turnsRequired + 3) {
        logs.push(`[${project.name}] 프로젝트 실패 (인력 미배정)`);
        return { ...project, turnsElapsed, status: 'failed' as const, overtimeActive: false };
      }

      return { ...project, progress, turnsElapsed, overtimeActive: false };
    });

    return {
      projects,
      completedProjects,
      overtimeEmployeeIds: [...new Set(overtimeEmployeeIds)],
      logs,
    };
  }

  replenishAvailable(): ProjectPortfolio {
    if (this.availableProjects.length >= 2) return this;
    return new ProjectPortfolio(
      this.activeProjects,
      [...this.availableProjects, ...generateInitialProjects(2)],
    );
  }

  toSnapshots(): Pick<{ activeProjects: Project[]; availableProjects: Project[] }, 'activeProjects' | 'availableProjects'> {
    return {
      activeProjects: this.activeProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] })),
      availableProjects: this.availableProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] })),
    };
  }
}

