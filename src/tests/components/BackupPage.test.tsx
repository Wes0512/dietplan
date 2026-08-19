// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BackupPage } from '../../pages/BackupPage';
import { db, CURRENT_SCHEMA_VERSION } from '../../db/schema';

afterEach(async () => {
  cleanup();
  await db.dailyLog.clear();
  await db.user.clear();
  await db.appConfig.clear();
});

function renderBackupPage() {
  return render(
    <MemoryRouter>
      <BackupPage />
    </MemoryRouter>,
  );
}

function makeFile(content: unknown, name = 'backup.json'): File {
  return new File([JSON.stringify(content)], name, { type: 'application/json' });
}

describe('BackupPage — import confirmation summary (Phase 9 §8)', () => {
  it('shows the "即将导入" preview with correct counts and the no-delete notice before any write happens', async () => {
    const user = userEvent.setup();
    renderBackupPage();

    const payload = {
      schema_version: CURRENT_SCHEMA_VERSION,
      app_version: 'test',
      exported_at: '2026-08-24T00:00:00.000Z',
      record_counts: { user: 0, dailyLog: 2, workoutSession: 0, weeklyReview: 0 },
      user: [],
      dailyLog: [
        { id: 'l1', user_id: 'u1', date: '2026-08-17', water_ml: 1000, sitting_breaks: 0, exercise_completed: false, updated_at: '2026-08-17T00:00:00.000Z' },
        { id: 'l2', user_id: 'u1', date: '2026-08-18', water_ml: 1500, sitting_breaks: 0, exercise_completed: false, updated_at: '2026-08-18T00:00:00.000Z' },
      ],
      workoutSession: [],
      weeklyReview: [],
    };

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile(payload));

    expect(await screen.findByText('数据检查 ✓')).toBeInTheDocument();
    expect(screen.getByText('2 条每日记录')).toBeInTheDocument();
    expect(screen.getByText('0 次训练记录')).toBeInTheDocument();
    expect(screen.getByText('现有数据不会被直接删除。')).toBeInTheDocument();

    // 还没有点确认导入之前，数据库必须完全没被写入
    expect(await db.dailyLog.count()).toBe(0);
  });
});

describe('BackupPage — invalid file handling (Phase 9 §16)', () => {
  it('rejects a malformed file with a Chinese error message and never reaches the confirmation screen', async () => {
    const user = userEvent.setup();
    renderBackupPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile({ not: 'a backup file' }));

    expect(await screen.findByText('导入失败')).toBeInTheDocument();
    expect(screen.queryByText('数据检查 ✓')).not.toBeInTheDocument();
  });
});

describe('BackupPage — import cancellation (Phase 9 priority #9)', () => {
  it('clicking 取消 after previewing a valid file discards it without writing to the database', async () => {
    const user = userEvent.setup();
    renderBackupPage();

    const payload = {
      schema_version: CURRENT_SCHEMA_VERSION,
      app_version: 'test',
      exported_at: '2026-08-24T00:00:00.000Z',
      record_counts: { user: 0, dailyLog: 1, workoutSession: 0, weeklyReview: 0 },
      user: [],
      dailyLog: [
        { id: 'l1', user_id: 'u1', date: '2026-08-17', water_ml: 1000, sitting_breaks: 0, exercise_completed: false, updated_at: '2026-08-17T00:00:00.000Z' },
      ],
      workoutSession: [],
      weeklyReview: [],
    };

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile(payload));
    await screen.findByText('数据检查 ✓');

    await user.click(screen.getByRole('button', { name: '取消' }));

    // 回到初始状态：重新出现"选择备份文件"按钮，且数据库仍然是空的
    expect(await screen.findByRole('button', { name: '选择备份文件' })).toBeInTheDocument();
    expect(await db.dailyLog.count()).toBe(0);
  });

  it('confirming import actually writes the data (contrast case proving cancel really was a no-op)', async () => {
    const user = userEvent.setup();
    renderBackupPage();

    const payload = {
      schema_version: CURRENT_SCHEMA_VERSION,
      app_version: 'test',
      exported_at: '2026-08-24T00:00:00.000Z',
      record_counts: { user: 0, dailyLog: 1, workoutSession: 0, weeklyReview: 0 },
      user: [],
      dailyLog: [
        { id: 'l1', user_id: 'u1', date: '2026-08-17', water_ml: 1000, sitting_breaks: 0, exercise_completed: false, updated_at: '2026-08-17T00:00:00.000Z' },
      ],
      workoutSession: [],
      weeklyReview: [],
    };

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeFile(payload));
    await screen.findByText('数据检查 ✓');

    await user.click(screen.getByRole('button', { name: '确认导入' }));

    await waitFor(async () => {
      expect(await db.dailyLog.count()).toBe(1);
    });
    expect(await screen.findByText('导入成功 ✓')).toBeInTheDocument();
  });
});
