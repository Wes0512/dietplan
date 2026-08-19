import { describe, expect, it } from 'vitest';
import { computeSleepDurationMin, validateSleepDuration } from '../services/sleepValidation';

describe('computeSleepDurationMin', () => {
  it('handles a normal same-night sleep window', () => {
    expect(computeSleepDurationMin('00:30', '06:30')).toBe(360); // 6h
  });

  it('handles crossing midnight correctly', () => {
    expect(computeSleepDurationMin('23:00', '06:00')).toBe(420); // 7h
  });

  it('never silently modifies the raw times — duration is a pure derivation, not a correction', () => {
    // 12:30am to 1:00am — start after end within the same clock face, treated as crossing midnight
    expect(computeSleepDurationMin('00:30', '01:00')).toBe(30);
  });
});

describe('validateSleepDuration — data quality gate (Decision 1)', () => {
  it('returns ok for durations at or under 12 hours', () => {
    expect(validateSleepDuration(6 * 60).status).toBe('ok');
    expect(validateSleepDuration(12 * 60).status).toBe('ok');
  });

  it('returns needs_confirmation for durations between 12 and 16 hours', () => {
    expect(validateSleepDuration(12 * 60 + 1).status).toBe('needs_confirmation');
    expect(validateSleepDuration(14 * 60).status).toBe('needs_confirmation');
    expect(validateSleepDuration(16 * 60).status).toBe('needs_confirmation');
  });

  it('returns too_long for durations over 16 hours and blocks direct save', () => {
    expect(validateSleepDuration(16 * 60 + 1).status).toBe('too_long');
    expect(validateSleepDuration(20 * 60).status).toBe('too_long');
  });
});
