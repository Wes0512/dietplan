// =========================================================
// WeeklyReview Repository
// 复合索引 [user_id+week_number] 保证每周只有一份 review，
// 重复生成会更新既有记录，而不是产生第二条。
// =========================================================
import { db } from '../db/schema';
import type { WeeklyReview } from '../types';

export const weeklyReviewRepo = {
  async getByWeek(user_id: string, week_number: number): Promise<WeeklyReview | undefined> {
    return db.weeklyReview.where('[user_id+week_number]').equals([user_id, week_number]).first();
  },

  async getAll(user_id: string): Promise<WeeklyReview[]> {
    return db.weeklyReview.where('user_id').equals(user_id).sortBy('week_number');
  },

  /** Upsert：同一周重复生成时更新而不是新增，避免出现两份 Week 1 Review。
   *  updated_at 每次保存都会刷新（Phase 7 备份/导入冲突判断依赖这个字段）；
   *  created_at 只在第一次创建时写入，之后保持不变。 */
  async save(review: Omit<WeeklyReview, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<WeeklyReview> {
    const existing = await this.getByWeek(review.user_id, review.week_number);
    const full: WeeklyReview = {
      id: existing?.id ?? review.id ?? crypto.randomUUID(),
      created_at: existing?.created_at ?? new Date().toISOString(),
      ...review,
      updated_at: new Date().toISOString(),
    };
    await db.weeklyReview.put(full);
    return full;
  },

  /** Phase 7 导入用：直接写入一条完整的 WeeklyReview（保留原始 id/created_at/updated_at），
   *  不走"按 user_id+week_number upsert 生成新 updated_at"的常规流程。
   *  调用方（backupRepo）负责冲突判断，这里只负责落盘。 */
  async putRaw(review: WeeklyReview): Promise<void> {
    await db.weeklyReview.put(review);
  },

  async delete(id: string): Promise<void> {
    await db.weeklyReview.delete(id);
  },
};
