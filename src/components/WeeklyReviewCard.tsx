// =========================================================
// WeeklyReviewCard — Phase 6
// 展示 Weekly Review 的五个要素：
// 这周做得不错 / 值得关注 / 教练决定 / 为什么 / 下周重点
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { CoachDecisionBadge } from './CoachDecisionBadge';
import { copy } from '../i18n';
import type { WeeklyHighlights } from '../services/coachEngine';
import type { WeeklyReview } from '../types';

interface WeeklyReviewCardProps {
  review: WeeklyReview;
  highlights: WeeklyHighlights;
}

export function WeeklyReviewCard({ review, highlights }: WeeklyReviewCardProps) {
  const c = copy.weeklyReview;
  return (
    <div className="border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{c.title(review.week_number)}</h3>
        <CoachDecisionBadge decision={review.coach_decision} />
      </div>

      {highlights.wentWell.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.wentWell}</p>
          <ul className="mt-1 list-disc list-inside text-sm space-y-0.5 text-gray-700">
            {highlights.wentWell.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {highlights.needsAttention.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.needsAttention}</p>
          <ul className="mt-1 list-disc list-inside text-sm space-y-0.5 text-gray-700">
            {highlights.needsAttention.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.reason}</p>
        <p className="text-sm text-gray-700 mt-1">{review.coach_decision_reason}</p>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.nextWeek}</p>
        <ol className="mt-1 list-decimal list-inside text-sm space-y-0.5 text-gray-700">
          <li>{review.next_week_goal_1}</li>
          <li>{review.next_week_goal_2}</li>
          <li>{review.next_week_goal_3}</li>
        </ol>
      </div>
    </div>
  );
}
