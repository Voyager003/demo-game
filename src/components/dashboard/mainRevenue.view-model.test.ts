import { describe, expect, it } from 'vitest';
import { buildMainRevenueViewModel, getMainRevenueColor } from './mainRevenue.view-model';
import { testEmployee, testGameState, testProject } from '../../test/fixtures';

describe('main revenue view model', () => {
  it('returns null when a company has no main revenue project', () => {
    expect(buildMainRevenueViewModel(testGameState({ activeProjects: [] }))).toBeNull();
  });

  it('summarizes effective revenue, assignment contribution, chemistry, and unassigned employees', () => {
    const main = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 300,
      assignedEmployeeIds: ['a', 'b'],
    });
    const side = testProject({
      id: 'side',
      status: 'active',
      assignedEmployeeIds: ['a'],
    });
    const employees = [
      testEmployee({
        id: 'a',
        name: 'A',
        commonStats: {
          stamina: 2,
          communication: 5,
          mental: 2,
          growthRate: 2,
          loyalty: 2,
        },
      }),
      testEmployee({
        id: 'b',
        name: 'B',
        role: 'designer',
        commonStats: {
          stamina: 2,
          communication: -1,
          mental: 2,
          growthRate: 2,
          loyalty: 2,
        },
      }),
      testEmployee({ id: 'c', name: 'C', role: 'pm' }),
    ];

    const viewModel = buildMainRevenueViewModel(testGameState({
      activeProjects: [main, side],
      employees,
    }));

    expect(viewModel).toMatchObject({
      baseRevenue: 300,
      effectiveRevenue: 218,
      revenueRatio: 73,
      revenueColor: '',
      avgCommunication: 2,
      chemBonus: 6,
      isPhase2: true,
    });
    expect(viewModel?.employeeContributions).toEqual([
      expect.objectContaining({ employeeId: 'a', totalProjects: 2, contribution: 50, roleLabel: '개발자' }),
      expect.objectContaining({ employeeId: 'b', totalProjects: 1, contribution: 100, roleLabel: '디자이너' }),
    ]);
    expect(viewModel?.unassignedEmployeeNames).toEqual(['C']);
  });

  it('maps revenue ratios to UI color classes', () => {
    expect(getMainRevenueColor(100)).toBe('positive');
    expect(getMainRevenueColor(90)).toBe('positive');
    expect(getMainRevenueColor(60)).toBe('');
    expect(getMainRevenueColor(30)).toBe('warning');
    expect(getMainRevenueColor(29)).toBe('danger');
  });
});
