import { describe, expect, it } from 'vitest';
import { buildTurnReportSummary } from './turnReport.view-model';
import { testEmployee, testGameState, testLogEntry, testProject } from '../../test/fixtures';

describe('turn report view model', () => {
  it('summarizes financial changes with effective recurring revenue and recent logs', () => {
    const employee = testEmployee({
      id: 'emp',
      salary: 4800,
      commonStats: {
        stamina: 2,
        communication: 2,
        mental: 2,
        growthRate: 2,
        loyalty: 2,
      },
    });
    const main = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 300,
      assignedEmployeeIds: ['emp'],
    });
    const state = testGameState({
      capital: 1200,
      employees: [employee],
      activeProjects: [main],
      eventLog: Array.from({ length: 10 }, (_, index) =>
        testLogEntry({ id: `log-${index}`, message: `log-${index}`, timestamp: index }),
      ),
    });
    const prev = testGameState({ capital: 900 });

    const summary = buildTurnReportSummary(state, prev);

    expect(summary).toMatchObject({
      capitalDelta: 300,
      monthlyBurn: 650,
      recurringRevenue: 300,
      monthlyNetBurn: 350,
      runway: 13,
      employeeCount: 1,
    });
    expect(summary.recentLogs.map((log) => log.message)).toEqual([
      'log-9',
      'log-8',
      'log-7',
      'log-6',
      'log-5',
      'log-4',
      'log-3',
      'log-2',
    ]);
  });
});
