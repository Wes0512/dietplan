import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db } from '../db/schema';

const DB_NAME = 'coachdb';

describe('schema v1 -> v2 migration', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(DB_NAME);
  });

  it('backfills lunch_walk_done / shoulder_relax_done / stretch_done to false on existing records, without touching other fields', async () => {
    // 1. 用一个只有 v1 schema 的独立 Dexie 实例，模拟"旧版本 App 留下的数据库"
    const v1db = new Dexie(DB_NAME);
    v1db.version(1).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    });
    await v1db.open();
    await v1db.table('dailyLog').put({
      id: 'log-old-1',
      user_id: 'user-1',
      date: '2026-08-01',
      water_ml: 500,
      sitting_breaks: 2,
      exercise_completed: true,
      exercise_type: 'workout-a',
      updated_at: '2026-08-01T10:00:00.000Z',
      // 注意：没有 lunch_walk_done / shoulder_relax_done / stretch_done —— 模拟真正的旧数据
    });
    v1db.close();

    // 2. 打开真正的 app db（内部注册了 version(1) 和 version(2)）
    //    Dexie 侦测到现存数据库版本是 1，会自动依序执行 version(2).upgrade()
    await db.open();

    const migrated = await db.dailyLog.get('log-old-1');
    expect(migrated).toBeDefined();

    // 新字段被正确回填为 false
    expect(migrated?.lunch_walk_done).toBe(false);
    expect(migrated?.shoulder_relax_done).toBe(false);
    expect(migrated?.stretch_done).toBe(false);

    // 旧字段完全没有被覆盖或丢失
    expect(migrated?.water_ml).toBe(500);
    expect(migrated?.sitting_breaks).toBe(2);
    expect(migrated?.exercise_completed).toBe(true);
    expect(migrated?.exercise_type).toBe('workout-a');
    expect(migrated?.updated_at).toBe('2026-08-01T10:00:00.000Z');
  });

  it('records created after migration also have the three boolean fields correctly set', async () => {
    await db.open();
    await db.dailyLog.put({
      id: 'log-new-1',
      user_id: 'user-1',
      date: '2026-08-25',
      water_ml: 0,
      sitting_breaks: 0,
      exercise_completed: false,
      lunch_walk_done: true,
      shoulder_relax_done: false,
      stretch_done: true,
      updated_at: new Date().toISOString(),
    });
    const log = await db.dailyLog.get('log-new-1');
    expect(log?.lunch_walk_done).toBe(true);
    expect(log?.shoulder_relax_done).toBe(false);
    expect(log?.stretch_done).toBe(true);
  });
});

describe('schema v3 -> v4 migration (Phase 4.5 Decision 4: planned_day_number)', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(DB_NAME);
  });

  it('backfills planned_day_number on old WorkoutSession records using the user\'s program_start_date', async () => {
    // 1. 模拟一个只到 v3 的旧数据库：有 User（含 program_start_date）和一条
    //    没有 planned_day_number 的 WorkoutSession
    const v3db = new Dexie(DB_NAME);
    v3db.version(1).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    });
    v3db.version(2).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    });
    v3db.version(3).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    });
    await v3db.open();
    await v3db.table('user').put({
      id: 'user-1',
      name: 'Test User',
      age: 26,
      gender: 'male',
      height_cm: 165,
      starting_weight_kg: 66,
      target_weight_kg: 62,
      baseline_steps: 6300,
      program_start_date: '2026-08-17', // Monday = Day 1
      created_at: '2026-08-17T06:00:00.000Z',
    });
    await v3db.table('workoutSession').put({
      id: 'session-old-1',
      user_id: 'user-1',
      date: '2026-08-20', // this is Day 4's calendar date
      workout_id: 'workout-b',
      completed: true,
      feeling: 'comfortable',
      created_at: '2026-08-20T19:00:00.000Z',
      // 注意：没有 planned_day_number —— 模拟真正的旧数据
    });
    v3db.close();

    // 2. 打开真正的 app db（含 v4），触发自动升级
    await db.open();

    const migrated = await db.workoutSession.get('session-old-1');
    expect(migrated).toBeDefined();
    // 2026-08-20 相对 program_start_date 2026-08-17 是第 4 天
    expect(migrated?.planned_day_number).toBe(4);

    // 旧字段完全没有被覆盖或丢失
    expect(migrated?.workout_id).toBe('workout-b');
    expect(migrated?.completed).toBe(true);
    expect(migrated?.date).toBe('2026-08-20');
  });

  it('does not crash when migrating a database with WorkoutSession records but no User yet', async () => {
    const v3db = new Dexie(DB_NAME);
    v3db.version(1).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    });
    await v3db.open();
    await v3db.table('workoutSession').put({
      id: 'orphan-session',
      user_id: 'user-1',
      date: '2026-08-20',
      workout_id: 'workout-b',
      completed: true,
      created_at: '2026-08-20T19:00:00.000Z',
    });
    v3db.close();

    await expect(db.open()).resolves.toBeDefined();
    const session = await db.workoutSession.get('orphan-session');
    expect(session?.planned_day_number).toBeUndefined(); // 没有 User，跳过回填，不报错
  });
});
