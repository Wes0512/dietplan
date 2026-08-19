// =========================================================
// Dexie Database Schema — Phase 1
// =========================================================
import Dexie, { type Table } from 'dexie';
import type {
  User,
  DailyLog,
  Workout,
  WorkoutSession,
  WeeklyReview,
  AppConfig,
} from '../types';
import { computeDayNumber } from '../services/dateEngine';

export const CURRENT_SCHEMA_VERSION = 5;

export class CoachDB extends Dexie {
  user!: Table<User, string>;
  dailyLog!: Table<DailyLog, string>;
  workout!: Table<Workout, string>;
  workoutSession!: Table<WorkoutSession, string>;
  weeklyReview!: Table<WeeklyReview, string>;
  appConfig!: Table<AppConfig, string>;

  constructor() {
    super('coachdb');

    // ---- v1 ----
    this.version(1).stores({
      // 主键 id；复合索引 [user_id+date] 保证同一用户同一天只有一条 DailyLog，
      // 重复保存自动变成"更新"而不是产生脏数据
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    });

    // ---- v2：新增 lunch_walk_done / shoulder_relax_done / stretch_done ----
    // 三个字段都不需要建索引（只在 UI 层按 date 读取整条记录后判断），
    // 所以 stores() 的索引字符串与 v1 完全一致，只有 upgrade() 里做字段回填。
    this.version(2).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    }).upgrade(async (tx) => {
      // 只新增字段，绝不删除/覆盖已有字段；旧记录一律回填 false
      await tx.table('dailyLog').toCollection().modify((log) => {
        if (log.lunch_walk_done === undefined) log.lunch_walk_done = false;
        if (log.shoulder_relax_done === undefined) log.shoulder_relax_done = false;
        if (log.stretch_done === undefined) log.stretch_done = false;
      });
    });

    // ---- v3：User 新增 program_start_date（Phase 3，自然日历推进用） ----
    this.version(3).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    }).upgrade(async (tx) => {
      // 旧用户没有 program_start_date：用 created_at 的日期部分回填，
      // 保证"从今天算第几天"逻辑在老数据上也能正常工作，不需要用户重新输入。
      await tx.table('user').toCollection().modify((u) => {
        if (u.program_start_date === undefined) {
          u.program_start_date = (u.created_at as string | undefined)?.slice(0, 10)
            ?? new Date().toISOString().slice(0, 10);
        }
      });
    });

    // ---- v4：WorkoutSession 新增 planned_day_number（Phase 4.5） ----
    // 新增复合索引 [user_id+planned_day_number]，让 "这一天的计划训练是否
    // 已完成"可以按"计划里的第几天"查询，而不是按日历日期查询——
    // 这样允许用户补做/提前做训练，不强制锁定顺序。
    this.version(4).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id, planned_day_number, [user_id+planned_day_number]',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    }).upgrade(async (tx) => {
      // 旧的 WorkoutSession 记录没有 planned_day_number。
      // 用该用户的 program_start_date 反推：session.date 当时对应计划里的第几天，
      // 作为最合理的回填值（不是精确保证，但比留空更有用）。
      // 单用户 prototype：直接取表里唯一的 user 记录。
      const user = await tx.table('user').toCollection().first();
      if (!user) return; // 没有用户数据（全新安装），无需回填

      await tx.table('workoutSession').toCollection().modify((session) => {
        if (session.planned_day_number === undefined) {
          session.planned_day_number = computeDayNumber(user.program_start_date, session.date);
        }
      });
    });

    // ---- v5：WeeklyReview 新增 updated_at（Phase 7，备份/导入冲突判断用） ----
    // AppConfig 新增 last_export_at（可选字段，IndexedDB 不需要为它建索引，
    // 不需要显式 stores() 变更也能存取，但为保持版本记录的一致性，这里仍然
    // 走一次正式的版本升级步骤）。
    this.version(5).stores({
      user: 'id, name',
      dailyLog: 'id, user_id, date, [user_id+date]',
      workout: 'id, name, level',
      workoutSession: 'id, user_id, date, workout_id, planned_day_number, [user_id+planned_day_number]',
      weeklyReview: 'id, user_id, week_number, [user_id+week_number]',
      appConfig: 'id',
    }).upgrade(async (tx) => {
      // 旧的 WeeklyReview 记录没有 updated_at：用 created_at 回填，
      // 保证"哪一份更新"的判断在老数据上也不会因为字段缺失而出错。
      await tx.table('weeklyReview').toCollection().modify((review) => {
        if (review.updated_at === undefined) {
          review.updated_at = review.created_at;
        }
      });
    });
  }
}

export const db = new CoachDB();
