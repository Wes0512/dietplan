import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { computeMovementProgress } from '../services/progressEngine';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { dailyLogRepo } from '../repositories/dailyLogRepo';

const PROGRAM_START = '2026-08-17'; // Day 1 = Monday

describe('computeMovementProgress — workout consistency counts make-up sessions correctly', () => {
  afterEach(async () => {
    await db.workoutSession.clear();
    await db.dailyLog.clear();
  });

  it('counts a workout as completed even if performed late, via planned_day_number', async () => {
    // Day 1 (Workout A) done on time
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-17', workout_id: 'workout-a', planned_day_number: 1, feeling: 'comfortable',
    });
    // Day 4 (Workout B) made up late, on Day 6's date
    await workoutSessionRepo.completeWorkout({
      user_id: 'user-1', date: '2026-08-22', workout_id: 'workout-b', planned_day_number: 4, feeling: 'tired',
    });

    // "today" is Day 6 -> two workout days planned so far (Day 1, Day 4), both completed
    const result = await computeMovementProgress('user-1', PROGRAM_START, 6, []);
    expect(result.workout_required).toBe(2);
    expect(result.workout_completed).toBe(2);
    expect(result.workout_consistency).toBe('on_track');
  });

  it('does not count a workout planned for a future day, even if today is close', async () => {
    // "today" is Day 1 -> only Day 1's workout is required so far
    const result = await computeMovementProgress('user-1', PROGRAM_START, 1, []);
    expect(result.workout_required).toBe(1);
    expect(result.workout_completed).toBe(0);
  });

  it('counts low_impact activity completion by calendar date (Day 6 / Day 13)', async () => {
    await dailyLogRepo.save('user-1', '2026-08-22', { exercise_type: 'low_impact_activity' }); // Day 6's date
    const result = await computeMovementProgress('user-1', PROGRAM_START, 6, []);
    expect(result.low_impact_planned).toBe(1);
    expect(result.low_impact_completed).toBe(1);
  });

  it('computes average steps from provided logs', async () => {
    const logs = [
      { id: '1', user_id: 'u', date: '2026-08-17', steps: 6000, water_ml: 0, sitting_breaks: 0, exercise_completed: false, lunch_walk_done: false, shoulder_relax_done: false, stretch_done: false, updated_at: '' },
      { id: '2', user_id: 'u', date: '2026-08-18', steps: 7000, water_ml: 0, sitting_breaks: 0, exercise_completed: false, lunch_walk_done: false, shoulder_relax_done: false, stretch_done: false, updated_at: '' },
    ];
    const result = await computeMovementProgress('user-1', PROGRAM_START, 2, logs);
    expect(result.avg_steps).toBe(6500);
  });
});
