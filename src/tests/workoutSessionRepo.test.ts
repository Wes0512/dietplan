import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import { workoutSessionRepo } from '../repositories/workoutRepo';

describe('workoutSessionRepo.completeWorkout — atomic transaction (Decision 2)', () => {
  afterEach(async () => {
    await db.workoutSession.clear();
    await db.dailyLog.clear();
  });

  it('writes WorkoutSession and updates DailyLog together on success', async () => {
    const { session, log } = await workoutSessionRepo.completeWorkout({
      user_id: 'user-1',
      date: '2026-08-17',
      workout_id: 'workout-a',
      feeling: 'comfortable',
    });

    expect(session.completed).toBe(true);
    expect(log.exercise_completed).toBe(true);
    expect(log.exercise_type).toBe('workout_a');

    const persistedSession = await db.workoutSession.get(session.id);
    const persistedLog = await db.dailyLog
      .where('[user_id+date]')
      .equals(['user-1', '2026-08-17'])
      .first();

    expect(persistedSession).toBeDefined();
    expect(persistedLog?.exercise_completed).toBe(true);
  });

  it('preserves existing DailyLog fields (e.g. water_ml already logged) instead of overwriting them', async () => {
    await db.dailyLog.put({
      id: 'existing-log',
      user_id: 'user-1',
      date: '2026-08-18',
      water_ml: 1500,
      sitting_breaks: 2,
      exercise_completed: false,
      lunch_walk_done: true,
      shoulder_relax_done: false,
      stretch_done: false,
      updated_at: '2026-08-18T09:00:00.000Z',
    });

    const { log } = await workoutSessionRepo.completeWorkout({
      user_id: 'user-1',
      date: '2026-08-18',
      workout_id: 'workout-b',
      feeling: 'tired',
    });

    expect(log.water_ml).toBe(1500); // 没被覆盖
    expect(log.sitting_breaks).toBe(2); // 没被覆盖
    expect(log.lunch_walk_done).toBe(true); // 没被覆盖
    expect(log.exercise_completed).toBe(true); // 新写入
    expect(log.exercise_type).toBe('workout_b');
  });

  it('rolls back both tables if the DailyLog write fails mid-transaction', async () => {
    const putSpy = vi.spyOn(db.dailyLog, 'put').mockImplementationOnce(() => {
      throw new Error('simulated failure');
    });

    await expect(
      workoutSessionRepo.completeWorkout({
        user_id: 'user-1',
        date: '2026-08-19',
        workout_id: 'workout-a',
        feeling: 'comfortable',
      }),
    ).rejects.toThrow();

    putSpy.mockRestore();

    // 事务失败后，WorkoutSession 也不应该被残留写入
    const sessions = await db.workoutSession
      .where('date')
      .equals('2026-08-19')
      .toArray();
    expect(sessions.length).toBe(0);

    const log = await db.dailyLog
      .where('[user_id+date]')
      .equals(['user-1', '2026-08-19'])
      .first();
    expect(log).toBeUndefined();
  });
});

describe('workoutSessionRepo — planned_day_number / getByPlannedDay (Decision 4)', () => {
  afterEach(async () => {
    await db.workoutSession.clear();
    await db.dailyLog.clear();
  });

  it('stores planned_day_number alongside the actual performed date without conflating the two', async () => {
    const { session } = await workoutSessionRepo.completeWorkout({
      user_id: 'user-1',
      date: '2026-08-19', // performed 2 days late
      workout_id: 'workout-a',
      planned_day_number: 1,
      feeling: 'tired',
    });

    expect(session.date).toBe('2026-08-19');
    expect(session.planned_day_number).toBe(1);
  });

  it('getByPlannedDay finds the session by plan day regardless of which calendar date it was performed on', async () => {
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1',
      date: '2026-08-22', // made up 5 days later
      workout_id: 'workout-a',
      planned_day_number: 1,
      feeling: 'comfortable',
    });

    const sessions = await workoutSessionRepo.getByPlannedDay('user-1', 1);
    expect(sessions.length).toBe(1);
    expect(sessions[0].date).toBe('2026-08-22');
  });

  it('getByPlannedDay is scoped per user and per planned day — no cross-contamination', async () => {
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-17', workout_id: 'workout-a', planned_day_number: 1, feeling: 'comfortable',
    });
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-2', date: '2026-08-17', workout_id: 'workout-a', planned_day_number: 1, feeling: 'comfortable',
    });
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-20', workout_id: 'workout-b', planned_day_number: 4, feeling: 'comfortable',
    });

    const user1Day1 = await workoutSessionRepo.getByPlannedDay('user-1', 1);
    expect(user1Day1.length).toBe(1);
    expect(user1Day1[0].user_id).toBe('user-1');
  });

  it('completeWorkout without planned_day_number leaves it undefined (backward-compatible, optional field)', async () => {
    const { session } = await workoutSessionRepo.completeWorkout({
      user_id: 'user-1',
      date: '2026-08-17',
      workout_id: 'workout-a',
      feeling: 'comfortable',
    });
    expect(session.planned_day_number).toBeUndefined();
  });
});
