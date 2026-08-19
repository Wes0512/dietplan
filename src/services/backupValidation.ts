// =========================================================
// Backup Validation — Service 层（Phase 7）
// 纯函数：文件结构校验、schema 版本兼容性判断、"哪份更新"比较、
// 跨版本导入时的字段回填（normalize）。不碰数据库，方便单测。
// =========================================================
import { CURRENT_SCHEMA_VERSION } from '../db/schema';
import { computeDayNumber } from './dateEngine';
import type { DailyLog, User, WeeklyReview, WorkoutSession } from '../types';

// ---------------------------------------------------------
// 备份文件格式
// ---------------------------------------------------------
export interface BackupPayload {
  schema_version: number;
  app_version: string;
  exported_at: string;
  record_counts: {
    user: number;
    dailyLog: number;
    workoutSession: number;
    weeklyReview: number;
  };
  user: User[];
  dailyLog: DailyLog[];
  workoutSession: WorkoutSession[];
  weeklyReview: WeeklyReview[];
  // 注意：不包含 workout 表——那是内置内容配置（Workout A/B 的教学内容），
  // 不是用户数据，导入不应该覆盖设备上可能更新过的内容配置。
}

// ---------------------------------------------------------
// 文件结构校验
// ---------------------------------------------------------
export type BackupValidationResult =
  | { valid: true; payload: BackupPayload }
  | { valid: false; error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/**
 * 校验一份"看起来像 JSON 解析结果"的原始数据是否是合法的备份文件。
 * 绝不假设格式正确——任何缺字段/类型不对/数组长度和 record_counts 不一致
 * 都会被拒绝，并返回中文可读的错误信息。
 */
export function validateBackupFile(raw: unknown): BackupValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, error: '文件内容不是有效的备份格式（不是一个 JSON 对象）。' };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.schema_version !== 'number' || !Number.isInteger(obj.schema_version) || obj.schema_version < 1) {
    return { valid: false, error: '文件缺少有效的数据版本号（schema_version）。' };
  }
  if (!isNonEmptyString(obj.app_version)) {
    return { valid: false, error: '文件缺少 App 版本信息（app_version）。' };
  }
  if (!isNonEmptyString(obj.exported_at)) {
    return { valid: false, error: '文件缺少导出时间（exported_at）。' };
  }
  if (typeof obj.record_counts !== 'object' || obj.record_counts === null) {
    return { valid: false, error: '文件缺少记录数量摘要（record_counts）。' };
  }

  const tables: (keyof Pick<BackupPayload, 'user' | 'dailyLog' | 'workoutSession' | 'weeklyReview'>)[] = [
    'user', 'dailyLog', 'workoutSession', 'weeklyReview',
  ];
  for (const table of tables) {
    if (!isArray(obj[table])) {
      return { valid: false, error: `文件中的「${table}」不是有效的记录列表。` };
    }
  }

  const counts = obj.record_counts as Record<string, unknown>;
  for (const table of tables) {
    const declared = counts[table];
    const actual = (obj[table] as unknown[]).length;
    if (typeof declared !== 'number' || declared !== actual) {
      return {
        valid: false,
        error: `文件内容可能已损坏：「${table}」的记录数量摘要（${String(declared)}）与实际记录数（${actual}）不一致。`,
      };
    }
  }

  // 逐条粗校验必填字段，任何一条不合法就整体拒绝——不接受"部分损坏"的文件
  for (const log of obj.dailyLog as unknown[]) {
    if (!isValidDailyLogShape(log)) {
      return { valid: false, error: '文件中存在格式不正确的每日记录，已停止导入。' };
    }
  }
  for (const session of obj.workoutSession as unknown[]) {
    if (!isValidWorkoutSessionShape(session)) {
      return { valid: false, error: '文件中存在格式不正确的训练记录，已停止导入。' };
    }
  }
  for (const review of obj.weeklyReview as unknown[]) {
    if (!isValidWeeklyReviewShape(review)) {
      return { valid: false, error: '文件中存在格式不正确的每周复盘记录，已停止导入。' };
    }
  }
  for (const user of obj.user as unknown[]) {
    if (!isValidUserShape(user)) {
      return { valid: false, error: '文件中的个人资料格式不正确，已停止导入。' };
    }
  }

  return { valid: true, payload: obj as unknown as BackupPayload };
}

function isValidDailyLogShape(v: unknown): v is DailyLog {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isNonEmptyString(o.id) && isNonEmptyString(o.user_id) && isNonEmptyString(o.date)
    && typeof o.water_ml === 'number' && typeof o.sitting_breaks === 'number'
    && typeof o.exercise_completed === 'boolean' && isNonEmptyString(o.updated_at);
}

function isValidWorkoutSessionShape(v: unknown): v is WorkoutSession {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isNonEmptyString(o.id) && isNonEmptyString(o.user_id) && isNonEmptyString(o.date)
    && isNonEmptyString(o.workout_id) && typeof o.completed === 'boolean' && isNonEmptyString(o.created_at);
}

function isValidWeeklyReviewShape(v: unknown): v is WeeklyReview {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isNonEmptyString(o.id) && isNonEmptyString(o.user_id) && typeof o.week_number === 'number'
    && isNonEmptyString(o.exercise_completion) && isNonEmptyString(o.coach_decision)
    && isNonEmptyString(o.created_at);
  // updated_at 允许缺失——旧版本导出的文件会在 normalizeWeeklyReview 里回填
}

function isValidUserShape(v: unknown): v is User {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isNonEmptyString(o.id) && isNonEmptyString(o.name) && typeof o.height_cm === 'number'
    && typeof o.starting_weight_kg === 'number' && typeof o.target_weight_kg === 'number'
    && isNonEmptyString(o.created_at);
  // program_start_date 允许缺失——normalizeUser 里回填
}

// ---------------------------------------------------------
// Schema 版本兼容性
// ---------------------------------------------------------
export type SchemaCompatibility = 'compatible_current' | 'compatible_older' | 'incompatible_newer';

/**
 * - 文件版本 > 当前 App 支持的版本 → incompatible_newer，拒绝导入
 *   （绝不用旧版本 App 强行解读新版本数据，避免破坏性误读）
 * - 文件版本 < 当前版本 → compatible_older，导入前需要 normalize 补齐新字段
 * - 文件版本 = 当前版本 → compatible_current，直接可用
 */
export function checkSchemaCompatibility(fileVersion: number): SchemaCompatibility {
  if (fileVersion > CURRENT_SCHEMA_VERSION) return 'incompatible_newer';
  if (fileVersion < CURRENT_SCHEMA_VERSION) return 'compatible_older';
  return 'compatible_current';
}

// ---------------------------------------------------------
// "哪一份更新" 比较（用于 DailyLog / WeeklyReview 的合并冲突判断）
// ---------------------------------------------------------
export function isImportedNewer(importedUpdatedAt: string, localUpdatedAt: string): boolean {
  const imported = new Date(importedUpdatedAt).getTime();
  const local = new Date(localUpdatedAt).getTime();
  if (Number.isNaN(imported)) return false; // 时间戳解析失败，保守地认为本地更可信
  if (Number.isNaN(local)) return true;
  return imported > local;
}

// ---------------------------------------------------------
// 跨版本导入的字段回填（normalize）
// 只做"补齐新增字段"，绝不修改/删除原有字段的值。
// ---------------------------------------------------------
export function normalizeDailyLog(raw: DailyLog): DailyLog {
  return {
    ...raw,
    lunch_walk_done: raw.lunch_walk_done ?? false,
    shoulder_relax_done: raw.shoulder_relax_done ?? false,
    stretch_done: raw.stretch_done ?? false,
  };
}

export function normalizeWeeklyReview(raw: WeeklyReview): WeeklyReview {
  return {
    ...raw,
    updated_at: raw.updated_at ?? raw.created_at,
  };
}

export function normalizeUser(raw: User): User {
  return {
    ...raw,
    program_start_date: raw.program_start_date ?? raw.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  };
}

/**
 * WorkoutSession 的 planned_day_number 如果缺失，理论上可以用
 * program_start_date 反推（和 schema v3→v4 迁移同样的逻辑），
 * 但导入场景下我们手上不一定确定对应用户当时的 program_start_date
 * 与导入时是否一致，为避免用错误的日期反推出错误的计划天数，
 * 这里选择保守处理：缺失就留空，不做反推。
 */
export function normalizeWorkoutSession(raw: WorkoutSession, programStartDate?: string): WorkoutSession {
  if (raw.planned_day_number !== undefined || !programStartDate) return raw;
  return {
    ...raw,
    planned_day_number: computeDayNumber(programStartDate, raw.date),
  };
}
