import { describe, expect, it } from 'vitest';
import { computeDailyGoalStatus, computeProgressState, groupGoalStatus, summarizeGoalCompletion } from '../services/goalEngine';
import { getDayPlan } from '../data/plan14day.seed';
import type { DailyLog } from '../types';

function makeLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: 'log-x',
    user_id: 'user-1',
    date: '2026-08-17',
    water_ml: 0,
    sitting_breaks: 0,
    exercise_completed: false,
    lunch_walk_done: false,
    shoulder_relax_done: false,
    stretch_done: false,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('goalEngine — not_applicable is hidden', () => {
  it('Day 3 (rest day) never shows a workout goal', () => {
    const day3 = getDayPlan(3)!;
    const statuses = computeDailyGoalStatus(day3, undefined);
    expect(statuses.find((s) => s.key === 'workout')).toBeUndefined();
  });

  it('Day 2 (recovery day) never shows a workout goal either', () => {
    const day2 = getDayPlan(2)!;
    const statuses = computeDailyGoalStatus(day2, undefined);
    expect(statuses.find((s) => s.key === 'workout')).toBeUndefined();
  });
});

describe('goalEngine — required/target counted, recommended/optional excluded', () => {
  it('Day 1: workout(required) + water(target) + steps(target) = 3 in denominator; lunch_walk & sitting_breaks(recommended) excluded', () => {
    const day1 = getDayPlan(1)!;
    const statuses = computeDailyGoalStatus(day1, undefined);
    const { completed, total } = summarizeGoalCompletion(statuses);
    expect(total).toBe(3);
    expect(completed).toBe(0);

    const { supplementary } = groupGoalStatus(statuses);
    expect(supplementary.map((s) => s.key).sort()).toEqual(['lunch_walk', 'sitting_breaks'].sort());
  });

  it('Day 6: low_impact_activity is recommended, displayed but excluded from denominator', () => {
    const day6 = getDayPlan(6)!;
    const statuses = computeDailyGoalStatus(day6, undefined);
    const { countable, supplementary } = groupGoalStatus(statuses);

    expect(countable.find((s) => s.key === 'low_impact_activity')).toBeUndefined();
    expect(supplementary.find((s) => s.key === 'low_impact_activity')).toBeDefined();

    // water(target) + steps(target) still count
    const { total } = summarizeGoalCompletion(statuses);
    expect(total).toBe(2);
  });

  it('Day 5: stretch is optional, displayed but excluded from denominator', () => {
    const day5 = getDayPlan(5)!;
    const statuses = computeDailyGoalStatus(day5, undefined);
    const { supplementary } = groupGoalStatus(statuses);
    expect(supplementary.find((s) => s.key === 'stretch')?.requirement).toBe('optional');
  });
});

describe('goalEngine — completion driven by schema-v2 boolean fields', () => {
  it('Day 2: lunch_walk_done / shoulder_relax_done drive the required goals directly', () => {
    const day2 = getDayPlan(2)!;
    const log = makeLog({
      lunch_walk_done: true,
      shoulder_relax_done: true,
      steps: 7000,
      water_ml: 2200,
    });
    const statuses = computeDailyGoalStatus(day2, log);
    const { completed, total } = summarizeGoalCompletion(statuses);

    expect(statuses.find((s) => s.key === 'lunch_walk')?.completed).toBe(true);
    expect(statuses.find((s) => s.key === 'shoulder_neck_relax')?.completed).toBe(true);
    expect(total).toBe(4); // lunch_walk + shoulder_relax(required) + water + steps(target)
    expect(completed).toBe(4);
  });

  it('a day with no log at all shows everything as not completed, never throws', () => {
    const day1 = getDayPlan(1)!;
    const statuses = computeDailyGoalStatus(day1, undefined);
    expect(statuses.every((s) => s.completed === false)).toBe(true);
  });
});

describe('goalEngine — progressive status for numeric targets (never shows "Failed")', () => {
  it('computeProgressState: 0 -> not_started, <70% -> in_progress, <100% -> almost_there, >=100% -> completed', () => {
    expect(computeProgressState(0, 2000)).toBe('not_started');
    expect(computeProgressState(1000, 2000)).toBe('in_progress'); // 50%
    expect(computeProgressState(1650, 2000)).toBe('almost_there'); // 82.5%
    expect(computeProgressState(2000, 2000)).toBe('completed');
    expect(computeProgressState(2200, 2000)).toBe('completed'); // over-target still "completed", not a separate state
  });

  it('Day 1 steps/water goals carry progress_state and current_value, not a pass/fail label', () => {
    const day1 = getDayPlan(1)!;
    const log: DailyLog = {
      id: 'x', user_id: 'u', date: '2026-08-17',
      water_ml: 1650, steps: 6240, sitting_breaks: 0,
      exercise_completed: false, lunch_walk_done: false, shoulder_relax_done: false, stretch_done: false,
      updated_at: new Date().toISOString(),
    };
    const statuses = computeDailyGoalStatus(day1, log);
    const water = statuses.find((s) => s.key === 'water')!;
    const steps = statuses.find((s) => s.key === 'steps')!;

    expect(water.progress_state).toBe('almost_there');
    expect(water.current_value).toBe(1650);
    expect(steps.progress_state).toBe('almost_there');
    expect(steps.current_value).toBe(6240);
  });

  it('required binary goals (workout, lunch_walk) never carry a progress_state', () => {
    const day2 = getDayPlan(2)!;
    const statuses = computeDailyGoalStatus(day2, undefined);
    const lunchWalk = statuses.find((s) => s.key === 'lunch_walk')!;
    expect(lunchWalk.progress_state).toBeUndefined();
  });
});
