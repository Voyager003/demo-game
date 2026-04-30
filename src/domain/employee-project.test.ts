import { describe, expect, it } from 'vitest';
import {
  createFounder,
  createStaffMember,
  EmployeeRoster,
  employeeSpecialistTotal,
  employeeWeeklyContribution,
} from './employee';
import {
  calculateProgressPerTurn,
  estimateProjectCompletion,
  generateInitialProjects,
  generateMainRevenueProject,
  ProjectPortfolio,
} from './project';
import { testEmployee, testProject, testSpecialistStats } from '../test/fixtures';

describe('employee domain', () => {
  it('creates role-specific staff members and calculates specialist totals', () => {
    const developer = testEmployee({
      role: 'developer',
      specialistStats: {
        codingSpeed: 5,
        codeQuality: 6,
        problemSolving: 7,
        techBreadth: 8,
        securitySense: 9,
      },
    });
    const designer = testEmployee({
      role: 'designer',
      specialistStats: testSpecialistStats('designer', 6),
    });
    const pm = testEmployee({
      role: 'pm',
      specialistStats: testSpecialistStats('pm', 7),
    });

    expect(createStaffMember(developer).specialistAverage()).toBe(7);
    expect(createStaffMember(designer).specialistAverage()).toBe(6);
    expect(createStaffMember(pm).specialistAverage()).toBe(7);
    expect(employeeSpecialistTotal(developer)).toBe(35);
  });

  it('applies common stat and probation modifiers to weekly contribution', () => {
    const regular = testEmployee({
      specialistStats: testSpecialistStats('developer', 10),
      commonStats: {
        stamina: 5,
        communication: 5,
        mental: 5,
        growthRate: 2,
        loyalty: 2,
      },
      probationTurnsLeft: -1,
    });
    const probation = { ...regular, probationTurnsLeft: 3 };

    expect(employeeWeeklyContribution(regular)).toBe(11.5);
    expect(employeeWeeklyContribution(probation)).toBeCloseTo(9.2);
  });

  it('ticks probation, clamps overtime damage, and assigns projects immutably', () => {
    const employee = testEmployee({
      probationTurnsLeft: 2,
      hp: 5,
      commonStats: {
        stamina: -1,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 2,
      },
    });
    const member = createStaffMember(employee);

    expect(member.tickWeek().probationTurnsLeft).toBe(1);
    expect(member.applyOvertime().hp).toBe(0);
    expect(member.assignToProject('p1', 100).projectAssignments).toEqual({ p1: 100 });
    expect(member.assignToProject('p1', 0).projectAssignments).toEqual({});
    expect(employee.projectAssignments).toEqual({});
  });

  it('normalizes founder state and caps loyalty', () => {
    const founder = createFounder(testEmployee({
      hiredOnTurn: 9,
      probationTurnsLeft: 12,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 4,
      },
      projectAssignments: { old: 100 },
    }));

    expect(founder.hiredOnTurn).toBe(1);
    expect(founder.probationTurnsLeft).toBe(-1);
    expect(founder.commonStats.loyalty).toBe(5);
    expect(founder.projectAssignments).toEqual({});
  });

  it('generates resumes in requested counts and valid ranges', () => {
    const resumes = EmployeeRoster.generateResumes(5, 90, 7);
    const founders = EmployeeRoster.generateFoundingCandidates(3, 90, 7);
    const specialistTotals = resumes.map((employee) =>
      Object.values(employee.specialistStats).reduce((sum, value) => sum + value, 0),
    );
    const commonTotals = resumes.map((employee) =>
      employee.commonStats.stamina
      + employee.commonStats.communication
      + employee.commonStats.mental
      + employee.commonStats.growthRate
      + employee.commonStats.loyalty,
    );

    expect(resumes).toHaveLength(5);
    expect(founders).toHaveLength(3);
    expect(founders.every((employee) => employee.role === 'developer')).toBe(true);
    expect(resumes.every((employee) => employee.hiredOnTurn === 7)).toBe(true);
    expect(resumes.every((employee) => employee.maxConcurrentProjects >= 1 && employee.maxConcurrentProjects <= 3)).toBe(true);
    expect(resumes.every((employee) => employee.commonStats.loyalty === 0)).toBe(true);
    expect(founders.every((employee) => employee.commonStats.loyalty === 0)).toBe(true);
    expect(new Set(specialistTotals)).toEqual(new Set([30]));
    expect(new Set(commonTotals)).toEqual(new Set([4]));
  });

  it('updates roster assignments, removals, weekly ticks, and overtime targets immutably', () => {
    const a = testEmployee({ id: 'a', probationTurnsLeft: 1, hp: 100 });
    const b = testEmployee({ id: 'b', probationTurnsLeft: -1, hp: 100 });
    const roster = new EmployeeRoster([a, b])
      .setProjectAssignments('p1', ['a'])
      .applyOvertime(['a'])
      .tickWeek()
      .removeProjectAssignment('p1');

    const snapshots = roster.toSnapshots();
    expect(snapshots.find((employee) => employee.id === 'a')?.probationTurnsLeft).toBe(0);
    expect(snapshots.find((employee) => employee.id === 'a')?.hp).toBeLessThan(100);
    expect(snapshots.find((employee) => employee.id === 'a')?.projectAssignments).toEqual({});
    expect(a.hp).toBe(100);

    expect(new EmployeeRoster([a, b]).remove('a').toSnapshots().map((employee) => employee.id)).toEqual(['b']);
    expect(new EmployeeRoster([a]).add(b).toSnapshots()).toHaveLength(2);
  });
});

describe('project domain', () => {
  it('generates main revenue projects and initial contract projects with valid invariants', () => {
    const main = generateMainRevenueProject('fintech');
    const contracts = generateInitialProjects(4);

    expect(main.id).toContain('main_fintech_');
    expect(main.kind).toBe('ownedProduct');
    expect(main.status).toBe('operating');
    expect(main.monthlyRevenue).toBe(380);
    expect(contracts).toHaveLength(4);
    expect(contracts.every((project) => project.kind === 'contract')).toBe(true);
    expect(contracts.every((project) => project.status === 'available')).toBe(true);
    expect(contracts.every((project) => project.totalAmount > 0)).toBe(true);
  });

  it('estimates completion from deterministic project progress', () => {
    const project = testProject({ progress: 40 });
    const developer = testEmployee({
      id: 'dev',
      specialistStats: testSpecialistStats('developer', 5),
    });

    expect(calculateProgressPerTurn(project, [])).toBe(0);
    expect(calculateProgressPerTurn(project, [developer])).toBe(19);
    expect(estimateProjectCompletion(project, [developer], 3)).toEqual({
      progressPerTurn: 19,
      turnsLeft: 4,
      finishTurn: 7,
    });
    expect(estimateProjectCompletion(project, [], 3)).toBeNull();
  });

  it('signs contracts, moves project lists, and pays 30 percent advance', () => {
    const available = testProject({
      id: 'available',
      status: 'available',
      totalAmount: 1000,
      advancePaid: false,
    });
    const portfolio = new ProjectPortfolio([], [available]);
    const result = portfolio.signContract('available');

    expect(result?.advance).toBe(300);
    expect(result?.projectName).toBe('Test Project');
    expect(result?.portfolio.toSnapshots().activeProjects[0]).toMatchObject({
      id: 'available',
      status: 'active',
      advancePaid: true,
    });
    expect(result?.portfolio.toSnapshots().availableProjects).toHaveLength(0);
    expect(portfolio.signContract('missing')).toBeNull();
  });

  it('sets assignments, removes employees, and flags overtime only for active projects', () => {
    const active = testProject({ id: 'active', status: 'active' });
    const completed = testProject({ id: 'done', status: 'completed', assignedEmployeeIds: ['a'] });

    const snapshots = new ProjectPortfolio([active, completed], [])
      .setAssignments('active', ['a', 'b'])
      .removeEmployee('b')
      .orderOvertime('active')
      .orderOvertime('done')
      .toSnapshots();

    expect(snapshots.activeProjects.find((project) => project.id === 'active')).toMatchObject({
      assignedEmployeeIds: ['a'],
      overtimeActive: true,
    });
    expect(snapshots.activeProjects.find((project) => project.id === 'done')?.overtimeActive).toBe(false);
  });

  it('advances active projects, completes finished work, and records overtime targets', () => {
    const project = testProject({
      id: 'p',
      name: 'Complete Me',
      progress: 80,
      assignedEmployeeIds: ['dev'],
      overtimeActive: true,
    });
    const developer = testEmployee({
      id: 'dev',
      specialistStats: testSpecialistStats('developer', 5),
    });

    const result = new ProjectPortfolio([project], []).advanceWeek([developer]);

    expect(result.completedProjects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({
      status: 'completed',
      progress: 100,
      overtimeActive: false,
    });
    expect(result.overtimeEmployeeIds).toEqual(['dev']);
    expect(result.logs[0].layerTrace.finalValue).toContain('clientSatisfaction');
  });

  it('fails long-unassigned active projects and ignores non-active projects', () => {
    const failed = testProject({
      id: 'fail',
      name: 'No Staff',
      status: 'active',
      turnsRequired: 2,
      turnsElapsed: 5,
      assignedEmployeeIds: [],
    });
    const operating = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
    });

    const result = new ProjectPortfolio([failed, operating], []).advanceWeek([]);

    expect(result.projects.find((project) => project.id === 'fail')?.status).toBe('failed');
    expect(result.projects.find((project) => project.id === 'main')?.status).toBe('operating');
    expect(result.logs[0].message).toContain('프로젝트 실패');
  });

  it('replenishes available projects only when fewer than two are available', () => {
    expect(new ProjectPortfolio([], []).replenishAvailable().toSnapshots().availableProjects).toHaveLength(2);
    expect(new ProjectPortfolio([], [
      testProject({ id: 'a', status: 'available' }),
      testProject({ id: 'b', status: 'available' }),
    ]).replenishAvailable().toSnapshots().availableProjects).toHaveLength(2);
  });
});
