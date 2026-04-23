import type { Employee } from '../../types/employee';
import type { Project } from '../../types/project';

export class ContractPaymentTerms {
  readonly advanceRatio: number;
  readonly finalRatio: number;

  constructor(
    advanceRatio = 0.3,
    finalRatio = 0.7,
  ) {
    this.advanceRatio = advanceRatio;
    this.finalRatio = finalRatio;
  }

  advance(totalAmount: number): number {
    return Math.round(totalAmount * this.advanceRatio);
  }

  finalBase(totalAmount: number): number {
    return Math.round(totalAmount * this.finalRatio);
  }
}

export class AssignmentPolicy {
  private readonly fullAssignmentPercent: number;

  constructor(fullAssignmentPercent = 100) {
    this.fullAssignmentPercent = fullAssignmentPercent;
  }

  assignedPercentage(isAssigned: boolean): number {
    return isAssigned ? this.fullAssignmentPercent : 0;
  }
}

export class ProjectFailurePolicy {
  private readonly unassignedGraceTurns: number;

  constructor(unassignedGraceTurns = 3) {
    this.unassignedGraceTurns = unassignedGraceTurns;
  }

  shouldFail(project: Project, assignedEmployees: Employee[], turnsElapsed: number): boolean {
    return assignedEmployees.length === 0 && turnsElapsed > project.turnsRequired + this.unassignedGraceTurns;
  }
}

export class ProjectAvailabilityPolicy {
  private readonly minimumAvailable: number;
  private readonly replenishCount: number;

  constructor(
    minimumAvailable = 2,
    replenishCount = 2,
  ) {
    this.minimumAvailable = minimumAvailable;
    this.replenishCount = replenishCount;
  }

  needsReplenishment(availableProjects: Project[]): boolean {
    return availableProjects.length < this.minimumAvailable;
  }

  replenishCountFor(): number {
    return this.replenishCount;
  }
}

export const DEFAULT_CONTRACT_PAYMENT_TERMS = new ContractPaymentTerms();
export const DEFAULT_ASSIGNMENT_POLICY = new AssignmentPolicy();
export const DEFAULT_PROJECT_FAILURE_POLICY = new ProjectFailurePolicy();
export const DEFAULT_PROJECT_AVAILABILITY_POLICY = new ProjectAvailabilityPolicy();
