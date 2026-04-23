import type {
  DesignerStats,
  DeveloperStats,
  Employee,
  PmStats,
} from '../types/employee';
import { defaultEmployeeFactory } from './factories/employee-factory';
import { DEFAULT_ASSIGNMENT_POLICY } from './policies/project-policies';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class StaffMember {
  protected readonly snapshot: Employee;

  constructor(snapshot: Employee) {
    this.snapshot = { ...snapshot, projectAssignments: { ...snapshot.projectAssignments } };
  }

  specialistAverage(): number {
    return average(Object.values(this.snapshot.specialistStats));
  }

  weeklyContribution(): number {
    const common = this.snapshot.commonStats;
    const commonMultiplier = 1 + (common.stamina + common.communication + common.mental) / 100;
    const probationMultiplier = this.snapshot.probationTurnsLeft > 0 ? 0.8 : 1;
    return Math.max(0, this.specialistAverage() * commonMultiplier * probationMultiplier);
  }

  specialistTotal(): number {
    return Object.values(this.snapshot.specialistStats).reduce((sum, value) => sum + value, 0);
  }

  tickWeek(): Employee {
    if (this.snapshot.probationTurnsLeft <= 0) return this.toSnapshot();
    return { ...this.toSnapshot(), probationTurnsLeft: this.snapshot.probationTurnsLeft - 1 };
  }

  applyOvertime(): Employee {
    const stamina = this.snapshot.commonStats.stamina;
    const damage = Math.max(4, 12 - stamina * 2);
    return { ...this.toSnapshot(), hp: clamp(this.snapshot.hp - damage, 0, 100) };
  }

  assignToProject(projectId: string, percentage: number): Employee {
    const projectAssignments = { ...this.snapshot.projectAssignments };
    if (percentage > 0) projectAssignments[projectId] = percentage;
    else delete projectAssignments[projectId];
    return { ...this.toSnapshot(), projectAssignments };
  }

  toSnapshot(): Employee {
    return { ...this.snapshot, projectAssignments: { ...this.snapshot.projectAssignments } };
  }
}

export class Developer extends StaffMember {
  specialistAverage(): number {
    const stats = this.snapshot.specialistStats as DeveloperStats;
    return average([
      stats.codingSpeed,
      stats.codeQuality,
      stats.problemSolving,
      stats.techBreadth,
      stats.securitySense,
    ]);
  }
}

export class Designer extends StaffMember {
  specialistAverage(): number {
    const stats = this.snapshot.specialistStats as DesignerStats;
    return average([
      stats.uiSense,
      stats.uxThinking,
      stats.workSpeed,
      stats.brandingSense,
      stats.prototyping,
    ]);
  }
}

export class ProjectManager extends StaffMember {
  specialistAverage(): number {
    const stats = this.snapshot.specialistStats as PmStats;
    return average([
      stats.scheduleManagement,
      stats.requirementAnalysis,
      stats.riskDetection,
      stats.clientManagement,
      stats.teamCoordination,
    ]);
  }
}

export function createStaffMember(employee: Employee): StaffMember {
  if (employee.role === 'developer') return new Developer(employee);
  if (employee.role === 'designer') return new Designer(employee);
  return new ProjectManager(employee);
}

export function createFounder(foundingMember: Employee): Employee {
  return {
    ...foundingMember,
    probationTurnsLeft: -1,
    hiredOnTurn: 1,
    commonStats: {
      ...foundingMember.commonStats,
      loyalty: Math.min(5, foundingMember.commonStats.loyalty + 2),
    },
    projectAssignments: {},
  };
}

export function employeeSpecialistTotal(employee: Employee): number {
  return createStaffMember(employee).specialistTotal();
}

export function employeeWeeklyContribution(employee: Employee): number {
  return createStaffMember(employee).weeklyContribution();
}

export class EmployeeRoster {
  private readonly employees: Employee[];

  constructor(employees: Employee[]) {
    this.employees = employees.map((employee) => ({ ...employee, projectAssignments: { ...employee.projectAssignments } }));
  }

  static generateResumes(count: number, reputation: number, currentTurn: number): Employee[] {
    return defaultEmployeeFactory.generateResumes(count, reputation, currentTurn);
  }

  static generateFoundingCandidates(count: number, reputation: number, currentTurn: number): Employee[] {
    return defaultEmployeeFactory.generateFoundingCandidates(count, reputation, currentTurn);
  }

  add(employee: Employee): EmployeeRoster {
    return new EmployeeRoster([...this.employees, employee]);
  }

  remove(employeeId: string): EmployeeRoster {
    return new EmployeeRoster(
      this.employees
        .filter((employee) => employee.id !== employeeId)
        .map((employee) => ({
          ...employee,
          projectAssignments: Object.fromEntries(
            Object.entries(employee.projectAssignments),
          ),
        })),
    );
  }

  setProjectAssignments(projectId: string, employeeIds: string[]): EmployeeRoster {
    const assigned = new Set(employeeIds);
    return new EmployeeRoster(
      this.employees.map((employee) =>
        createStaffMember(employee).assignToProject(
          projectId,
          DEFAULT_ASSIGNMENT_POLICY.assignedPercentage(assigned.has(employee.id)),
        ),
      ),
    );
  }

  removeProjectAssignment(projectId: string): EmployeeRoster {
    return new EmployeeRoster(
      this.employees.map((employee) =>
        createStaffMember(employee).assignToProject(projectId, 0),
      ),
    );
  }

  tickWeek(): EmployeeRoster {
    return new EmployeeRoster(
      this.employees.map((employee) => createStaffMember(employee).tickWeek()),
    );
  }

  applyOvertime(employeeIds: string[]): EmployeeRoster {
    const targets = new Set(employeeIds);
    return new EmployeeRoster(
      this.employees.map((employee) =>
        targets.has(employee.id)
          ? createStaffMember(employee).applyOvertime()
          : employee,
      ),
    );
  }

  toSnapshots(): Employee[] {
    return this.employees.map((employee) => ({ ...employee, projectAssignments: { ...employee.projectAssignments } }));
  }
}
