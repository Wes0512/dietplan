import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { getPlanDayViews } from '../services/planStatusEngine';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { weeklyReviewRepo } from '../repositories/weeklyReviewRepo';

const PROGRAM_START = '2026-08-17'; // Monday = Day 1

describe('planStatusEngine — visual states never punish rest/recovery', () => {
  afterEach(async () => {
    await db.workoutSession.clear();
    await db.dailyLog.clear();
    await db.weeklyReview.clear();
  });

  it('Rest (Day 3) and Recovery (Day 2) are always their own state, regardless of today', async () => {
    // "today" is Day 10 — both Day 2 and Day 3 are far in the past
    const views = await getPlanDayViews('user-1', PROGRAM_START, 10);
    const day2 = views.find((v) => v.dayPlan.day_number === 2)!;
    const day3 = views.find((v) => v.dayPlan.day_number === 3)!;

    expect(day2.state).toBe('recovery');
    expect(day3.state).toBe('rest');
  });

  it('marks the current day as "today"', async () => {
    const views = await getPlanDayViews('user-1', PROGRAM_START, 4);
    const day4 = views.find((v) => v.dayPlan.day_number === 4)!;
    expect(day4.state).toBe('today');
  });

  it('future days are "upcoming"', async () => {
    const views = await getPlanDayViews('user-1', PROGRAM_START, 1);
    const day4 = views.find((v) => v.dayPlan.day_number === 4)!;
    expect(day4.state).toBe('upcoming');
  });

  it('a past workout day with a completed session shows "completed"', async () => {
    // Day 1 date = 2026-08-17
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1',
      date: '2026-08-17',
      workout_id: 'workout-a',
      planned_day_number: 1,
      feeling: 'comfortable',
    });

    const views = await getPlanDayViews('user-1', PROGRAM_START, 5); // "today" is Day 5, Day 1 is in the past
    const day1 = views.find((v) => v.dayPlan.day_number === 1)!;
    expect(day1.state).toBe('completed');
  });

  it('a past workout day with NO session is "upcoming", never a negative/failed state', async () => {
    const views = await getPlanDayViews('user-1', PROGRAM_START, 5);
    const day1 = views.find((v) => v.dayPlan.day_number === 1)!;
    // Day 1 has no workoutSession recorded in this test — still must not be a "failed" style state
    expect(day1.state).toBe('upcoming');
    expect(['today', 'completed', 'upcoming', 'rest', 'recovery']).toContain(day1.state);
  });

  it('Decision 4: a make-up session (performed late, on a different calendar date) still marks the ORIGINAL planned day as completed', async () => {
    // Day 1 was planned for 2026-08-17, but the user actually did it on 2026-08-19 (Day 3's date)
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1',
      date: '2026-08-19', // performed_date — different from the planned day's calendar date
      workout_id: 'workout-a',
      planned_day_number: 1, // planned_day_number — the day it was originally meant for
      feeling: 'tired',
    });

    const views = await getPlanDayViews('user-1', PROGRAM_START, 5);
    const day1 = views.find((v) => v.dayPlan.day_number === 1)!;
    expect(day1.state).toBe('completed');

    // The session's own `date` field must NOT have been silently changed to match the plan
    const sessions = await workoutSessionRepo.getByPlannedDay('user-1', 1);
    expect(sessions[0].date).toBe('2026-08-19');
    expect(sessions[0].planned_day_number).toBe(1);
  });

  it('a past low_impact day (Day 6) is "completed" once exercise_type is recorded', async () => {
    await dailyLogRepo.save('user-1', '2026-08-22', { exercise_type: 'low_impact_activity' });
    const views = await getPlanDayViews('user-1', PROGRAM_START, 8);
    const day6 = views.find((v) => v.dayPlan.day_number === 6)!;
    expect(day6.state).toBe('completed');
  });

  it('a past full_review day (Day 7) is "completed" once a WeeklyReview exists for that week', async () => {
    await weeklyReviewRepo.save({
      user_id: 'user-1',
      week_number: 1,
      exercise_completion: '2/2',
      pain_reported: false,
      coach_summary: 's',
      coach_decision: 'KEEP',
      coach_decision_reason: 'r',
      next_week_goal_1: 'a',
      next_week_goal_2: 'b',
      next_week_goal_3: 'c',
    });
    const views = await getPlanDayViews('user-1', PROGRAM_START, 9);
    const day7 = views.find((v) => v.dayPlan.day_number === 7)!;
    expect(day7.state).toBe('completed');
  });
});
