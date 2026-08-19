import { describe, expect, it } from 'vitest';
import {
  checkSchemaCompatibility,
  isImportedNewer,
  normalizeDailyLog,
  normalizeUser,
  normalizeWeeklyReview,
  normalizeWorkoutSession,
  validateBackupFile,
  type BackupPayload,
} from '../services/backupValidation';
import { CURRENT_SCHEMA_VERSION } from '../db/schema';
import type { DailyLog, User, WeeklyReview, WorkoutSession } from '../types';

function validPayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    app_version: '0.7.0-phase7',
    exported_at: '2026-08-24T00:00:00.000Z',
    record_counts: { user: 0, dailyLog: 0, workoutSession: 0, weeklyReview: 0 },
    user: [],
    dailyLog: [],
    workoutSession: [],
    weeklyReview: [],
    ...overrides,
  };
}

describe('validateBackupFile — structural validation', () => {
  it('rejects non-object input', () => {
    expect(validateBackupFile(null).valid).toBe(false);
    expect(validateBackupFile('a string').valid).toBe(false);
    expect(validateBackupFile(42).valid).toBe(false);
  });

  it('accepts a well-formed empty backup', () => {
    const result = validateBackupFile(validPayload());
    expect(result.valid).toBe(true);
  });

  it('rejects when schema_version is missing or not a positive integer', () => {
    const p = validPayload() as unknown as Record<string, unknown>;
    delete p.schema_version;
    expect(validateBackupFile(p).valid).toBe(false);

    expect(validateBackupFile({ ...validPayload(), schema_version: -1 }).valid).toBe(false);
    expect(validateBackupFile({ ...validPayload(), schema_version: 1.5 }).valid).toBe(false);
  });

  it('rejects when record_counts do not match actual array lengths (corrupted file)', () => {
    const p = validPayload({
      dailyLog: [makeDailyLog()],
      record_counts: { user: 0, dailyLog: 0, workoutSession: 0, weeklyReview: 0 }, // says 0 but array has 1
    });
    const result = validateBackupFile(p);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/记录数量摘要/);
  });

  it('rejects a dailyLog entry missing required fields', () => {
    const badLog = { id: 'x' }; // missing user_id/date/etc
    const p = validPayload({
      dailyLog: [badLog as unknown as DailyLog],
      record_counts: { user: 0, dailyLog: 1, workoutSession: 0, weeklyReview: 0 },
    });
    expect(validateBackupFile(p).valid).toBe(false);
  });

  it('accepts a weeklyReview missing updated_at (older export) — normalize fills it in later', () => {
    const review = makeWeeklyReview();
    delete (review as Partial<WeeklyReview>).updated_at;
    const p = validPayload({
      weeklyReview: [review],
      record_counts: { user: 0, dailyLog: 0, workoutSession: 0, weeklyReview: 1 },
    });
    expect(validateBackupFile(p).valid).toBe(true);
  });
});

describe('checkSchemaCompatibility', () => {
  it('current version is compatible_current', () => {
    expect(checkSchemaCompatibility(CURRENT_SCHEMA_VERSION)).toBe('compatible_current');
  });
  it('older version is compatible_older', () => {
    expect(checkSchemaCompatibility(CURRENT_SCHEMA_VERSION - 1)).toBe('compatible_older');
  });
  it('newer version is incompatible_newer — must never be opened destructively', () => {
    expect(checkSchemaCompatibility(CURRENT_SCHEMA_VERSION + 1)).toBe('incompatible_newer');
  });
});

describe('isImportedNewer', () => {
  it('imported wins when its timestamp is later', () => {
    expect(isImportedNewer('2026-08-20T10:00:00Z', '2026-08-19T10:00:00Z')).toBe(true);
  });
  it('local wins when imported is older', () => {
    expect(isImportedNewer('2026-08-18T10:00:00Z', '2026-08-19T10:00:00Z')).toBe(false);
  });
  it('local wins on a tie (never overwrite for equal timestamps)', () => {
    expect(isImportedNewer('2026-08-19T10:00:00Z', '2026-08-19T10:00:00Z')).toBe(false);
  });
  it('falls back safely when a timestamp fails to parse', () => {
    expect(isImportedNewer('not-a-date', '2026-08-19T10:00:00Z')).toBe(false);
    expect(isImportedNewer('2026-08-19T10:00:00Z', 'not-a-date')).toBe(true);
  });
});

describe('normalize* — additive-only field backfill', () => {
  it('normalizeDailyLog backfills missing boolean fields to false without touching others', () => {
    const raw = makeDailyLog();
    delete (raw as Partial<DailyLog>).lunch_walk_done;
    delete (raw as Partial<DailyLog>).shoulder_relax_done;
    delete (raw as Partial<DailyLog>).stretch_done;
    const normalized = normalizeDailyLog(raw);
    expect(normalized.lunch_walk_done).toBe(false);
    expect(normalized.shoulder_relax_done).toBe(false);
    expect(normalized.stretch_done).toBe(false);
    expect(normalized.water_ml).toBe(raw.water_ml);
  });

  it('normalizeWeeklyReview backfills updated_at from created_at when missing', () => {
    const raw = makeWeeklyReview();
    delete (raw as Partial<WeeklyReview>).updated_at;
    const normalized = normalizeWeeklyReview(raw);
    expect(normalized.updated_at).toBe(raw.created_at);
  });

  it('normalizeUser backfills program_start_date from created_at when missing', () => {
    const raw = makeUser();
    delete (raw as Partial<User>).program_start_date;
    const normalized = normalizeUser(raw);
    expect(normalized.program_start_date).toBe(raw.created_at.slice(0, 10));
  });

  it('normalizeWorkoutSession leaves planned_day_number untouched when already present', () => {
    const raw = makeWorkoutSession({ planned_day_number: 3 });
    const normalized = normalizeWorkoutSession(raw, '2026-08-17');
    expect(normalized.planned_day_number).toBe(3);
  });

  it('normalizeWorkoutSession does not guess planned_day_number without a program_start_date', () => {
    const raw = makeWorkoutSession({ planned_day_number: undefined });
    const normalized = normalizeWorkoutSession(raw, undefined);
    expect(normalized.planned_day_number).toBeUndefined();
  });
});

// ---------------------------------------------------------
// Fixtures
// ---------------------------------------------------------
function makeDailyLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: 'log-1', user_id: 'user-1', date: '2026-08-17', water_ml: 1500, sitting_breaks: 2,
    exercise_completed: false, lunch_walk_done: true, shoulder_relax_done: false, stretch_done: false,
    updated_at: '2026-08-17T09:00:00.000Z',
    ...overrides,
  };
}

function makeWeeklyReview(overrides: Partial<WeeklyReview> = {}): WeeklyReview {
  return {
    id: 'review-1', user_id: 'user-1', week_number: 1, exercise_completion: '2/2', pain_reported: false,
    coach_summary: 's', coach_decision: 'KEEP', coach_decision_reason: 'r',
    next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
    created_at: '2026-08-23T21:00:00.000Z', updated_at: '2026-08-23T21:00:00.000Z',
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1', name: 'Test', age: 26, gender: 'male', height_cm: 165,
    starting_weight_kg: 66, target_weight_kg: 62, baseline_steps: 6300,
    program_start_date: '2026-08-17', created_at: '2026-08-17T06:00:00.000Z',
    ...overrides,
  };
}

function makeWorkoutSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1', user_id: 'user-1', date: '2026-08-17', workout_id: 'workout-a',
    completed: true, created_at: '2026-08-17T19:00:00.000Z',
    ...overrides,
  };
}
