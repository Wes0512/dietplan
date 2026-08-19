// =========================================================
// DailyLog Repository
// 关键点：同一 user_id + date 永远只有一条记录，
// save() 是 "upsert"，不会产生重复/脏数据。
// =========================================================
import { db } from '../db/schema';
import type { DailyLog } from '../types';

function emptyDailyLog(user_id: string, date: string): DailyLog {
  return {
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
}

export const dailyLogRepo = {
  async getByDate(user_id: string, date: string): Promise<DailyLog | undefined> {
    return db.dailyLog.where('[user_id+date]').equals([user_id, date]).first();
  },

  async getRange(user_id: string, startDate: string, endDate: string): Promise<DailyLog[]> {
    return db.dailyLog
      .where('date')
      .between(startDate, endDate, true, true)
      .and((log) => log.user_id === user_id)
      .toArray();
  },

  /** Upsert：如果当天已有记录，合并更新；否则创建新记录 */
  async save(user_id: string, date: string, patch: Partial<DailyLog>): Promise<DailyLog> {
    const existing = await this.getByDate(user_id, date);
    const base = existing ?? emptyDailyLog(user_id, date);
    const updated: DailyLog = {
      ...base,
      ...patch,
      // 以下字段不允许被 patch 覆盖，保持记录身份稳定
      id: base.id,
      user_id,
      date,
      updated_at: new Date().toISOString(),
    };
    await db.dailyLog.put(updated);
    return updated;
  },

  /** 便捷方法：水量按钮 +250/+500/+750，避免 UI 层自己做读-改-写 */
  async addWater(user_id: string, date: string, amount_ml: number): Promise<DailyLog> {
    const existing = await this.getByDate(user_id, date);
    const currentWater = existing?.water_ml ?? 0;
    return this.save(user_id, date, { water_ml: currentWater + amount_ml });
  },

  /** 便捷方法：Sitting Break "Done" 按钮 */
  async incrementSittingBreak(user_id: string, date: string): Promise<DailyLog> {
    const existing = await this.getByDate(user_id, date);
    const current = existing?.sitting_breaks ?? 0;
    return this.save(user_id, date, { sitting_breaks: current + 1 });
  },

  async delete(id: string): Promise<void> {
    // 需求：Delete 操作需要确认 —— 确认逻辑放在 UI 层（弹窗），
    // Repository 层只负责执行，不做二次确认（避免业务逻辑渗透到数据层）。
    await db.dailyLog.delete(id);
  },
};
