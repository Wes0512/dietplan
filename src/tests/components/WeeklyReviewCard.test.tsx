// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WeeklyReviewCard } from '../../components/WeeklyReviewCard';
import type { WeeklyReview } from '../../types';

afterEach(cleanup);

const review: WeeklyReview = {
  id: 'r1', user_id: 'u1', week_number: 1,
  average_steps: 6420, average_sleep_min: 375, average_energy: 2.8,
  exercise_completion: '2/2', pain_reported: false,
  coach_summary: 's', coach_decision: 'KEEP', coach_decision_reason: '训练完成率良好，但睡眠还需要改善。',
  next_week_goal_1: '维持训练量不变', next_week_goal_2: '提前 15 分钟上床', next_week_goal_3: '继续记录',
  created_at: '2026-08-23T21:00:00.000Z', updated_at: '2026-08-23T21:00:00.000Z',
};

describe('WeeklyReviewCard — five-element rendering (Phase 9 §11)', () => {
  it('renders decision badge, went well, needs attention, reason, and next week goals', () => {
    render(
      <WeeklyReviewCard
        review={review}
        highlights={{ wentWell: ['训练 2/2 已完成'], needsAttention: ['平均睡眠：6 小时 15 分钟'] }}
      />,
    );

    expect(screen.getByText('第 1 周复盘')).toBeInTheDocument();
    expect(screen.getByText('维持')).toBeInTheDocument(); // KEEP badge in Chinese
    expect(screen.getByText('训练 2/2 已完成')).toBeInTheDocument();
    expect(screen.getByText('平均睡眠：6 小时 15 分钟')).toBeInTheDocument();
    expect(screen.getByText('训练完成率良好，但睡眠还需要改善。')).toBeInTheDocument();
    expect(screen.getByText('维持训练量不变')).toBeInTheDocument();
    expect(screen.getByText('提前 15 分钟上床')).toBeInTheDocument();
    expect(screen.getByText('继续记录')).toBeInTheDocument();
  });

  it('never simultaneously claims "no discomfort" while also listing discomfort in needsAttention', () => {
    render(
      <WeeklyReviewCard
        review={{ ...review, coach_decision: 'ADJUST' }}
        highlights={{ wentWell: [], needsAttention: ['这周有记录到一些身体不适'] }}
      />,
    );
    expect(screen.getByText('调整')).toBeInTheDocument();
    expect(screen.getByText('这周有记录到一些身体不适')).toBeInTheDocument();
    expect(screen.queryByText(/没有记录到身体不适/)).not.toBeInTheDocument();
  });
});
