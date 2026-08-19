import { afterEach, describe, expect, it } from 'vitest';
import { db, CURRENT_SCHEMA_VERSION } from '../db/schema';
import {
  buildImportSummary,
  exportAll,
  performImport,
  BackupImportError,
} from '../repositories/backupRepo';
import { validateBackupFile, type BackupPayload } from '../services/backupValidation';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { userRepo } from '../repositories/userRepo';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { weeklyReviewRepo } from '../repositories/weeklyReviewRepo';
import type { User, WeeklyReview } from '../types';

async function clearAll() {
  await db.user.clear();
  await db.dailyLog.clear();
  await db.workoutSession.clear();
  await db.weeklyReview.clear();
}

describe('Phase 7 — Backup/Import scenarios', () => {
  afterEach(clearAll);

  // 1. Export → Import round trip
  it('1. export then import into an identical empty database reproduces all records', async () => {
    await userRepo.create({
      name: 'Ali', age: 26, gender: 'male', height_cm: 165, starting_weight_kg: 66,
      target_weight_kg: 62, baseline_steps: 6300, program_start_date: '2026-08-17',
    });
    const user = (await userRepo.getCurrentUser())!;
    await dailyLogRepo.save(user.id, '2026-08-17', { steps: 6800, water_ml: 2000 });
    await workoutSessionRepo.completeWorkout({
      user_id: user.id, date: '2026-08-17', workout_id: 'workout-a', planned_day_number: 1, feeling: 'comfortable',
    });
    await weeklyReviewRepo.save({
      user_id: user.id, week_number: 1, exercise_completion: '1/1', pain_reported: false,
      coach_summary: 's', coach_decision: 'KEEP', coach_decision_reason: 'r',
      next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
    });

    const exported = await exportAll();
    await clearAll();

    const result = await performImport(exported, { overwriteUserProfile: true });
    expect(result.dailyLogsAdded).toBe(1);
    expect(result.workoutSessionsImported).toBe(1);
    expect(result.weeklyReviewsAdded).toBe(1);
    expect(result.userProfileImported).toBe(true);

    const restoredUser = await userRepo.getCurrentUser();
    expect(restoredUser?.name).toBe('Ali');
    const restoredLog = await dailyLogRepo.getByDate(user.id, '2026-08-17');
    expect(restoredLog?.steps).toBe(6800);
  });

  // 2. Import into empty database
  it('2. importing into a completely empty database adds every record', async () => {
    const payload = makePayload({
      user: [makeUser()],
      dailyLog: [makeDailyLog('2026-08-17')],
      workoutSession: [makeSession('s1', '2026-08-17', 1)],
      weeklyReview: [makeReview(1)],
    });
    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.dailyLogsAdded).toBe(1);
    expect(result.workoutSessionsImported).toBe(1);
    expect(result.weeklyReviewsAdded).toBe(1);
    expect(result.userProfileImported).toBe(true); // no local user existed, so it's imported without needing the flag
  });

  // 3. Import into database with existing records
  it('3. importing into a database with existing, non-overlapping records adds alongside them', async () => {
    await dailyLogRepo.save('user-1', '2026-08-10', { steps: 5000 });
    const payload = makePayload({ dailyLog: [makeDailyLog('2026-08-17')] });
    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.dailyLogsAdded).toBe(1);
    const all = await db.dailyLog.count();
    expect(all).toBe(2); // both old and new present
  });

  // 4. Duplicate DailyLog handling
  it('4a. duplicate DailyLog (same user+date): imported NEWER wins and overwrites in place (same id preserved)', async () => {
    const local = await dailyLogRepo.save('user-1', '2026-08-17', { steps: 5000 });
    const importedNewer = makeDailyLog('2026-08-17', { steps: 9000, updated_at: futureIso(local.updated_at) });
    const payload = makePayload({ dailyLog: [importedNewer] });

    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.dailyLogsUpdated).toBe(1);
    expect(result.dailyLogsAdded).toBe(0);

    const count = await db.dailyLog.count(); // must still be exactly 1 row for this [user+date]
    expect(count).toBe(1);
    const merged = await dailyLogRepo.getByDate('user-1', '2026-08-17');
    expect(merged?.steps).toBe(9000);
    expect(merged?.id).toBe(local.id); // id preserved, not replaced with the imported id
  });

  it('4b. duplicate DailyLog: imported OLDER is skipped, local data is untouched', async () => {
    const local = await dailyLogRepo.save('user-1', '2026-08-17', { steps: 5000 });
    const importedOlder = makeDailyLog('2026-08-17', { steps: 1234, updated_at: '2020-01-01T00:00:00.000Z' });
    const payload = makePayload({ dailyLog: [importedOlder] });

    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.dailyLogsSkipped).toBe(1);

    const merged = await dailyLogRepo.getByDate('user-1', '2026-08-17');
    expect(merged?.steps).toBe(5000); // untouched
    expect(merged?.id).toBe(local.id);
  });

  // 5. WorkoutSession with different performed dates
  it('5. two WorkoutSessions with the same planned_day_number but different performed dates are BOTH preserved', async () => {
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-17', workout_id: 'workout-a', planned_day_number: 1, feeling: 'comfortable',
    });
    // imported session: same planned day, different performed date, different id — represents a distinct attempt
    const payload = makePayload({ workoutSession: [makeSession('imported-session', '2026-08-19', 1)] });

    await performImport(payload, { overwriteUserProfile: false });

    const sessions = await workoutSessionRepo.getByPlannedDay('user-1', 1);
    expect(sessions.length).toBe(2); // never deleted or merged into one
    const dates = sessions.map((s) => s.date).sort();
    expect(dates).toEqual(['2026-08-17', '2026-08-19']);
  });

  // 6. WeeklyReview conflict
  it('6a. WeeklyReview conflict: imported NEWER wins, id preserved, no duplicate week', async () => {
    const local = await weeklyReviewRepo.save({
      user_id: 'user-1', week_number: 1, exercise_completion: '1/2', pain_reported: false,
      coach_summary: 'old', coach_decision: 'KEEP', coach_decision_reason: 'r',
      next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
    });
    const importedNewer = makeReview(1, { coach_summary: 'new', updated_at: futureIso(local.updated_at), id: 'other-id' });
    const payload = makePayload({ weeklyReview: [importedNewer] });

    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.weeklyReviewsUpdated).toBe(1);

    const merged = await weeklyReviewRepo.getByWeek('user-1', 1);
    expect(merged?.coach_summary).toBe('new');
    expect(merged?.id).toBe(local.id); // local id preserved, no duplicate week-1 row

    const count = (await weeklyReviewRepo.getAll('user-1')).length;
    expect(count).toBe(1);
  });

  it('6b. WeeklyReview conflict: imported OLDER is skipped, local preserved untouched', async () => {
    const local = await weeklyReviewRepo.save({
      user_id: 'user-1', week_number: 1, exercise_completion: '2/2', pain_reported: false,
      coach_summary: 'current', coach_decision: 'KEEP', coach_decision_reason: 'r',
      next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
    });
    const importedOlder = makeReview(1, { coach_summary: 'stale', updated_at: '2020-01-01T00:00:00.000Z' });
    const payload = makePayload({ weeklyReview: [importedOlder] });

    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.weeklyReviewsSkipped).toBe(1);

    const merged = await weeklyReviewRepo.getByWeek('user-1', 1);
    expect(merged?.coach_summary).toBe('current');
    expect(merged?.id).toBe(local.id);
  });

  // 7. User profile protection
  it('7a. local user profile is NOT overwritten by default when a conflict exists', async () => {
    await userRepo.create({
      name: 'Local Name', age: 26, gender: 'male', height_cm: 165, starting_weight_kg: 66,
      target_weight_kg: 62, baseline_steps: 6300, program_start_date: '2026-08-17',
    });
    const payload = makePayload({ user: [makeUser({ name: 'Imported Name' })] });

    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.userProfileImported).toBe(false);

    const current = await userRepo.getCurrentUser();
    expect(current?.name).toBe('Local Name');
  });

  it('7b. explicit overwriteUserProfile=true replaces the local profile', async () => {
    const localUser = await userRepo.create({
      name: 'Local Name', age: 26, gender: 'male', height_cm: 165, starting_weight_kg: 66,
      target_weight_kg: 62, baseline_steps: 6300, program_start_date: '2026-08-17',
    });
    const payload = makePayload({ user: [makeUser({ name: 'Imported Name' })] });

    const result = await performImport(payload, { overwriteUserProfile: true });
    expect(result.userProfileImported).toBe(true);

    const current = await userRepo.getCurrentUser();
    expect(current?.name).toBe('Imported Name');
    expect(current?.id).toBe(localUser.id); // id preserved, not duplicated
    const userCount = await db.user.count();
    expect(userCount).toBe(1);
  });

  it('buildImportSummary correctly flags userProfileConflict without writing anything', async () => {
    await userRepo.create({
      name: 'Local Name', age: 26, gender: 'male', height_cm: 165, starting_weight_kg: 66,
      target_weight_kg: 62, baseline_steps: 6300, program_start_date: '2026-08-17',
    });
    const payload = makePayload({ user: [makeUser()] });
    const summary = await buildImportSummary(payload);
    expect(summary.userProfileConflict).toBe(true);
    // must not have written anything
    const count = await db.user.count();
    expect(count).toBe(1);
  });

  // 8. Invalid backup file
  it('8. an invalid file (fails validateBackupFile) never reaches performImport', () => {
    const result = validateBackupFile({ not: 'a backup' });
    expect(result.valid).toBe(false);
  });

  // 9. Wrong schema version
  it('9. importing a file with a newer schema_version than supported throws and writes nothing', async () => {
    const payload = makePayload({ schema_version: CURRENT_SCHEMA_VERSION + 1, dailyLog: [makeDailyLog('2026-08-17')] });
    await expect(performImport(payload, { overwriteUserProfile: false })).rejects.toThrow(BackupImportError);
    const count = await db.dailyLog.count();
    expect(count).toBe(0);
  });

  // 10. Migration failure rollback (simulated failure mid-import)
  it('10. if a write fails partway through, the entire import is rolled back — no partial data', async () => {
    await dailyLogRepo.save('user-1', '2026-08-10', { steps: 1111 }); // pre-existing baseline record

    const payload = makePayload({
      dailyLog: [makeDailyLog('2026-08-17'), makeDailyLog('2026-08-18')],
      weeklyReview: [makeReview(1)],
    });

    // Force a failure on the second dailyLog write to simulate a mid-import crash
    let putCount = 0;
    const originalPut = db.dailyLog.put.bind(db.dailyLog);
    db.dailyLog.put = (async (item: unknown) => {
      putCount += 1;
      if (putCount === 2) throw new Error('simulated failure mid-import');
      return originalPut(item as never);
    }) as typeof db.dailyLog.put;

    try {
      await expect(performImport(payload, { overwriteUserProfile: false })).rejects.toThrow();
    } finally {
      db.dailyLog.put = originalPut;
    }

    // Rollback must undo EVERYTHING from this import, including the weeklyReview write
    // that happened in the same transaction, and must not touch the pre-existing record.
    const dailyLogCount = await db.dailyLog.count();
    expect(dailyLogCount).toBe(1); // only the pre-existing baseline record remains
    const preExisting = await dailyLogRepo.getByDate('user-1', '2026-08-10');
    expect(preExisting?.steps).toBe(1111);
    const reviewCount = await db.weeklyReview.count();
    expect(reviewCount).toBe(0);
  });

  // 11. Large but valid backup
  it('11. a large but valid backup (100+ records) imports completely and correctly', async () => {
    const logs = Array.from({ length: 120 }, (_, i) => makeDailyLog(dateOffset(i)));
    const payload = makePayload({ dailyLog: logs });
    const result = await performImport(payload, { overwriteUserProfile: false });
    expect(result.dailyLogsAdded).toBe(120);
    const count = await db.dailyLog.count();
    expect(count).toBe(120);
  });

  // 12. Import cancellation
  it('12. selecting/validating a file writes nothing until performImport is explicitly called (cancellation = no-op)', async () => {
    const payload = makePayload({ dailyLog: [makeDailyLog('2026-08-17')] });
    // Simulate the "select + validate + preview" steps without ever confirming
    const validation = validateBackupFile(payload);
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      await buildImportSummary(validation.payload); // read-only preview
    }
    // "Cancel" = never calling performImport
    const count = await db.dailyLog.count();
    expect(count).toBe(0);
  });

  // 13. Data remains intact after "app restart" (simulated by closing and reopening the db)
  it('13. imported data remains intact after the database connection is closed and reopened', async () => {
    const payload = makePayload({ dailyLog: [makeDailyLog('2026-08-17')] });
    await performImport(payload, { overwriteUserProfile: false });

    db.close();
    await db.open();

    const log = await dailyLogRepo.getByDate('user-1', '2026-08-17');
    expect(log?.steps).toBe(6800);
  });
});

// ---------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------
function makePayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  const user = overrides.user ?? [];
  const dailyLog = overrides.dailyLog ?? [];
  const workoutSession = overrides.workoutSession ?? [];
  const weeklyReview = overrides.weeklyReview ?? [];
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    app_version: '0.7.0-phase7',
    exported_at: '2026-08-24T00:00:00.000Z',
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
    ...overrides,
  };
}

function makeDailyLog(date: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `log-${date}-${Math.random().toString(36).slice(2)}`,
    user_id: 'user-1',
    date,
    water_ml: 2000,
    sitting_breaks: 2,
    exercise_completed: false,
    lunch_walk_done: false,
    shoulder_relax_done: false,
    stretch_done: false,
    steps: 6800,
    updated_at: '2026-08-17T09:00:00.000Z',
    ...overrides,
  };
}

function makeSession(id: string, date: string, planned_day_number: number) {
  return {
    id,
    user_id: 'user-1',
    date,
    workout_id: 'workout-a',
    planned_day_number,
    completed: true,
    created_at: `${date}T19:00:00.000Z`,
  };
}

function makeReview(week_number: number, overrides: Record<string, unknown> = {}): WeeklyReview {
  return {
    id: `review-${week_number}-${Math.random().toString(36).slice(2)}`,
    user_id: 'user-1',
    week_number,
    exercise_completion: '2/2',
    pain_reported: false,
    coach_summary: 's',
    coach_decision: 'KEEP',
    coach_decision_reason: 'r',
    next_week_goal_1: 'a',
    next_week_goal_2: 'b',
    next_week_goal_3: 'c',
    created_at: '2026-08-23T21:00:00.000Z',
    updated_at: '2026-08-23T21:00:00.000Z',
    ...overrides,
  } as WeeklyReview;
}

function makeUser(overrides: Record<string, unknown> = {}): User {
  return {
    id: 'imported-user-id',
    name: 'Imported User',
    age: 26,
    gender: 'male',
    height_cm: 165,
    starting_weight_kg: 66,
    target_weight_kg: 62,
    baseline_steps: 6300,
    program_start_date: '2026-08-17',
    created_at: '2026-08-17T06:00:00.000Z',
    ...overrides,
  } as User;
}

function futureIso(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + 10);
  return d.toISOString();
}

function dateOffset(days: number): string {
  const d = new Date('2026-01-01');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
