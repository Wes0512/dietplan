// =========================================================
// Backup Repository — Phase 7
// 唯一允许为了 Export/Import 目的直接触碰 db 的地方。
// UI 层（BackupPage）只调用这里的函数，不直接使用 Dexie。
// =========================================================
import { db, CURRENT_SCHEMA_VERSION } from '../db/schema';
import {
  checkSchemaCompatibility,
  isImportedNewer,
  normalizeDailyLog,
  normalizeUser,
  normalizeWeeklyReview,
  normalizeWorkoutSession,
  type BackupPayload,
  type SchemaCompatibility,
} from '../services/backupValidation';
import type { DailyLog, WeeklyReview, WorkoutSession } from '../types';

export async function getAppInfo(): Promise<{ app_version: string; schema_version: number }> {
  const config = await db.appConfig.get('singleton');
  return {
    app_version: config?.app_version ?? 'unknown',
    schema_version: config?.schema_version ?? CURRENT_SCHEMA_VERSION,
  };
}

// ---------------------------------------------------------
// 导出
// ---------------------------------------------------------
export async function exportAll(): Promise<BackupPayload> {
  const [user, dailyLog, workoutSession, weeklyReview] = await Promise.all([
    db.user.toArray(),
    db.dailyLog.toArray(),
    db.workoutSession.toArray(),
    db.weeklyReview.toArray(),
  ]);

  const config = await db.appConfig.get('singleton');

  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    app_version: config?.app_version ?? 'unknown',
    exported_at: new Date().toISOString(),
    record_counts: {
      user: user.length,
      dailyLog: dailyLog.length,
      workoutSession: workoutSession.length,
      weeklyReview: weeklyReview.length,
    },
    user,
    dailyLog,
    workoutSession,
    weeklyReview,
  };
}

/** 导出成功后记录"上次备份时间"，Backup 页面展示用 */
export async function recordExportTimestamp(): Promise<void> {
  const config = await db.appConfig.get('singleton');
  if (!config) return;
  await db.appConfig.update('singleton', { last_export_at: new Date().toISOString() });
}

export async function getLastExportAt(): Promise<string | undefined> {
  const config = await db.appConfig.get('singleton');
  return config?.last_export_at;
}

// ---------------------------------------------------------
// 导入前摘要（只读，不写任何数据）
// ---------------------------------------------------------
export interface ImportSummary {
  schemaCompatibility: SchemaCompatibility;

  totalDailyLogs: number;
  dailyLogsToAdd: number;
  dailyLogsToUpdate: number;
  dailyLogsSkipped: number;

  totalWorkoutSessions: number;

  totalWeeklyReviews: number;
  weeklyReviewsToAdd: number;
  weeklyReviewsToUpdate: number;
  weeklyReviewsSkipped: number;

  hasUserProfile: boolean;
  userProfileConflict: boolean;
}

export async function buildImportSummary(payload: BackupPayload): Promise<ImportSummary> {
  const schemaCompatibility = checkSchemaCompatibility(payload.schema_version);

  let dailyLogsToAdd = 0;
  let dailyLogsToUpdate = 0;
  let dailyLogsSkipped = 0;

  // 版本不兼容（比当前 App 更新）时，不做任何进一步读取判断——
  // 摘要里如实反映"0 add/0 update"，UI 层会因为 schemaCompatibility
  // 直接阻止继续导入，不需要在这里浪费查询。
  if (schemaCompatibility !== 'incompatible_newer') {
    for (const raw of payload.dailyLog) {
      const normalized = normalizeDailyLog(raw);
      const local = await db.dailyLog.where('[user_id+date]').equals([normalized.user_id, normalized.date]).first();
      if (!local) dailyLogsToAdd += 1;
      else if (isImportedNewer(normalized.updated_at, local.updated_at)) dailyLogsToUpdate += 1;
      else dailyLogsSkipped += 1;
    }
  }

  let weeklyReviewsToAdd = 0;
  let weeklyReviewsToUpdate = 0;
  let weeklyReviewsSkipped = 0;

  if (schemaCompatibility !== 'incompatible_newer') {
    for (const raw of payload.weeklyReview) {
      const normalized = normalizeWeeklyReview(raw);
      const local = await db.weeklyReview.where('[user_id+week_number]').equals([normalized.user_id, normalized.week_number]).first();
      if (!local) weeklyReviewsToAdd += 1;
      else if (isImportedNewer(normalized.updated_at, local.updated_at)) weeklyReviewsToUpdate += 1;
      else weeklyReviewsSkipped += 1;
    }
  }

  const localUser = await db.user.toCollection().first();
  const hasUserProfile = payload.user.length > 0;
  const userProfileConflict = hasUserProfile && localUser !== undefined;

  return {
    schemaCompatibility,
    totalDailyLogs: payload.dailyLog.length,
    dailyLogsToAdd,
    dailyLogsToUpdate,
    dailyLogsSkipped,
    totalWorkoutSessions: payload.workoutSession.length,
    totalWeeklyReviews: payload.weeklyReview.length,
    weeklyReviewsToAdd,
    weeklyReviewsToUpdate,
    weeklyReviewsSkipped,
    hasUserProfile,
    userProfileConflict,
  };
}

// ---------------------------------------------------------
// 实际导入（事务性，全部或全不生效）
// ---------------------------------------------------------
export interface ImportOptions {
  /** 本地已有 User 时，是否明确同意用导入文件里的资料覆盖 */
  overwriteUserProfile: boolean;
}

export interface ImportResult {
  dailyLogsAdded: number;
  dailyLogsUpdated: number;
  dailyLogsSkipped: number;
  workoutSessionsImported: number;
  weeklyReviewsAdded: number;
  weeklyReviewsUpdated: number;
  weeklyReviewsSkipped: number;
  userProfileImported: boolean;
}

export class BackupImportError extends Error {}

export async function performImport(payload: BackupPayload, options: ImportOptions): Promise<ImportResult> {
  const compatibility = checkSchemaCompatibility(payload.schema_version);
  if (compatibility === 'incompatible_newer') {
    throw new BackupImportError(
      `此备份文件的数据版本（v${payload.schema_version}）比当前 App 支持的版本（v${CURRENT_SCHEMA_VERSION}）更新，请先更新 App 再导入。`,
    );
  }

  return db.transaction('rw', [db.user, db.dailyLog, db.workoutSession, db.weeklyReview], async () => {
    const result: ImportResult = {
      dailyLogsAdded: 0,
      dailyLogsUpdated: 0,
      dailyLogsSkipped: 0,
      workoutSessionsImported: 0,
      weeklyReviewsAdded: 0,
      weeklyReviewsUpdated: 0,
      weeklyReviewsSkipped: 0,
      userProfileImported: false,
    };

    // ---- 完整性检查用的"导入前记录数"快照 ----
    const beforeDailyLogCount = await db.dailyLog.count();
    const beforeWeeklyReviewCount = await db.weeklyReview.count();
    const beforeWorkoutSessionCount = await db.workoutSession.count();

    const importedProgramStartDate = payload.user[0]?.program_start_date;

    // ---- DailyLog：按 [user_id+date] 合并，updated_at 新的赢，绝不盲目覆盖 ----
    for (const raw of payload.dailyLog) {
      const normalized = normalizeDailyLog(raw);
      const local = await db.dailyLog.where('[user_id+date]').equals([normalized.user_id, normalized.date]).first();

      if (!local) {
        await db.dailyLog.put(normalized);
        result.dailyLogsAdded += 1;
      } else if (isImportedNewer(normalized.updated_at, local.updated_at)) {
        // 保留本地记录的 id，避免同一个 [user_id+date] 出现两条不同 id 的记录
        const merged: DailyLog = { ...normalized, id: local.id };
        await db.dailyLog.put(merged);
        result.dailyLogsUpdated += 1;
      } else {
        result.dailyLogsSkipped += 1;
      }
    }

    // ---- WorkoutSession：按 id 天然去重/追加，允许同一天有多条不同 id 的训练记录
    //      （比如同一天先后做了两次训练），从不因为 planned_day_number 相同就互相删除 ----
    for (const raw of payload.workoutSession) {
      const normalized = normalizeWorkoutSession(raw, importedProgramStartDate);
      await db.workoutSession.put(normalized as WorkoutSession);
      result.workoutSessionsImported += 1;
    }

    // ---- WeeklyReview：按 [user_id+week_number] 合并，规则与 DailyLog 相同 ----
    for (const raw of payload.weeklyReview) {
      const normalized = normalizeWeeklyReview(raw);
      const local = await db.weeklyReview.where('[user_id+week_number]').equals([normalized.user_id, normalized.week_number]).first();

      if (!local) {
        await db.weeklyReview.put(normalized);
        result.weeklyReviewsAdded += 1;
      } else if (isImportedNewer(normalized.updated_at, local.updated_at)) {
        const merged: WeeklyReview = { ...normalized, id: local.id };
        await db.weeklyReview.put(merged);
        result.weeklyReviewsUpdated += 1;
      } else {
        result.weeklyReviewsSkipped += 1;
      }
    }

    // ---- User：本地已有资料时，没有明确同意就绝不覆盖 ----
    if (payload.user.length > 0) {
      const localUser = await db.user.toCollection().first();
      if (!localUser || options.overwriteUserProfile) {
        const normalized = normalizeUser(payload.user[0]);
        const merged = localUser ? { ...normalized, id: localUser.id } : normalized;
        await db.user.put(merged);
        result.userProfileImported = true;
      }
    }

    // ---- 完整性校验：导入永远不应该让记录数变少。任何一项不满足就抛错，
    //      Dexie 事务会自动整体回滚，不会留下"导入了一半"的脏数据。 ----
    const afterDailyLogCount = await db.dailyLog.count();
    const afterWeeklyReviewCount = await db.weeklyReview.count();
    const afterWorkoutSessionCount = await db.workoutSession.count();

    if (afterDailyLogCount < beforeDailyLogCount) {
      throw new BackupImportError('导入校验失败：每日记录数量异常减少，已取消本次导入。');
    }
    if (afterWeeklyReviewCount < beforeWeeklyReviewCount) {
      throw new BackupImportError('导入校验失败：每周复盘数量异常减少，已取消本次导入。');
    }
    if (afterWorkoutSessionCount < beforeWorkoutSessionCount) {
      throw new BackupImportError('导入校验失败：训练记录数量异常减少，已取消本次导入。');
    }

    return result;
  });
}
