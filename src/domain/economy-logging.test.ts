import { describe, expect, it } from 'vitest';
import { EconomyLedger } from './economy';
import { createEventLog, createFunctionLog, createLayerTrace } from './logging';
import { testEmployee, testProject } from '../test/fixtures';

describe('EconomyLedger', () => {
  it('calculates salaries, operating costs, burn, and basic recurring revenue', () => {
    const employees = [
      testEmployee({ id: 'a', salary: 4800 }),
      testEmployee({ id: 'b', salary: 3000 }),
    ];
    const main = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 320,
    });
    const inactive = testProject({
      id: 'inactive',
      kind: 'ownedProduct',
      status: 'active',
      isMainRevenue: false,
      monthlyRevenue: 500,
    });

    expect(EconomyLedger.monthlySalaries(employees)).toBe(650);
    expect(EconomyLedger.monthlyOperatingCosts(2)).toBe(300);
    expect(EconomyLedger.monthlyBurn(employees)).toBe(950);
    expect(EconomyLedger.monthlyRecurringRevenue([main, inactive])).toBe(320);
    expect(EconomyLedger.monthlyNetBurn(employees, [main, inactive])).toBe(630);
  });

  it('delegates effective recurring revenue to deterministic economy rules', () => {
    const main = testProject({
      id: 'main',
      kind: 'ownedProduct',
      status: 'operating',
      isMainRevenue: true,
      monthlyRevenue: 300,
      assignedEmployeeIds: ['a'],
    });
    const side = testProject({
      id: 'side',
      status: 'active',
      assignedEmployeeIds: ['a'],
    });
    const employee = testEmployee({
      id: 'a',
      commonStats: {
        stamina: 2,
        communication: 5,
        mental: 2,
        growthRate: 2,
        loyalty: 2,
      },
    });

    expect(EconomyLedger.effectiveRecurringRevenue([main, side], [employee])).toBe(173);
    expect(EconomyLedger.effectiveMonthlyNetBurn([employee], [main, side])).toBe(477);
  });

  it('handles runway and final payment edge cases', () => {
    expect(EconomyLedger.runwayInTurns(1000, 0)).toBe(Infinity);
    expect(EconomyLedger.runwayInTurns(1000, -10)).toBe(Infinity);
    expect(EconomyLedger.runwayInTurns(1000, 200)).toBe(20);
    expect(EconomyLedger.runwayInTurns(-100, 200)).toBe(0);

    expect(EconomyLedger.finalPayment(testProject({ totalAmount: 1000, clientSatisfaction: 95 }))).toBe(735);
    expect(EconomyLedger.finalPayment(testProject({ totalAmount: 1000, clientSatisfaction: 70 }))).toBe(700);
    expect(EconomyLedger.finalPayment(testProject({ totalAmount: 1000, clientSatisfaction: 50 }))).toBe(630);
    expect(EconomyLedger.finalPayment(testProject({ totalAmount: 1000, clientSatisfaction: 30 }))).toBe(490);
    expect(EconomyLedger.finalPayment(testProject({ totalAmount: 1000, clientSatisfaction: 29 }))).toBe(350);
  });
});

describe('logging helpers', () => {
  it('creates layer traces with deterministic fallback and default notes', () => {
    const trace = createLayerTrace({
      rule: 'rule',
      trigger: 'trigger',
      inputs: ['input'],
      effects: ['effect'],
    });

    expect(trace.layer).toBe('deterministic');
    expect(trace.note).toContain('modifier');
    expect(trace.finalValue).toBeUndefined();
  });

  it('maps event layers and stores source metadata', () => {
    const eventLog = createEventLog({
      turn: 2,
      message: 'probability happened',
      layer: 'probabilistic',
      source: 'test',
      layerTrace: {
        rule: 'roll',
        trigger: 'chance',
        inputs: [],
        effects: [],
      },
    });

    expect(eventLog.id).toMatch(/^evtlog_/);
    expect(eventLog.turn).toBe(2);
    expect(eventLog.layer).toBe('probabilistic');
    expect(eventLog.source).toBe('test');
    expect(eventLog.layerTrace?.layer).toBe('probabilistic');
  });

  it('creates function logs with sequence-based ids', () => {
    const log = createFunctionLog({
      functionName: 'GameSession.advancePhase',
      turn: 1,
      phase: 2,
      sequence: 7,
      detail: 'phase=2',
    });

    expect(log.id).toMatch(/^fn_/);
    expect(log.id).toContain('_7');
    expect(log.detail).toBe('phase=2');
  });
});
