import type { RandomSource } from '../generation';
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

export class ContractOfferLifecyclePolicy {
  private readonly minimumLifetimeTurns: number;
  private readonly maximumLifetimeTurns: number;

  constructor(
    minimumLifetimeTurns = 3,
    maximumLifetimeTurns = 5,
  ) {
    this.minimumLifetimeTurns = minimumLifetimeTurns;
    this.maximumLifetimeTurns = maximumLifetimeTurns;
  }

  createOfferWindow(
    currentTurn: number,
    random: RandomSource,
  ): Pick<Project, 'offeredAtTurn' | 'expiresAtTurn'> {
    const lifetime = random.nextInt(this.minimumLifetimeTurns, this.maximumLifetimeTurns);
    return {
      offeredAtTurn: currentTurn,
      expiresAtTurn: currentTurn + lifetime,
    };
  }

  isExpired(project: Project, currentTurn: number): boolean {
    if (project.kind !== 'contract' || project.status !== 'available') return false;
    if (project.expiresAtTurn == null) return false;
    return currentTurn >= project.expiresAtTurn;
  }

  remainingTurns(project: Project, currentTurn: number): number {
    if (project.expiresAtTurn == null) return 0;
    return Math.max(0, project.expiresAtTurn - currentTurn);
  }
}

export class ContractOfferSpawnPolicy {
  private readonly minimumAvailable: number;
  private readonly maximumAvailable: number;
  private readonly spawnWindowInterval: number;
  private readonly opportunisticSpawnChance: number;
  private readonly multiOfferChance: number;
  private readonly maximumSpawnCount: number;

  constructor(
    minimumAvailable = 1,
    maximumAvailable = 3,
    spawnWindowInterval = 2,
    opportunisticSpawnChance = 0.65,
    multiOfferChance = 0.35,
    maximumSpawnCount = 2,
  ) {
    this.minimumAvailable = minimumAvailable;
    this.maximumAvailable = maximumAvailable;
    this.spawnWindowInterval = spawnWindowInterval;
    this.opportunisticSpawnChance = opportunisticSpawnChance;
    this.multiOfferChance = multiOfferChance;
    this.maximumSpawnCount = maximumSpawnCount;
  }

  canSpawnThisTurn(currentTurn: number): boolean {
    return currentTurn > 1 && currentTurn % this.spawnWindowInterval === 0;
  }

  shouldSpawn(currentTurn: number, availableProjects: Project[], random: RandomSource): boolean {
    if (!this.canSpawnThisTurn(currentTurn)) return false;
    if (availableProjects.length >= this.maximumAvailable) return false;
    if (availableProjects.length < this.minimumAvailable) return true;
    return random.next() <= this.opportunisticSpawnChance;
  }

  spawnCount(currentTurn: number, availableProjects: Project[], random: RandomSource): number {
    if (!this.canSpawnThisTurn(currentTurn)) return 0;
    const capacity = this.maximumAvailable - availableProjects.length;
    if (capacity <= 0) return 0;

    const minimumNeeded = Math.max(1, this.minimumAvailable - availableProjects.length);
    const baseCount = Math.min(capacity, minimumNeeded);
    const extraCount =
      capacity > baseCount && random.next() <= this.multiOfferChance
        ? 1
        : 0;
    return Math.min(this.maximumSpawnCount, capacity, baseCount + extraCount);
  }
}

export const DEFAULT_CONTRACT_PAYMENT_TERMS = new ContractPaymentTerms();
export const DEFAULT_ASSIGNMENT_POLICY = new AssignmentPolicy();
export const DEFAULT_PROJECT_FAILURE_POLICY = new ProjectFailurePolicy();
export const DEFAULT_PROJECT_AVAILABILITY_POLICY = new ProjectAvailabilityPolicy();
export const DEFAULT_CONTRACT_OFFER_LIFECYCLE_POLICY = new ContractOfferLifecyclePolicy();
export const DEFAULT_CONTRACT_OFFER_SPAWN_POLICY = new ContractOfferSpawnPolicy();
