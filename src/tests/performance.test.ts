import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { weeklyReviewRepo } from '../repositories/weeklyReviewRepo';
import { exportAll } from '../repositories/backupRepo';
import { computeBodyProgress, computeMovementProgress, computeRecoveryProgress, computeHabitsProgress } from '../services/progressEngine';
import { userRepo } from '../repositories/userRepo';

const USER_ID = 'perf-user';
const PROGRAM_START = '2026-01-01';

function dateOffset(days: number): string {
  const d = new Date(PROGRAM_START);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

afterEach(async () => {
  await db.user.clear();
  await db.dailyLog.clear();
  await db.workoutSession.clear();
  await db.weeklyReview.clear();
});

describe('Phase 9 §22 — performance with a normal prototype dataset (100/100/20)', () => {
  it('remains fast with 100 DailyLogs, 100 WorkoutSessions, 20 WeeklyReviews', async () => {
    await userRepo.create({
      name: 'Perf Test', age: 26, gender: 'male', height_cm: 165, starting_weight_kg: 66,
      target_weight_kg: 62, baseline_steps: 6300, program_start_date: PROGRAM_START,
    });

    const seedStart = Date.now();
    for (let i = 0; i < 100; i += 1) {
      await dailyLogRepo.save(USER_ID, dateOffset(i), {
        steps: 6000 + (i % 20) * 50,
        water_ml: 1800 + (i % 10) * 20,
        weight_kg: 66 - i * 0.02,
        sleep_duration_min: 360 + (i % 15) * 5,
        afternoon_energy: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      });
    }
    for (let i = 0; i < 100; i += 1) {
      await workoutSessionRepo.completeWorkout({
        user_id: USER_ID,
        date: dateOffset(i),
        workout_id: i % 2 === 0 ? 'workout-a' : 'workout-b',
        planned_day_number: (i % 14) + 1,
        feeling: 'comfortable',
      });
    }
    for (let w = 1; w <= 20; w += 1) {
      await weeklyReviewRepo.save({
        user_id: USER_ID, week_number: w, exercise_completion: '2/2', pain_reported: false,
        coach_summary: 's', coach_decision: 'KEEP', coach_decision_reason: 'r',
        next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
      });
    }
    const seedMs = Date.now() - seedStart;

    // Progress 页面用到的四个计算函数
    const user = (await userRepo.getCurrentUser())!;
    const logs = await dailyLogRepo.getRange(USER_ID, dateOffset(0), dateOffset(99));
    expect(logs.length).toBe(100);

    const progressStart = Date.now();
    const body = computeBodyProgress(user, logs);
    const movement = await computeMovementProgress(USER_ID, PROGRAM_START, 14, logs);
    const recovery = computeRecoveryProgress(logs);
    const habits = computeHabitsProgress(logs);
    const progressMs = Date.now() - progressStart;

    expect(body.weight_points.length).toBe(100);
    expect(movement.avg_steps).toBeGreaterThan(0);
    expect(recovery.avg_sleep_min).toBeGreaterThan(0);
    expect(habits.avg_water_ml).toBeGreaterThan(0);

    // Backup 导出
    const exportStart = Date.now();
    const payload = await exportAll();
    const exportMs = Date.now() - exportStart;

    expect(payload.dailyLog.length).toBe(100);
    expect(payload.workoutSession.length).toBe(100);
    expect(payload.weeklyReview.length).toBe(20);

    // 用比较宽松的阈值（这是 fake-indexeddb + CI 环境，不是真机性能基准），
    // 目的是确认"不会卡死/不会指数级变慢"，不是做严格的性能回归测试。
    expect(seedMs).toBeLessThan(15_000);
    expect(progressMs).toBeLessThan(2_000);
    expect(exportMs).toBeLessThan(2_000);
  }, 30_000);
});
