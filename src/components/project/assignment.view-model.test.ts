import { describe, expect, it } from 'vitest';
import {
  buildAssignmentEstimate,
  getOtherProjectCount,
  getSpecSum,
  isEmployeeAtCapacity,
  statValClass,
} from './assignment.view-model';
import { testEmployee, testProject, testSpecialistStats } from '../../test/fixtures';

describe('assignment view model', () => {
  it('counts other active or operating project assignments only', () => {
    const projects = [
      testProject({ id: 'target', status: 'active', assignedEmployeeIds: ['emp'] }),
      testProject({ id: 'active', status: 'active', assignedEmployeeIds: ['emp'] }),
      testProject({ id: 'operating', kind: 'ownedProduct', status: 'operating', assignedEmployeeIds: ['emp'] }),
      testProject({ id: 'completed', status: 'completed', assignedEmployeeIds: ['emp'] }),
    ];

    expect(getOtherProjectCount(projects, 'target', 'emp')).toBe(2);
  });

  it('blocks only unselected employees that reached max concurrent projects', () => {
    const projects = [
      testProject({ id: 'target', status: 'active', assignedEmployeeIds: [] }),
      testProject({ id: 'active', status: 'active', assignedEmployeeIds: ['emp'] }),
    ];
    const employee = testEmployee({ id: 'emp', maxConcurrentProjects: 1 });

    expect(isEmployeeAtCapacity(projects, 'target', [], employee)).toBe(true);
    expect(isEmployeeAtCapacity(projects, 'target', ['emp'], employee)).toBe(false);
  });

  it('derives stat classes, specialist sums, and contract estimates', () => {
    const employee = testEmployee({
      id: 'emp',
      specialistStats: testSpecialistStats('developer', 5),
    });
    const project = testProject({ progress: 60 });

    expect(statValClass(1)).toBe('positive');
    expect(statValClass(-1)).toBe('danger');
    expect(statValClass(0)).toBe('neutral');
    expect(getSpecSum(employee)).toBe(25);
    expect(buildAssignmentEstimate(project, [employee], 2)).toEqual({
      progressPerTurn: 20,
      turnsLeft: 2,
      finishTurn: 4,
    });
    expect(buildAssignmentEstimate(project, [], 2)).toBeNull();
  });
});
