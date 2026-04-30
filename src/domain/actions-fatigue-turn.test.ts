import { describe, expect, it } from 'vitest';
import { ACTION_RULES, maxFatigueForLeadership } from './actions';
import { canPerformAction, createInitialCooldowns, FatigueMeter } from './fatigue';
import { TurnCycle } from './turn-cycle';
import { testCooldowns, testGameState } from '../test/fixtures';

describe('actions and fatigue', () => {
  it('defines every player action with fatigue and cooldown costs', () => {
    expect(Object.keys(ACTION_RULES).sort()).toEqual([
      'adjustSalary',
      'changeAssignment',
      'conductInterview',
      'fireEmployee',
      'orderOvertime',
      'postJobListing',
      'signContract',
      'startInvestmentRound',
    ]);
    expect(ACTION_RULES.postJobListing).toEqual({ fatigue: 3, cooldown: 2 });
    expect(ACTION_RULES.changeAssignment).toEqual({ fatigue: 1, cooldown: 0 });
  });

  it('clamps leadership before resolving max fatigue', () => {
    expect(maxFatigueForLeadership(-10)).toBe(6);
    expect(maxFatigueForLeadership(5.4)).toBe(10);
    expect(maxFatigueForLeadership(99)).toBe(20);
  });

  it('spends fatigue and applies cooldown only when the action is available', () => {
    const meter = new FatigueMeter({
      current: 5,
      max: 9,
      cooldowns: testCooldowns(),
    });

    const spent = meter.spend('postJobListing').toSnapshot();
    expect(spent.current).toBe(2);
    expect(spent.cooldowns.postJobListing).toBe(2);

    const unchanged = new FatigueMeter(spent).spend('postJobListing').toSnapshot();
    expect(unchanged).toEqual(spent);
  });

  it('blocks actions when fatigue is too low or cooldown remains', () => {
    expect(new FatigueMeter({
      current: 2,
      max: 9,
      cooldowns: testCooldowns(),
    }).canPerform('postJobListing')).toBe(false);

    expect(new FatigueMeter({
      current: 9,
      max: 9,
      cooldowns: testCooldowns({ postJobListing: 1 }),
    }).canPerform('postJobListing')).toBe(false);
  });

  it('decrements cooldowns without going below zero and resets current fatigue for leadership', () => {
    const meter = new FatigueMeter({
      current: 1,
      max: 9,
      cooldowns: testCooldowns({ postJobListing: 2, fireEmployee: 0 }),
    });

    const decremented = meter.decrementCooldowns().toSnapshot();
    expect(decremented.cooldowns.postJobListing).toBe(1);
    expect(decremented.cooldowns.fireEmployee).toBe(0);

    const reset = new FatigueMeter(decremented).resetForLeadership(10).toSnapshot();
    expect(reset.current).toBe(20);
    expect(reset.max).toBe(20);
    expect(reset.cooldowns.postJobListing).toBe(1);
  });

  it('creates a complete cooldown map and adapts canPerformAction to game state', () => {
    expect(createInitialCooldowns()).toEqual(testCooldowns());

    const state = testGameState({
      fatigue: {
        current: 0,
        max: 9,
        cooldowns: testCooldowns(),
      },
    });
    expect(canPerformAction(state, 'conductInterview')).toBe(false);
  });
});

describe('turn cycle', () => {
  it('moves through phases only from the expected previous phase', () => {
    expect(new TurnCycle(3, 1).toDecisionPhase()).toEqual({ turn: 3, phase: 2 });
    expect(new TurnCycle(3, 1).toExecutionPhase()).toEqual({ turn: 3, phase: 1 });
    expect(new TurnCycle(3, 2).toExecutionPhase()).toEqual({ turn: 3, phase: 3 });
    expect(new TurnCycle(3, 3).toSettlementPhase()).toEqual({ turn: 3, phase: 4 });
    expect(new TurnCycle(3, 4).toReportPhase()).toEqual({ turn: 3, phase: 5 });
  });

  it('starts the next turn only from report phase', () => {
    expect(new TurnCycle(3, 5).startNextTurn()).toEqual({ turn: 4, phase: 1 });
    expect(new TurnCycle(3, 2).startNextTurn()).toEqual({ turn: 3, phase: 2 });
  });
});
