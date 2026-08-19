// =========================================================
// Migration / Init Strategy — Phase 1
// =========================================================
import { db, CURRENT_SCHEMA_VERSION } from './schema';
import type { AppConfig, User } from '../types';
import { seedWorkouts } from '../data/workouts.seed';

const APP_CONFIG_ID = 'singleton';
const APP_VERSION = '0.7.0-phase7';

/**
 * 重要说明：两层迁移机制
 *
 * 1. Dexie 自身的 schema 迁移（见 db/schema.ts 的 this.version(2).upgrade(...)）
 *    在 `db` 被打开（第一次访问任何 table）时【自动执行】，负责实际的字段回填，
 *    这一层由 Dexie 保证事务性、不会跑一半失败导致数据损坏。
 *
 * 2. 这里的 appConfig.schema_version 是我们自己维护的"应用层记录"，
 *    用途：(a) 未来展示"当前数据版本"给用户/调试用；
 *          (b) 未来从 IndexedDB 迁移到 Supabase 时，作为判断"这份导出数据
 *              对应哪个 schema"的依据（Dexie 的版本号不会跟着导出）。
 *    这一层不会重复执行 Dexie 已经做过的字段回填，只做记账。
 */

/**
 * 启动时调用一次。负责：
 * 1. 首次启动：创建 appConfig + seed workout 数据
 * 2. 非首次启动：检查 schema_version，若落后则依次执行迁移
 *
 * 硬性规则：迁移脚本只允许 ADD 字段/表，绝不 RENAME 或 DELETE
 * 已有字段；确实要废弃的字段标记 deprecated 但保留数据。
 */
export async function initDatabase(): Promise<void> {
  const config = await db.appConfig.get(APP_CONFIG_ID);

  if (!config) {
    // 全新安装
    await db.appConfig.put({
      id: APP_CONFIG_ID,
      schema_version: CURRENT_SCHEMA_VERSION,
      app_version: APP_VERSION,
    } satisfies AppConfig);

    await seedWorkoutsIfEmpty();
    return;
  }

  // 已有数据：按需迁移
  if (config.schema_version < CURRENT_SCHEMA_VERSION) {
    await runMigrations(config.schema_version, CURRENT_SCHEMA_VERSION);
    await db.appConfig.update(APP_CONFIG_ID, {
      schema_version: CURRENT_SCHEMA_VERSION,
      app_version: APP_VERSION,
    });
  } else {
    // 只更新 app_version（功能更新但 schema 没变）
    await db.appConfig.update(APP_CONFIG_ID, { app_version: APP_VERSION });
  }

  await seedWorkoutsIfEmpty();
}

async function seedWorkoutsIfEmpty(): Promise<void> {
  const count = await db.workout.count();
  if (count === 0) {
    await db.workout.bulkPut(seedWorkouts);
  }
  // 注意：workout 是"内容配置表"，不是用户数据。
  // 未来更新 Workout A/B 的内容（比如改动作说明文案），
  // 走单独的"内容版本号"对比更新单条记录，不做整表清空重建，
  // 避免影响已关联的 workoutSession 历史记录。
}

/**
 * 迁移执行器（应用层记账）。每个 fromVersion → fromVersion+1 是一个独立、
 * 幂等的步骤。实际字段级迁移已由 Dexie 的 version().upgrade() 完成，
 * 这里的 case 是"确认 + 记录"，不重复搬数据。
 */
async function runMigrations(fromVersion: number, toVersion: number): Promise<void> {
  let current = fromVersion;
  while (current < toVersion) {
    switch (current) {
      case 1:
        await confirmV1toV2();
        break;
      case 2:
        await confirmV2toV3();
        break;
      case 3:
        await confirmV3toV4();
        break;
      case 4:
        await confirmV4toV5();
        break;
      default:
        console.warn(`No migration step defined for version ${current}`);
        return;
    }
    current += 1;
  }
}

/**
 * v1 → v2：新增 lunch_walk_done / shoulder_relax_done / stretch_done。
 * Dexie upgrade() 已经把所有旧 dailyLog 记录回填为 false，
 * 这里只做一次校验性检查（开发期防呆，不影响生产逻辑）。
 */
async function confirmV1toV2(): Promise<void> {
  const sample = await db.dailyLog.toCollection().first();
  if (sample && (sample.lunch_walk_done === undefined)) {
    // 理论上不应该发生：说明 Dexie upgrade 没有正确执行
    console.error('v1→v2 migration inconsistency: lunch_walk_done missing after upgrade');
  }
}

/**
 * v2 → v3：User 新增 program_start_date。
 * Dexie upgrade() 已回填，这里只做校验。
 */
async function confirmV2toV3(): Promise<void> {
  const user = await db.user.toCollection().first();
  if (user && user.program_start_date === undefined) {
    console.error('v2→v3 migration inconsistency: program_start_date missing after upgrade');
  }
}

/**
 * v3 → v4：WorkoutSession 新增 planned_day_number。
 * Dexie upgrade() 已用 program_start_date 反推回填，这里只做校验。
 */
async function confirmV3toV4(): Promise<void> {
  const sample = await db.workoutSession.toCollection().first();
  if (sample && sample.planned_day_number === undefined) {
    // 注意：全新安装（没有历史 session）时这是正常情况，不算异常
    console.warn('v3→v4: some workoutSession records may still lack planned_day_number (expected if no user existed at migration time)');
  }
}

/**
 * v4 → v5：WeeklyReview 新增 updated_at。
 * Dexie upgrade() 已用 created_at 回填，这里只做校验。
 */
async function confirmV4toV5(): Promise<void> {
  const sample = await db.weeklyReview.toCollection().first();
  if (sample && sample.updated_at === undefined) {
    console.error('v4→v5 migration inconsistency: updated_at missing after upgrade');
  }
}

/** 帮助函数：确保存在一个 User（prototype 单用户，首次启动写入固定资料） */
export async function ensureUser(defaults: Omit<User, 'id' | 'created_at'>): Promise<User> {
  const existing = await db.user.toCollection().first();
  if (existing) return existing;

  const user: User = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...defaults,
  };
  await db.user.put(user);
  return user;
}
