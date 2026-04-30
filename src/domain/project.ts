import {
  resolveProjectDeterministicMetrics,
  type ProjectDeterministicResolution,
} from './layers/deterministic-layer';
import { defaultProjectFactory, type ProjectFactory } from './factories/project-factory';
import type { RandomSource } from './generation';
import {
  type ContractOfferLifecyclePolicy,
  type ContractOfferSpawnPolicy,
  DEFAULT_CONTRACT_PAYMENT_TERMS,
  DEFAULT_PROJECT_FAILURE_POLICY,
  DEFAULT_CONTRACT_OFFER_LIFECYCLE_POLICY,
  DEFAULT_CONTRACT_OFFER_SPAWN_POLICY,
} from './policies/project-policies';
import type { Domain } from '../types/ceo';
import type { Employee } from '../types/employee';
import type { LayerEffect } from '../types/layer';
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

export interface ProjectAdvanceContext {
  teamChem?: number;
  externalEffects?: LayerEffect[];
}

export interface ProjectProgressLog {
  message: string;
  source: string;
  layerTrace: LayerTraceInput;
}

export interface ContractOfferRefreshResult {
  portfolio: ProjectPortfolio;
  logs: ProjectProgressLog[];
}

export function generateMainRevenueProject(domain: Domain): Project {
  return defaultProjectFactory.generateMainRevenueProject(domain);
}

export function generateInitialProjects(count = 3, currentTurn = 1): Project[] {
  return defaultProjectFactory.generateInitialProjects(count, currentTurn);
}

export function calculateProgressPerTurn(
  project: Project,
  assignedEmployees: Employee[],
  externalEffects: LayerEffect[] = [],
): number {
  if (assignedEmployees.length === 0) return 0;
  return resolveProjectDeterministicMetrics(
    project,
    assignedEmployees,
    undefined,
    externalEffects,
  ).progressPerTurn.finalValue;
}

export function estimateProjectCompletion(
  project: Project,
  selectedEmployees: Employee[],
  currentTurn: number,
  externalEffects: LayerEffect[] = [],
): ProjectEstimate | null {
  const progressPerTurn = calculateProgressPerTurn(
    { ...project, assignedEmployeeIds: selectedEmployees.map((employee) => employee.id) },
    selectedEmployees,
    externalEffects,
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
      offeredAtTurn: null,
      expiresAtTurn: null,
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

  advanceWeek(employees: Employee[], context: ProjectAdvanceContext = {}): ProjectProgressResult {
    const logs: ProjectProgressLog[] = [];
    const completedProjects: Project[] = [];
    const overtimeEmployeeIds: string[] = [];

    const projects = this.activeProjects.map((project) => {
      if (project.status !== 'active') return project;
      const assigned = employees.filter((employee) =>
        project.assignedEmployeeIds.includes(employee.id),
      );
      if (project.overtimeActive) overtimeEmployeeIds.push(...project.assignedEmployeeIds);

      const deterministicResolution = resolveProjectDeterministicMetrics(
        project,
        assigned,
        context.teamChem,
        context.externalEffects,
      );
      const progressGain = deterministicResolution.progressPerTurn.finalValue;
      const turnsElapsed = project.turnsElapsed + 1;
      const progress = Math.min(100, project.progress + progressGain);

      if (progress >= 100) {
        const completedProject = { ...project, progress, turnsElapsed };
        const completionResolution = resolveProjectDeterministicMetrics(
          completedProject,
          assigned,
          context.teamChem,
          context.externalEffects,
        );
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

  refreshAvailableContracts(
    currentTurn: number,
    random: RandomSource,
    options: {
      projectFactory?: ProjectFactory;
      lifecyclePolicy?: ContractOfferLifecyclePolicy;
      spawnPolicy?: ContractOfferSpawnPolicy;
    } = {},
  ): ContractOfferRefreshResult {
    const projectFactory = options.projectFactory ?? defaultProjectFactory;
    const lifecyclePolicy = options.lifecyclePolicy ?? DEFAULT_CONTRACT_OFFER_LIFECYCLE_POLICY;
    const spawnPolicy = options.spawnPolicy ?? DEFAULT_CONTRACT_OFFER_SPAWN_POLICY;
    const logs: ProjectProgressLog[] = [];

    const expiredContracts = this.availableProjects.filter((project) =>
      lifecyclePolicy.isExpired(project, currentTurn),
    );
    const remainingContracts = this.availableProjects.filter((project) =>
      !lifecyclePolicy.isExpired(project, currentTurn),
    );

    for (const project of expiredContracts) {
      logs.push({
        message: `[${project.name}] 외주 제안 만료`,
        source: 'ProjectPortfolio.refreshAvailableContracts',
        layerTrace: {
          layer: 'deterministic',
          rule: '외주 제안 유지 기간 만료',
          trigger: '현재 턴이 expiresAtTurn 이상으로 진입',
          inputs: [
            `project=${project.name}`,
            `offeredAtTurn=${project.offeredAtTurn ?? '-'}`,
            `expiresAtTurn=${project.expiresAtTurn ?? '-'}`,
            `currentTurn=${currentTurn}`,
          ],
          effects: [
            'availableProjects에서 외주 제안 제거',
          ],
          finalValue: `project.status=expiredOffer`,
        },
      });
    }

    let spawnedContracts: Project[] = [];
    if (spawnPolicy.shouldSpawn(currentTurn, remainingContracts, random)) {
      const spawnCount = spawnPolicy.spawnCount(currentTurn, remainingContracts, random);
      if (spawnCount > 0) {
        spawnedContracts = projectFactory.generateInitialProjects(
          spawnCount,
          currentTurn,
          lifecyclePolicy,
        );
      }
    }

    for (const project of spawnedContracts) {
      logs.push({
        message: `[${project.name}] 신규 외주 제안 도착`,
        source: 'ProjectPortfolio.refreshAvailableContracts',
        layerTrace: {
          layer: 'deterministic',
          rule: '외주 제안 생성 윈도우 판정',
          trigger: '외주 제안 생성 주기와 확률 조건 충족',
          inputs: [
            `project=${project.name}`,
            `currentTurn=${currentTurn}`,
            `offeredAtTurn=${project.offeredAtTurn ?? '-'}`,
            `expiresAtTurn=${project.expiresAtTurn ?? '-'}`,
          ],
          effects: [
            `제안 유지=${lifecyclePolicy.remainingTurns(project, currentTurn)}턴`,
            'availableProjects에 외주 제안 추가',
          ],
          finalValue: `remainingTurns=${lifecyclePolicy.remainingTurns(project, currentTurn)}`,
        },
      });
    }

    return {
      portfolio: new ProjectPortfolio(
        this.activeProjects,
        [...remainingContracts, ...spawnedContracts],
      ),
      logs,
    };
  }

  toSnapshots(): Pick<{ activeProjects: Project[]; availableProjects: Project[] }, 'activeProjects' | 'availableProjects'> {
    return {
      activeProjects: this.activeProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] })),
      availableProjects: this.availableProjects.map((project) => ({ ...project, assignedEmployeeIds: [...project.assignedEmployeeIds] })),
    };
  }
}
