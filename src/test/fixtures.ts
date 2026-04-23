import type { Domain } from '../types/ceo';
import type { ActionType, GameState } from '../types/core';
import type {
  CommonStats,
  DesignerStats,
  DeveloperStats,
  Employee,
  EmploymentType,
  PmStats,
  Role,
  SpecialistStats,
} from '../types/employee';
import type { LogEntry, PendingEvent } from '../types/event';
import type { Project, ProjectKind, ProjectRevenueModel, ProjectStatus } from '../types/project';

export function testCooldowns(overrides: Partial<Record<ActionType, number>> = {}): Record<ActionType, number> {
  return {
    postJobListing: 0,
    conductInterview: 0,
    fireEmployee: 0,
    adjustSalary: 0,
    signContract: 0,
    changeAssignment: 0,
    orderOvertime: 0,
    startInvestmentRound: 0,
    ...overrides,
  };
}

export function testCommonStats(overrides: Partial<CommonStats> = {}): CommonStats {
  return {
    stamina: 2,
    communication: 2,
    mental: 2,
    growthRate: 2,
    loyalty: 2,
    ...overrides,
  };
}

export function testSpecialistStats(role: Role, value = 5): SpecialistStats {
  if (role === 'developer') {
    return {
      codingSpeed: value,
      codeQuality: value,
      problemSolving: value,
      techBreadth: value,
      securitySense: value,
    } satisfies DeveloperStats;
  }

  if (role === 'designer') {
    return {
      uiSense: value,
      uxThinking: value,
      workSpeed: value,
      brandingSense: value,
      prototyping: value,
    } satisfies DesignerStats;
  }

  return {
    scheduleManagement: value,
    requirementAnalysis: value,
    riskDetection: value,
    clientManagement: value,
    teamCoordination: value,
  } satisfies PmStats;
}

export function testEmployee(overrides: Partial<Employee> = {}): Employee {
  const role = overrides.role ?? 'developer';
  return {
    id: 'emp-1',
    name: 'Test Employee',
    role,
    employmentType: 'regular' as EmploymentType,
    probationTurnsLeft: -1,
    specialistStats: overrides.specialistStats ?? testSpecialistStats(role, 5),
    commonStats: testCommonStats(overrides.commonStats),
    salary: 4800,
    hp: 100,
    maxConcurrentProjects: 2,
    projectAssignments: {},
    hiredOnTurn: 1,
    ...overrides,
  };
}

export function testProject(overrides: Partial<Project> = {}): Project {
  const kind: ProjectKind = overrides.kind ?? 'contract';
  const isOwned = kind === 'ownedProduct';
  const revenueModel: ProjectRevenueModel =
    overrides.revenueModel ?? (isOwned ? 'subscription' : 'contract');
  return {
    id: 'project-1',
    name: 'Test Project',
    kind,
    level: 1,
    totalAmount: isOwned ? 0 : 1000,
    monthlyRevenue: isOwned ? 300 : 0,
    revenueModel,
    revenueLabel: isOwned ? 'MRR' : 'Contract',
    isMainRevenue: isOwned,
    advancePaid: isOwned,
    finalPaid: isOwned,
    turnsRequired: isOwned ? 0 : 4,
    turnsElapsed: 0,
    progress: isOwned ? 100 : 0,
    assignedEmployeeIds: [],
    status: isOwned ? 'operating' : ('active' as ProjectStatus),
    clientSatisfaction: isOwned ? 100 : 0,
    overtimeActive: false,
    ...overrides,
  };
}

export function testLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log-1',
    turn: 1,
    layer: 'deterministic',
    message: 'test log',
    timestamp: 1,
    ...overrides,
  };
}

export function testPendingEvent(overrides: Partial<PendingEvent> = {}): PendingEvent {
  return {
    id: 'event-1',
    type: 'generic',
    layer: 'deterministic',
    title: 'test event',
    description: 'test description',
    choices: [{ label: 'ok', effect: 'none' }],
    ...overrides,
  };
}

export function testGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 1,
    phase: 2,
    companyName: 'Test Co',
    ceo: {
      domain: 'b2bsaas' as Domain,
      stats: {
        leadership: 5,
        negotiation: 5,
        vision: 5,
        techUnderstanding: 5,
        crisisResponse: 5,
      },
    },
    capital: 2000,
    companyRating: 20,
    fatigue: {
      current: 9,
      max: 9,
      cooldowns: testCooldowns(),
    },
    employees: [testEmployee()],
    pendingResumes: [],
    activeProjects: [],
    availableProjects: [],
    completedProjectCount: 0,
    eventLog: [],
    pendingEvents: [],
    investment: {
      status: 'idle',
      reviewEndsOnTurn: null,
      cooldownEndsOnTurn: null,
      pendingResult: null,
      attemptCount: 0,
    },
    gameStatus: 'playing',
    crisisGraceTurnsLeft: 0,
    endingGrade: null,
    ...overrides,
  };
}
