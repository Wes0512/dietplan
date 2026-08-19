import { describe, expect, it } from 'vitest';
import { generateCoachDecision, deriveWeeklyHighlights } from '../services/coachEngine';
import type { WeekStats } from '../services/statsEngine';
import type { DailyLog, WeeklyReview } from '../types';

const goodStats: WeekStats = {
  average_weight_kg: 65.6,
  average_steps: 6800,
  average_water_ml: 2000,
  average_sleep_min: 400,
  average_energy: 3.5,
  exercise_completion: '2/2',
  pain_reported: false,
};

function logsWithWeightTrend(direction: 'down' | 'up' | 'flat'): DailyLog[] {
  const base = (date: string, weight: number): DailyLog => ({
    id: date, user_id: 'u', date, weight_kg: weight, water_ml: 2000, sitting_breaks: 3,
    exercise_completed: true, lunch_walk_done: true, shoulder_relax_done: true, stretch_done: false,
    updated_at: date,
  });
  if (direction === 'down') {
    return [base('d1', 66.2), base('d2', 66.0), base('d3', 65.9), base('d4', 65.7), base('d5', 65.5), base('d6', 65.4)];
  }
  if (direction === 'up') {
    return [base('d1', 65.4), base('d2', 65.5), base('d3', 65.7), base('d4', 65.9), base('d5', 66.0), base('d6', 66.2)];
  }
  return [base('d1', 65.8), base('d2', 65.7), base('d3', 65.9), base('d4', 65.8), base('d5', 65.7), base('d6', 65.8)];
}

describe('coachEngine — pain always wins', () => {
  it('never returns PROGRESS when pain_reported is true, even at a phase boundary with good stats', () => {
    const result = generateCoachDecision({
      week_number: 2,
      stats: { ...goodStats, pain_reported: true },
      logs: logsWithWeightTrend('down'),
      is_phase_boundary: true,
      required_workout_count: 2,
    });
    expect(result.decision).not.toBe('PROGRESS');
    expect(['ADJUST', 'HOLD']).toContain(result.decision);
  });
});

describe('coachEngine — no aggressive language', () => {
  it('does not suggest calorie cuts or daily running even when weight trend is up', () => {
    const result = generateCoachDecision({
      week_number: 1,
      stats: { ...goodStats, pain_reported: false },
      logs: logsWithWeightTrend('up'),
      is_phase_boundary: false,
      required_workout_count: 2,
    });
    expect(result.decision).toBe('KEEP');
    expect(result.reason).not.toMatch(/减少.*热量|减.*卡路里/);
    expect(result.reason).not.toMatch(/每天跑步|每天跑/);
  });

  it('never uses judgmental Chinese words anywhere across all decision branches', () => {
    const scenarios: Parameters<typeof generateCoachDecision>[0][] = [
      { week_number: 1, stats: { ...goodStats, pain_reported: true }, logs: [], is_phase_boundary: false, required_workout_count: 2 },
      { week_number: 1, stats: { ...goodStats, exercise_completion: '0/2' }, logs: logsWithWeightTrend('flat'), is_phase_boundary: false, required_workout_count: 2 },
      { week_number: 1, stats: { ...goodStats, average_sleep_min: 250, average_energy: 2 }, logs: logsWithWeightTrend('flat'), is_phase_boundary: false, required_workout_count: 2 },
      { week_number: 1, stats: goodStats, logs: logsWithWeightTrend('up'), is_phase_boundary: false, required_workout_count: 2 },
      { week_number: 2, stats: goodStats, logs: logsWithWeightTrend('down'), is_phase_boundary: true, required_workout_count: 2 },
      { week_number: 1, stats: goodStats, logs: logsWithWeightTrend('down'), is_phase_boundary: false, required_workout_count: 2 },
    ];
    const banned = /失败|不合格|太差|做得不够|做得不好/;
    for (const scenario of scenarios) {
      const result = generateCoachDecision(scenario);
      expect(result.reason).not.toMatch(banned);
    }
  });
});

describe('coachEngine — PROGRESS only at phase boundary with good data', () => {
  it('returns HOLD (not PROGRESS) when everything is good but not a phase boundary', () => {
    const result = generateCoachDecision({
      week_number: 1,
      stats: goodStats,
      logs: logsWithWeightTrend('down'),
      is_phase_boundary: false,
      required_workout_count: 2,
    });
    expect(result.decision).toBe('HOLD');
  });

  it('returns PROGRESS when everything is good AND it is a phase boundary', () => {
    const result = generateCoachDecision({
      week_number: 2,
      stats: goodStats,
      logs: logsWithWeightTrend('down'),
      is_phase_boundary: true,
      required_workout_count: 2,
    });
    expect(result.decision).toBe('PROGRESS');
  });
});

describe('coachEngine — low completion rate does not get punished', () => {
  it('returns KEEP (not a stricter demand) when exercise completion is low', () => {
    const result = generateCoachDecision({
      week_number: 1,
      stats: { ...goodStats, exercise_completion: '0/2' },
      logs: logsWithWeightTrend('flat'),
      is_phase_boundary: false,
      required_workout_count: 2,
    });
    expect(result.decision).toBe('KEEP');
  });
});

describe('coachEngine — weight stability does not override behavioral improvement (Phase 6)', () => {
  it('credits sleep/steps/energy improvement vs last week even when weight is flat', () => {
    const result = generateCoachDecision({
      week_number: 1,
      stats: goodStats,
      logs: logsWithWeightTrend('flat'),
      is_phase_boundary: false,
      required_workout_count: 2,
      previous: {
        average_steps: 6000,
        average_sleep_min: 340,
        average_energy: 2.8,
        exercise_completion: '1/2',
      },
    });
    expect(result.reason).toMatch(/和上周相比/);
    expect(result.reason).toMatch(/睡眠|步数|午后精神|训练规律性/);
  });

  it('credits improvement even when weight trend ticked up (never lets weight alone drive a negative message)', () => {
    const result = generateCoachDecision({
      week_number: 1,
      stats: goodStats,
      logs: logsWithWeightTrend('up'),
      is_phase_boundary: false,
      required_workout_count: 2,
      previous: {
        average_steps: 5000,
        average_sleep_min: 330,
        average_energy: 2.5,
        exercise_completion: '1/2',
      },
    });
    expect(result.decision).toBe('KEEP');
    expect(result.reason).toMatch(/和上周相比/);
  });

  it('adds no improvement note when there is no previous week data', () => {
    const result = generateCoachDecision({
      week_number: 1,
      stats: goodStats,
      logs: logsWithWeightTrend('flat'),
      is_phase_boundary: false,
      required_workout_count: 2,
    });
    expect(result.reason).not.toMatch(/和上周相比/);
  });
});

function makeReview(overrides: Partial<WeeklyReview> = {}): WeeklyReview {
  return {
    id: 'r1', user_id: 'u1', week_number: 1,
    average_steps: 6420, average_sleep_min: 375, average_energy: 2.8,
    exercise_completion: '2/2', pain_reported: false,
    coach_summary: 's', coach_decision: 'KEEP', coach_decision_reason: 'r',
    next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
    created_at: '2026-08-23T21:00:00.000Z',
    updated_at: '2026-08-23T21:00:00.000Z',
    ...overrides,
  };
}

describe('deriveWeeklyHighlights — matches the required "what went well / needs attention" shape', () => {
  it('matches the example: workout 2/2 + steps close to baseline went well; sleep + energy need attention', () => {
    const { wentWell, needsAttention } = deriveWeeklyHighlights(makeReview());
    expect(wentWell.some((s) => s.includes('训练 2/2'))).toBe(true);
    expect(wentWell.some((s) => s.includes('步数'))).toBe(true);
    expect(needsAttention.some((s) => s.includes('平均睡眠'))).toBe(true);
    expect(needsAttention.some((s) => s.includes('午后精神'))).toBe(true);
  });

  it('reports pain in needsAttention and does not also claim "no discomfort"', () => {
    const { wentWell, needsAttention } = deriveWeeklyHighlights(makeReview({ pain_reported: true }));
    expect(needsAttention.some((s) => /不适/.test(s))).toBe(true);
    expect(wentWell.some((s) => /没有记录到身体不适/.test(s))).toBe(false);
  });

  it('credits week-over-week improvement even when not part of the current week\'s raw numbers alone', () => {
    const previous = makeReview({ average_steps: 5000, average_sleep_min: 300, exercise_completion: '1/2' });
    const current = makeReview({ average_steps: 6800, average_sleep_min: 400, exercise_completion: '2/2' });
    const { wentWell } = deriveWeeklyHighlights(current, previous);
    expect(wentWell[0]).toMatch(/和上周相比/);
  });

  it('never uses judgmental Chinese words in highlights', () => {
    const { wentWell, needsAttention } = deriveWeeklyHighlights(
      makeReview({ average_steps: 3000, average_sleep_min: 250, average_energy: 1.8, exercise_completion: '0/2', pain_reported: true }),
    );
    const banned = /失败|不合格|太差|做得不够|做得不好/;
    for (const line of [...wentWell, ...needsAttention]) {
      expect(line).not.toMatch(banned);
    }
  });
});
