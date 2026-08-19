import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import {
  generateWeeklyReview,
  getWeeklyReviewWithHighlights,
  isWeekEligibleForReview,
} from '../services/weeklyReviewService';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { dailyLogRepo } from '../repositories/dailyLogRepo';

const PROGRAM_START = '2026-08-17'; // Day 1 = Monday

describe('isWeekEligibleForReview', () => {
  it('Week 1 is eligible once today is Day 7 or later', () => {
    expect(isWeekEligibleForReview(1, 6)).toBe(false);
    expect(isWeekEligibleForReview(1, 7)).toBe(true);
    expect(isWeekEligibleForReview(1, 10)).toBe(true);
  });
  it('Week 2 is eligible once today is Day 14 or later', () => {
    expect(isWeekEligibleForReview(2, 13)).toBe(false);
    expect(isWeekEligibleForReview(2, 14)).toBe(true);
  });
});

describe('generateWeeklyReview', () => {
  afterEach(async () => {
    await db.workoutSession.clear();
    await db.dailyLog.clear();
    await db.weeklyReview.clear();
  });

  it('generates a Week 1 review from logged data, including make-up workout sessions', async () => {
    // Day 1 workout done on time
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-17', workout_id: 'workout-a', planned_day_number: 1, feeling: 'comfortable',
    });
    // Day 4 workout made up late (on Day 6's date) — should still count for Week 1
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-22', workout_id: 'workout-b', planned_day_number: 4, feeling: 'tired',
    });
    for (const [date, steps, sleep] of [
      ['2026-08-17', 6200, 380], ['2026-08-18', 6500, 370], ['2026-08-19', 6800, 390],
      ['2026-08-20', 6300, 360], ['2026-08-21', 6600, 400], ['2026-08-22', 6100, 350], ['2026-08-23', 6700, 410],
    ] as [string, number, number][]) {
      await dailyLogRepo.save('user-1', date, { steps, sleep_duration_min: sleep, afternoon_energy: 4, water_ml: 2000 });
    }

    const review = await generateWeeklyReview('user-1', PROGRAM_START, 1);
    expect(review.week_number).toBe(1);
    expect(review.exercise_completion).toBe('2/2');
    expect(review.average_steps).toBeGreaterThan(6000);
    expect(review.coach_decision).toBeDefined();
  });

  it('is idempotent — regenerating the same week updates the existing record instead of duplicating', async () => {
    await dailyLogRepo.save('user-1', '2026-08-17', { steps: 6000, water_ml: 1800 });
    await generateWeeklyReview('user-1', PROGRAM_START, 1);
    await dailyLogRepo.save('user-1', '2026-08-18', { steps: 7000, water_ml: 2000 });
    await generateWeeklyReview('user-1', PROGRAM_START, 1);

    const all = await db.weeklyReview.where('[user_id+week_number]').equals(['user-1', 1]).toArray();
    expect(all.length).toBe(1);
  });

  it('passes the previous week\'s stats into Week 2 generation for improvement comparison', async () => {
    // Week 1: modest numbers
    for (const date of ['2026-08-17', '2026-08-18', '2026-08-19']) {
      await dailyLogRepo.save('user-1', date, { steps: 5000, sleep_duration_min: 320, afternoon_energy: 2, water_ml: 1700 });
    }
    await generateWeeklyReview('user-1', PROGRAM_START, 1);

    // Week 2: clearly improved numbers + completed workouts (avoid short-circuiting on low completion rate)
    for (const date of ['2026-08-24', '2026-08-25', '2026-08-26']) {
      await dailyLogRepo.save('user-1', date, { steps: 7000, sleep_duration_min: 400, afternoon_energy: 4, water_ml: 2100 });
    }
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-24', workout_id: 'workout-a', planned_day_number: 8, feeling: 'comfortable',
    });
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-27', workout_id: 'workout-b', planned_day_number: 11, feeling: 'comfortable',
    });
    const week2Review = await generateWeeklyReview('user-1', PROGRAM_START, 2);

    expect(week2Review.coach_summary).toMatch(/和上周相比/);
  });
});

describe('getWeeklyReviewWithHighlights', () => {
  afterEach(async () => {
    await db.dailyLog.clear();
    await db.weeklyReview.clear();
  });

  it('returns undefined when no review exists yet for that week', async () => {
    const result = await getWeeklyReviewWithHighlights('user-1', 1);
    expect(result).toBeUndefined();
  });

  it('returns review + derived highlights once generated', async () => {
    await dailyLogRepo.save('user-1', '2026-08-17', { steps: 6800, sleep_duration_min: 430, afternoon_energy: 4, water_ml: 2000 });
    await generateWeeklyReview('user-1', PROGRAM_START, 1);

    const result = await getWeeklyReviewWithHighlights('user-1', 1);
    expect(result).toBeDefined();
    expect(result!.highlights.wentWell.length).toBeGreaterThan(0);
  });
});
