// =========================================================
// Workout + WorkoutSession Repository
// =========================================================
import { db } from '../db/schema';
import type { DailyLog, Workout, WorkoutSession } from '../types';

export const workoutRepo = {
  async getById(id: string): Promise<Workout | undefined> {
    return db.workout.get(id);
  },

  async getAll(): Promise<Workout[]> {
    return db.workout.toArray();
  },
};

export const workoutSessionRepo = {
  /**
   * 决策 2：训练完成时，WorkoutSession 和 DailyLog 的更新必须在同一个
   * Dexie transaction 里完成。任何一步失败，两边都不会落地，
   * 不允许出现"session 写了，DailyLog 没更新"这种中间态。
   */
  async completeWorkout(params: {
    user_id: string;
    date: string;
    workout_id: string;
    /** 决策 4：这次训练对应 14 天计划里的第几天。允许补做/提前做，
     *  date 记录实际完成日，planned_day_number 记录原计划的那一天，
     *  两者互不覆盖。 */
    planned_day_number?: number;
    feeling?: WorkoutSession['feeling'];
    pain_area?: WorkoutSession['pain_area'];
    notes?: string;
  }): Promise<{ session: WorkoutSession; log: DailyLog }> {
    const { user_id, date, workout_id, planned_day_number, feeling, pain_area, notes } = params;

    return db.transaction('rw', [db.workoutSession, db.dailyLog], async () => {
      const session: WorkoutSession = {
        id: crypto.randomUUID(),
        user_id,
        date,
        workout_id,
        planned_day_number,
        completed: true,
        feeling,
        pain_area,
        notes,
        created_at: new Date().toISOString(),
      };
      await db.workoutSession.put(session);

      const existingLog = await db.dailyLog
        .where('[user_id+date]')
        .equals([user_id, date])
        .first();

      const baseLog: DailyLog = existingLog ?? {
        id: crypto.randomUUID(),
        user_id,
        date,
        water_ml: 0,
        sitting_breaks: 0,
        exercise_completed: false,
        lunch_walk_done: false,
        shoulder_relax_done: false,
        stretch_done: false,
        updated_at: new Date().toISOString(),
      };

      const updatedLog: DailyLog = {
        ...baseLog,
        exercise_completed: true,
        exercise_type: workout_id.replace(/-/g, '_'),
        exercise_feeling: feeling,
        pain_area: pain_area ?? baseLog.pain_area,
        updated_at: new Date().toISOString(),
      };
      await db.dailyLog.put(updatedLog);

      return { session, log: updatedLog };
      // 如果 workoutSession.put 或 dailyLog.put 任何一步抛出异常，
      // Dexie 会自动回滚整个事务，两张表都不会有部分写入残留。
    });
  },

  async create(session: Omit<WorkoutSession, 'id' | 'created_at'>): Promise<WorkoutSession> {
    const full: WorkoutSession = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...session,
    };
    await db.workoutSession.put(full);
    return full;
  },

  async getByDate(user_id: string, date: string): Promise<WorkoutSession[]> {
    return db.workoutSession
      .where('date')
      .equals(date)
      .and((s) => s.user_id === user_id)
      .toArray();
  },

  async getRange(user_id: string, startDate: string, endDate: string): Promise<WorkoutSession[]> {
    return db.workoutSession
      .where('date')
      .between(startDate, endDate, true, true)
      .and((s) => s.user_id === user_id)
      .toArray();
  },

  /**
   * 决策 4：按"计划里的第几天"查询，而不是按日历日期查询——
   * 这样即使用户在 Day 5 才补做 Day 1 的训练，Plan 页面依然能正确
   * 识别 "Day 1 已完成"，不需要用户在补做当天才能看到 Day 1 的完成状态。
   */
  async getByPlannedDay(user_id: string, planned_day_number: number): Promise<WorkoutSession[]> {
    return db.workoutSession
      .where('[user_id+planned_day_number]')
      .equals([user_id, planned_day_number])
      .toArray();
  },

  async delete(id: string): Promise<void> {
    await db.workoutSession.delete(id);
  },
};
