import { describe, expect, it } from 'vitest';
import { computeDayNumber, dayNumberToDate, isProgramComplete, yesterdayOf } from '../services/dateEngine';

describe('dateEngine — natural calendar progression (Decision 1)', () => {
  it('Day 1 when today equals start_date', () => {
    expect(computeDayNumber('2026-08-17', '2026-08-17')).toBe(1);
  });

  it('advances by calendar days even if the user skipped opening the app', () => {
    // start Monday, "today" is Wednesday (2 days later) — user never opened Tuesday
    expect(computeDayNumber('2026-08-17', '2026-08-19')).toBe(3);
  });

  it('does not freeze — a full week gap still advances the day number correctly', () => {
    expect(computeDayNumber('2026-08-17', '2026-08-24')).toBe(8);
  });

  it('clamps at 14 once the 14-day plan window has passed', () => {
    expect(computeDayNumber('2026-08-17', '2026-09-10')).toBe(14);
    expect(isProgramComplete('2026-08-17', '2026-09-10')).toBe(true);
  });

  it('is not complete on exactly day 14', () => {
    // day14 = start + 13 days
    expect(isProgramComplete('2026-08-17', '2026-08-30')).toBe(false);
    expect(computeDayNumber('2026-08-17', '2026-08-30')).toBe(14);
  });

  it('yesterdayOf correctly handles month boundaries', () => {
    expect(yesterdayOf('2026-09-01')).toBe('2026-08-31');
  });

  it('dayNumberToDate correctly reverses computeDayNumber', () => {
    expect(dayNumberToDate('2026-08-17', 1)).toBe('2026-08-17');
    expect(dayNumberToDate('2026-08-17', 4)).toBe('2026-08-20');
    expect(dayNumberToDate('2026-08-17', 14)).toBe('2026-08-30');
  });
});
