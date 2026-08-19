import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { dailyLogRepo } from '../repositories/dailyLogRepo';

describe('dailyLogRepo', () => {
  // 每个测试后清空表内容（而不是关闭/删除数据库），
  // 保持同一个 db 连接在整个测试文件内存活，避免 DatabaseClosedError。
  afterEach(async () => {
    await db.dailyLog.clear();
  });

  it('upserts by [user_id+date] without creating duplicates', async () => {
    await dailyLogRepo.save('user-1', '2026-08-17', { water_ml: 250 });
    await dailyLogRepo.save('user-1', '2026-08-17', { water_ml: 500 });

    const all = await db.dailyLog.where('[user_id+date]').equals(['user-1', '2026-08-17']).toArray();
    expect(all.length).toBe(1);
    expect(all[0].water_ml).toBe(500);
  });

  it('different users on the same date do not collide', async () => {
    await dailyLogRepo.save('user-1', '2026-08-17', { water_ml: 250 });
    await dailyLogRepo.save('user-2', '2026-08-17', { water_ml: 999 });

    const count = await db.dailyLog.count();
    expect(count).toBe(2);
  });

  it('addWater accumulates instead of overwriting', async () => {
    await dailyLogRepo.addWater('user-1', '2026-08-18', 250);
    await dailyLogRepo.addWater('user-1', '2026-08-18', 500);
    const log = await dailyLogRepo.getByDate('user-1', '2026-08-18');
    expect(log?.water_ml).toBe(750);
  });

  it('incrementSittingBreak accumulates correctly', async () => {
    await dailyLogRepo.incrementSittingBreak('user-1', '2026-08-19');
    await dailyLogRepo.incrementSittingBreak('user-1', '2026-08-19');
    await dailyLogRepo.incrementSittingBreak('user-1', '2026-08-19');
    const log = await dailyLogRepo.getByDate('user-1', '2026-08-19');
    expect(log?.sitting_breaks).toBe(3);
  });

  it('new records default the three schema-v2 boolean fields to false', async () => {
    const log = await dailyLogRepo.save('user-1', '2026-08-20', {});
    expect(log.lunch_walk_done).toBe(false);
    expect(log.shoulder_relax_done).toBe(false);
    expect(log.stretch_done).toBe(false);
  });

  it('save() never lets a patch overwrite id/user_id/date identity fields', async () => {
    const first = await dailyLogRepo.save('user-1', '2026-08-21', { water_ml: 100 });
    // 故意在 patch 里传入 id/user_id/date，验证 repo 强制忽略、不被污染
    const second = await dailyLogRepo.save('user-1', '2026-08-21', {
      id: 'hacked-id',
      user_id: 'someone-else',
      water_ml: 200,
    });
    expect(second.id).toBe(first.id);
    expect(second.user_id).toBe('user-1');
  });

  it('delete removes the record', async () => {
    const log = await dailyLogRepo.save('user-1', '2026-08-22', { water_ml: 100 });
    await dailyLogRepo.delete(log.id);
    const found = await dailyLogRepo.getByDate('user-1', '2026-08-22');
    expect(found).toBeUndefined();
  });
});
