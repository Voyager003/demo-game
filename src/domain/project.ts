import {
  resolveProjectDeterministicMetrics,
  type ProjectDeterministicResolution,
} from './layers/deterministic-layer';
import { defaultProjectFactory } from './factories/project-factory';
import {
  DEFAULT_CONTRACT_PAYMENT_TERMS,
  DEFAULT_PROJECT_AVAILABILITY_POLICY,
  DEFAULT_PROJECT_FAILURE_POLICY,
} from './policies/project-policies';
import type { Domain } from '../types/ceo';
import type { Employee } from '../types/employee';
import type { Project } from '../types/project';
import type { LayerTraceInput } from './logging';

export interface ProjectEstimate {
  progressPerTurn: number;
  turnsLeft: number;
  finishTurn: number;
}

export interface ProjectProgressResult {
  projects: Project[];
  completedProjects: Project[];
  overtimeEmployeeIds: string[];
  logs: ProjectProgressLog[];
}

export interface ProjectProgressLog {
  message: string;
  source: string;
  layerTrace: LayerTraceInput;
}

export function generateMainRevenueProject(domain: Domain): Project {
  return defaultProjectFactory.generateMainRevenueProject(domain);
}

export function generateInitialProjects(count = 3): Project[] {
  return defaultProjectFactory.generateInitialProjects(count);
}

export function calculateProgressPerTurn(project: Project, assignedEmployees: Employee[]): number {
  if (assignedEmployees.length === 0) return 0;
  return resolveProjectDeterministicMetrics(project, assignedEmployees).progressPerTurn.finalValue;
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

function completeProject(project: Project, clientSatisfaction: number): Project {
  return {
    ...project,
    status: 'completed',
    progress: 100,
    clientSatisfaction,
    overtimeActive: false,
  };
}

function createProjectCompletionTrace(
  project: Project,
  assignedEmployees: Employee[],
  progressGain: number,
  resolution: ProjectDeterministicResolution,
): LayerTraceInput {
  return {
    layer: 'deterministic',
    rule: '프로젝트 진행/만족도 결정론 레이어 해석',
    trigger: '주간 진척 계산 후 progress가 100 이상',
    inputs: [
      `project=${project.name}`,
      `progressBefore=${Math.round(project.progress)}%`,
      `progressGain=${progressGain.toFixed(2)}%`,
      `assignedEmployees=${assignedEmployees.length}명`,
    ],
    effects: [
      resolution.progressPerTurn.trace.finalValue ?? '',
      ...resolution.progressPerTurn.trace.effects,
      resolution.clientSatisfaction.trace.finalValue ?? '',
      ...resolution.clientSatisfaction.trace.effects,
      'project.status=completed',
      'project.progress=100',
      `clientSatisfaction=${resolution.clientSatisfaction.finalValue}%`,
    ].filter(Boolean),
    finalValue: `progress=100, clientSatisfaction=${resolution.clientSatisfaction.finalValue}%`,
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
    const advance = DEFAULT_CONTRACT_PAYMENT_TERMS.advance(project.totalAmount);
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
    const logs: ProjectProgressLog[] = [];
    const completedProjects: Project[] = [];
    const overtimeEmployeeIds: string[] = [];

    const projects = this.activeProjects.map((project) => {
      if (project.status !== 'active') return project;
      const assigned = employees.filter((employee) =>
        project.assignedEmployeeIds.includes(employee.id),
      );
      if (project.overtimeActive) overtimeEmployeeIds.push(...project.assignedEmployeeIds);

      const deterministicResolution = resolveProjectDeterministicMetrics(project, assigned);
      const progressGain = deterministicResolution.progressPerTurn.finalValue;
      const turnsElapsed = project.turnsElapsed + 1;
      const progress = Math.min(100, project.progress + progressGain);

      if (progress >= 100) {
        const completedProject = { ...project, progress, turnsElapsed };
        const completionResolution = resolveProjectDeterministicMetrics(completedProject, assigned);
        const completed = completeProject(
          completedProject,
          completionResolution.clientSatisfaction.finalValue,
        );
        completedProjects.push(completed);
        logs.push({
          message: `[${project.name}] 납품 완료 (만족도 ${completed.clientSatisfaction}%)`,
          source: 'ProjectPortfolio.advanceWeek',
          layerTrace: createProjectCompletionTrace(
            project,
            assigned,
            progressGain,
            completionResolution,
          ),
        });
        return completed;
      }

      if (DEFAULT_PROJECT_FAILURE_POLICY.shouldFail(project, assigned, turnsElapsed)) {
        logs.push({
          message: `[${project.name}] 프로젝트 실패 (인력 미배정)`,
          source: 'ProjectPortfolio.advanceWeek',
          layerTrace: {
            rule: '인력 미배정 장기 방치 실패',
            trigger: '배정 인원이 0명. 경과 턴이 요구 턴 + 3을 초과',
            inputs: [
              `project=${project.name}`,
              `assignedEmployees=${assigned.length}명`,
              `turnsElapsed=${turnsElapsed}`,
              `turnsRequired=${project.turnsRequired}`,
            ],
            effects: [
              'project.status=failed',
              'overtimeActive=false',
            ],
          },
        });
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
    if (!DEFAULT_PROJECT_AVAILABILITY_POLICY.needsReplenishment(this.availableProjects)) return this;
    return new ProjectPortfolio(
      this.activeProjects,
      [
        ...this.availableProjects,
        ...generateInitialProjects(
          DEFAULT_PROJECT_AVAILABILITY_POLICY.replenishCountFor(),
        ),
      ],
    );
  }

  toSnapshots(): Pick<{ activeProjects: Project[]; availableProjects: Project[] }, 'activeProjects' | 'availableProjects'> {
    return {
      activeProjects: this.activeProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] })),
      availableProjects: this.availableProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] })),
    };
  }
}
