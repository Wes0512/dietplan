// =========================================================
// User Repository — 唯一允许直接碰 db.user 的地方
// =========================================================
import { db } from '../db/schema';
import type { User } from '../types';

export const userRepo = {
  async getCurrentUser(): Promise<User | undefined> {
    // Prototype 单用户：取表里第一条（也是唯一一条）记录
    return db.user.toCollection().first();
  },

  async create(defaults: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const existing = await this.getCurrentUser();
    if (existing) {
      throw new Error('User already exists — prototype 只支持单用户，不能重复创建');
    }
    const user: User = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...defaults,
    };
    await db.user.put(user);
    return user;
  },

  async update(id: string, patch: Partial<Omit<User, 'id' | 'created_at'>>): Promise<void> {
    await db.user.update(id, patch);
  },
};
