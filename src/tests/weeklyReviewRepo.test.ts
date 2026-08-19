import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { weeklyReviewRepo } from '../repositories/weeklyReviewRepo';

describe('weeklyReviewRepo', () => {
  afterEach(async () => {
    await db.weeklyReview.clear();
  });

  it('upserts by [user_id+week_number] — regenerating a review never creates a duplicate', async () => {
    await weeklyReviewRepo.save({
      user_id: 'user-1',
      week_number: 1,
      exercise_completion: '1/2',
      pain_reported: false,
      coach_summary: 'first draft',
      coach_decision: 'KEEP',
      coach_decision_reason: 'first draft reason',
      next_week_goal_1: 'a',
      next_week_goal_2: 'b',
      next_week_goal_3: 'c',
    });

    await weeklyReviewRepo.save({
      user_id: 'user-1',
      week_number: 1,
      exercise_completion: '2/2',
      pain_reported: false,
      coach_summary: 'regenerated after more data came in',
      coach_decision: 'KEEP',
      coach_decision_reason: 'updated reason',
      next_week_goal_1: 'a',
      next_week_goal_2: 'b',
      next_week_goal_3: 'c',
    });

    const all = await db.weeklyReview.where('[user_id+week_number]').equals(['user-1', 1]).toArray();
    expect(all.length).toBe(1);
    expect(all[0].exercise_completion).toBe('2/2');
    expect(all[0].coach_summary).toBe('regenerated after more data came in');
  });

  it('different weeks for the same user do not collide', async () => {
    await weeklyReviewRepo.save({
      user_id: 'user-1', week_number: 1, exercise_completion: '2/2', pain_reported: false,
      coach_summary: 's', coach_decision: 'KEEP', coach_decision_reason: 'r',
      next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
    });
    await weeklyReviewRepo.save({
      user_id: 'user-1', week_number: 2, exercise_completion: '2/2', pain_reported: false,
      coach_summary: 's', coach_decision: 'PROGRESS', coach_decision_reason: 'r',
      next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
    });

    const all = await weeklyReviewRepo.getAll('user-1');
    expect(all.length).toBe(2);
  });
});
