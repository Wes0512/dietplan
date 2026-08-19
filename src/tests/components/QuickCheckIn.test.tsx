// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickCheckIn } from '../../components/QuickCheckIn';
import { db } from '../../db/schema';
import { dailyLogRepo } from '../../repositories/dailyLogRepo';
import { seedWorkouts } from '../../data/workouts.seed';
import type { DailyLog } from '../../types';

const USER_ID = 'user-1';
const DATE = '2026-08-17';

beforeEach(async () => {
  await db.workout.bulkPut(seedWorkouts);
});

afterEach(async () => {
  cleanup();
  await db.dailyLog.clear();
  await db.workoutSession.clear();
  await db.workout.clear();
});

function Wrapper({ log, onChange }: { log: DailyLog | undefined; onChange: (l: DailyLog) => void }) {
  return (
    <QuickCheckIn
      user_id={USER_ID}
      date={DATE}
      plannedDayNumber={1}
      log={log}
      requiredWorkout={seedWorkouts[0]}
      onChange={onChange}
    />
  );
}

describe('QuickCheckIn — Weight save (Phase 9 §8)', () => {
  it('opening Weight, entering a value, and blurring persists it to DailyLog', async () => {
    const user = userEvent.setup();
    let currentLog: DailyLog | undefined;
    const { rerender } = render(<Wrapper log={currentLog} onChange={(l) => { currentLog = l; }} />);

    await user.click(screen.getByText('体重'));
    const input = screen.getByPlaceholderText('kg');
    await user.type(input, '65.8');
    await user.tab(); // blur

    await waitFor(async () => {
      const stored = await dailyLogRepo.getByDate(USER_ID, DATE);
      expect(stored?.weight_kg).toBe(65.8);
    });

    rerender(<Wrapper log={currentLog} onChange={(l) => { currentLog = l; }} />);
    expect(await screen.findByText('65.8 kg')).toBeInTheDocument();
  });
});

describe('QuickCheckIn — Water quick-add (Phase 9 §8)', () => {
  it('tapping +250 ml twice accumulates to 500 ml, not overwrite', async () => {
    const user = userEvent.setup();
    let currentLog: DailyLog | undefined;
    const onChange = (l: DailyLog) => { currentLog = l; };
    const { rerender } = render(<Wrapper log={currentLog} onChange={onChange} />);

    await user.click(screen.getByText('饮水'));
    await user.click(screen.getByText('+250 ml'));
    await waitFor(() => expect(currentLog?.water_ml).toBe(250));

    rerender(<Wrapper log={currentLog} onChange={onChange} />);
    await user.click(screen.getByText('+250 ml'));
    await waitFor(() => expect(currentLog?.water_ml).toBe(500));

    const stored = await dailyLogRepo.getByDate(USER_ID, DATE);
    expect(stored?.water_ml).toBe(500);
  });
});

describe('QuickCheckIn — Workout completion writes DailyLog + WorkoutSession together (Phase 9 §3, §7)', () => {
  it('completing "训练 A" with a feeling updates both DailyLog.exercise_completed and creates a WorkoutSession', async () => {
    const user = userEvent.setup();
    let currentLog: DailyLog | undefined;
    render(<Wrapper log={currentLog} onChange={(l) => { currentLog = l; }} />);

    // Workout section is open by default (defaultOpen)
    await user.click(screen.getByRole('button', { name: '完成训练' }));
    await user.click(screen.getByRole('button', { name: '还算轻松' }));

    await waitFor(async () => {
      const log = await dailyLogRepo.getByDate(USER_ID, DATE);
      expect(log?.exercise_completed).toBe(true);
      expect(log?.exercise_type).toBe('workout_a');
    });

    const sessions = await db.workoutSession.where('user_id').equals(USER_ID).toArray();
    expect(sessions.length).toBe(1);
    expect(sessions[0].workout_id).toBe('workout-a');
    expect(sessions[0].planned_day_number).toBe(1);
    expect(sessions[0].feeling).toBe('comfortable');
  });

  it('selecting "不太舒服" reveals pain area selection, and confirming saves pain_area on both records', async () => {
    const user = userEvent.setup();
    render(<Wrapper log={undefined} onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: '完成训练' }));
    await user.click(screen.getByRole('button', { name: '不太舒服' }));

    expect(screen.getByText('哪个部位？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '腰部' }));
    await user.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(async () => {
      const log = await dailyLogRepo.getByDate(USER_ID, DATE);
      expect(log?.pain_area).toContain('lower_back');
    });

    const sessions = await db.workoutSession.where('user_id').equals(USER_ID).toArray();
    expect(sessions[0].pain_area).toContain('lower_back');
  });
});
