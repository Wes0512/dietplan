import { describe, expect, it } from 'vitest';
import {
  classifyConsistency,
  computeWeightTrendState,
  generateCoachInsight,
  type MovementProgress,
  type RecoveryProgress,
  type HabitsProgress,
} from '../services/progressEngine';

describe('computeWeightTrendState — progressive data-sufficiency (never fakes a trend)', () => {
  it('< 3 days of data -> getting_started', () => {
    expect(computeWeightTrendState([]).status).toBe('getting_started');
    expect(computeWeightTrendState([{ date: '2026-08-17', weight_kg: 66 }]).status).toBe('getting_started');
    expect(
      computeWeightTrendState([
        { date: '2026-08-17', weight_kg: 66 },
        { date: '2026-08-18', weight_kg: 65.9 },
      ]).status,
    ).toBe('getting_started');
  });

  it('3-6 days of data -> early_trend', () => {
    const points = [
      { date: '2026-08-17', weight_kg: 66 },
      { date: '2026-08-18', weight_kg: 65.9 },
      { date: '2026-08-19', weight_kg: 65.8 },
    ];
    expect(computeWeightTrendState(points).status).toBe('early_trend');

    const sixDays = [...points,
      { date: '2026-08-20', weight_kg: 65.7 },
      { date: '2026-08-21', weight_kg: 65.9 },
      { date: '2026-08-22', weight_kg: 65.6 },
    ];
    expect(computeWeightTrendState(sixDays).status).toBe('early_trend');
  });

  it('7+ days -> compares recent-half average vs earlier-half average, not a single day', () => {
    const points = [
      { date: '2026-08-17', weight_kg: 66.2 },
      { date: '2026-08-18', weight_kg: 66.0 },
      { date: '2026-08-19', weight_kg: 65.9 },
      { date: '2026-08-20', weight_kg: 65.7 },
      { date: '2026-08-21', weight_kg: 65.5 },
      { date: '2026-08-22', weight_kg: 65.4 },
      { date: '2026-08-23', weight_kg: 65.3 },
    ];
    const trend = computeWeightTrendState(points);
    expect(trend.status).toBe('trend');
    if (trend.status === 'trend') {
      expect(trend.direction).toBe('down');
    }
  });

  it('a single-day uptick within a longer downward trend does NOT flip the overall direction', () => {
    const points = [
      { date: '2026-08-17', weight_kg: 66.2 },
      { date: '2026-08-18', weight_kg: 66.0 },
      { date: '2026-08-19', weight_kg: 65.9 },
      { date: '2026-08-20', weight_kg: 66.3 }, // single-day uptick (e.g. water retention)
      { date: '2026-08-21', weight_kg: 65.6 },
      { date: '2026-08-22', weight_kg: 65.4 },
      { date: '2026-08-23', weight_kg: 65.3 },
    ];
    const trend = computeWeightTrendState(points);
    expect(trend.status).toBe('trend');
    if (trend.status === 'trend') {
      expect(trend.direction).toBe('down');
    }
  });

  it('near-identical averages are reported as flat, not up/down noise', () => {
    const points = [
      { date: '2026-08-17', weight_kg: 65.8 },
      { date: '2026-08-18', weight_kg: 65.9 },
      { date: '2026-08-19', weight_kg: 65.7 },
      { date: '2026-08-20', weight_kg: 65.8 },
      { date: '2026-08-21', weight_kg: 65.9 },
      { date: '2026-08-22', weight_kg: 65.7 },
      { date: '2026-08-23', weight_kg: 65.8 },
    ];
    const trend = computeWeightTrendState(points);
    expect(trend.status).toBe('trend');
    if (trend.status === 'trend') expect(trend.direction).toBe('flat');
  });
});

describe('classifyConsistency — neutral labels only', () => {
  it('returns no_data for undefined input', () => {
    expect(classifyConsistency(undefined)).toBe('no_data');
  });
  it('boundary values', () => {
    expect(classifyConsistency(0.8)).toBe('on_track');
    expect(classifyConsistency(0.79)).toBe('building_consistency');
    expect(classifyConsistency(0.5)).toBe('building_consistency');
    expect(classifyConsistency(0.49)).toBe('worth_improving');
    expect(classifyConsistency(0)).toBe('worth_improving');
  });
});

function baseMovement(overrides: Partial<MovementProgress> = {}): MovementProgress {
  return {
    avg_steps: 6800,
    steps_sample_days: 7,
    steps_target: 6500,
    workout_completed: 2,
    workout_required: 2,
    workout_consistency: 'on_track',
    low_impact_completed: 1,
    low_impact_planned: 1,
    low_impact_consistency: 'on_track',
    ...overrides,
  };
}
function baseRecovery(overrides: Partial<RecoveryProgress> = {}): RecoveryProgress {
  return {
    avg_sleep_min: 375,
    sleep_sample_days: 7,
    avg_energy: 3.5,
    energy_sample_days: 7,
    pain_days_count: 0,
    pain_area_counts: {},
    days_logged: 7,
    ...overrides,
  };
}
function baseHabits(overrides: Partial<HabitsProgress> = {}): HabitsProgress {
  return {
    avg_water_ml: 1900,
    water_sample_days: 7,
    water_target_ml: 2000,
    lunch_walk_rate: 0.8,
    lunch_walk_consistency: 'on_track',
    avg_sitting_breaks: 3,
    sitting_breaks_sample_days: 7,
    sitting_breaks_target: 3,
    days_logged: 7,
    ...overrides,
  };
}

describe('generateCoachInsight — data-driven, never invents, never judgmental', () => {
  it('returns null (no insight) when fewer than 3 days are logged', () => {
    const insight = generateCoachInsight({
      daysLogged: 2,
      movement: baseMovement(),
      recovery: baseRecovery(),
      habits: baseHabits(),
    });
    expect(insight).toBeNull();
  });

  it('pain always takes priority over any positive framing', () => {
    const insight = generateCoachInsight({
      daysLogged: 10,
      movement: baseMovement({ workout_consistency: 'on_track' }),
      recovery: baseRecovery({ pain_days_count: 2 }),
      habits: baseHabits(),
    });
    expect(insight).not.toBeNull();
    expect(insight).toMatch(/不适/);
    expect(insight).not.toMatch(/进展良好/);
  });

  it('never uses judgmental words like 失败/不合格/太差/做得不够', () => {
    const insight = generateCoachInsight({
      daysLogged: 10,
      movement: baseMovement({ avg_steps: 4000, workout_consistency: 'worth_improving' }),
      recovery: baseRecovery({ avg_sleep_min: 280 }),
      habits: baseHabits(),
    });
    expect(insight).not.toBeNull();
    const banned = /失败|不合格|太差|做得不够|做得不好/;
    expect(insight).not.toMatch(banned);
  });

  it('matches the example shape: good exercise consistency + sleep as the opportunity', () => {
    const insight = generateCoachInsight({
      daysLogged: 7,
      movement: baseMovement({ workout_consistency: 'on_track', avg_steps: 6800 }),
      recovery: baseRecovery({ avg_sleep_min: 280 }), // under 300 -> worth_improving
      habits: baseHabits(),
    });
    expect(insight).toContain('训练规律性');
    expect(insight).toMatch(/进展良好/);
    expect(insight).toMatch(/睡眠/);
    expect(insight).toMatch(/值得留意/);
  });

  it('when everything is at least building consistency and nothing is fully on_track, gives an encouraging generic message instead of null', () => {
    const insight = generateCoachInsight({
      daysLogged: 5,
      movement: baseMovement({ workout_consistency: 'building_consistency', avg_steps: 5500 }),
      recovery: baseRecovery({ avg_sleep_min: 320 }), // building_consistency tier
      habits: baseHabits(),
    });
    expect(insight).not.toBeNull();
  });
});
