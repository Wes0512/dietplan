// =========================================================
// Coach Page — Phase 6
// Coach 回答的问题："根据这一周发生的事情，接下来该怎么做？"
// （不是 Progress 页面回答的"我是不是在变好" —— 两者刻意不重复）
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useEffect, useState } from 'react';
import { userRepo } from '../repositories/userRepo';
import { todayDateString, computeDayNumber } from '../services/dateEngine';
import {
  generateWeeklyReview,
  getWeeklyReviewWithHighlights,
  isWeekEligibleForReview,
  type WeeklyReviewView,
} from '../services/weeklyReviewService';
import { SafetyBanner } from '../components/SafetyBanner';
import { WeeklyReviewCard } from '../components/WeeklyReviewCard';
import { copy } from '../i18n';
import type { User } from '../types';

const TOTAL_WEEKS = 2; // 本 App 目前实现 14 天 = 2 周（第一阶段：身体重启）
const c = copy.coach;

export function CoachPage() {
  const [user, setUser] = useState<User | undefined>();
  const [todayDayNumber, setTodayDayNumber] = useState<number>(1);
  const [reviews, setReviews] = useState<Record<number, WeeklyReviewView | undefined>>({});
  const [generating, setGenerating] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userRepo.getCurrentUser().then((u) => setUser(u ?? undefined));
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const today = todayDateString();
      const dayNumber = computeDayNumber(user.program_start_date, today);

      const results: Record<number, WeeklyReviewView | undefined> = {};
      for (let week = 1; week <= TOTAL_WEEKS; week += 1) {
        results[week] = await getWeeklyReviewWithHighlights(user.id, week);
      }

      if (!cancelled) {
        setTodayDayNumber(dayNumber);
        setReviews(results);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleGenerate(week: number) {
    if (!user) return;
    setGenerating(week);
    await generateWeeklyReview(user.id, user.program_start_date, week);
    const result = await getWeeklyReviewWithHighlights(user.id, week);
    setReviews((prev) => ({ ...prev, [week]: result }));
    setGenerating(undefined);
  }

  if (!user) {
    return <div className="p-4 text-gray-400 text-sm">{c.setupProfileFirst}</div>;
  }
  if (loading) {
    return <div className="p-4 text-gray-400 text-sm">{copy.common.loading}</div>;
  }

  const currentWeek = Math.min(TOTAL_WEEKS, Math.ceil(todayDayNumber / 7));
  const latestAvailableReview = reviews[currentWeek - 1] ?? reviews[currentWeek];

  return (
    <div className="pb-8">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{c.subtitle}</p>
      </div>

      <div className="mx-4 rounded-lg border p-3">
        <p className="text-xs text-gray-500">{c.currentPhase}</p>
        <p className="text-sm font-medium">{c.phase1Week(currentWeek)}</p>
      </div>

      {latestAvailableReview && (
        <div className="mx-4 mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-900 uppercase tracking-wide">{c.thisWeekFocus}</p>
          <ul className="mt-1 list-disc list-inside text-sm text-blue-900 space-y-0.5">
            <li>{latestAvailableReview.review.next_week_goal_1}</li>
            <li>{latestAvailableReview.review.next_week_goal_2}</li>
            <li>{latestAvailableReview.review.next_week_goal_3}</li>
          </ul>
        </div>
      )}

      <SafetyBanner />

      <div className="mt-5">
        <h2 className="px-4 text-sm font-semibold text-gray-700">{c.weeklyReviewsTitle}</h2>
        <div className="mx-4 mt-2 space-y-3">
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((week) => {
            const view = reviews[week];
            if (view) {
              return <WeeklyReviewCard key={week} review={view.review} highlights={view.highlights} />;
            }

            const eligible = isWeekEligibleForReview(week, todayDayNumber);
            const lastDay = week * 7;

            return (
              <div key={week} className="border rounded-lg p-3">
                <p className="text-sm font-medium">{c.weekReviewLabel(week)}</p>
                {eligible ? (
                  <>
                    <p className="text-xs text-gray-500 mt-1">{c.readyToGenerate}</p>
                    <button
                      onClick={() => handleGenerate(week)}
                      disabled={generating === week}
                      className="mt-2 rounded-md bg-black text-white text-sm px-4 py-2 disabled:opacity-50"
                    >
                      {generating === week ? c.generating : c.generateButton(week)}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">{c.availableFrom(lastDay)}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
