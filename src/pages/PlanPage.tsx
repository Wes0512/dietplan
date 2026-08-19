// =========================================================
// Plan Page — Phase 4
// PLAN 回答的是"接下来 14 天我要去哪"，TODAY 回答"我今天要做什么"，
// 两者刻意分开，Plan 页面不重复 Today 页面的逐项打卡细节。
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userRepo } from '../repositories/userRepo';
import { getPlanDayViews, type PlanDayView, type PlanDayVisualState } from '../services/planStatusEngine';
import { computeDayNumber, todayDateString } from '../services/dateEngine';
import { copy } from '../i18n';
import type { User } from '../types';

const c = copy.plan;

const STATE_LABEL: Record<PlanDayVisualState, string> = {
  today: c.statusToday,
  completed: c.statusCompleted,
  upcoming: c.statusUpcoming,
  rest: c.statusRest,
  recovery: c.statusRecovery,
};

const STATE_STYLE: Record<PlanDayVisualState, string> = {
  today: 'bg-blue-600 text-white',
  completed: 'bg-green-100 text-green-800',
  upcoming: 'bg-gray-100 text-gray-500',
  rest: 'bg-gray-50 text-gray-500',
  recovery: 'bg-amber-50 text-amber-700',
};

const DAY_TYPE_TITLE: Record<PlanDayView['dayPlan']['day_type'], string> = {
  workout: '', // 用 workout 名称，见下方渲染逻辑
  recovery: copy.dayPlan.recovery,
  rest: copy.dayPlan.rest,
  low_impact: copy.dayPlan.lowImpact,
  full_review: copy.dayPlan.fullReview,
};

export function PlanPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | undefined>();
  const [views, setViews] = useState<PlanDayView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userRepo.getCurrentUser().then((u) => setUser(u ?? undefined));
  }, []);

  useEffect(() => {
    if (!user) return;
    const todayDayNumber = computeDayNumber(user.program_start_date, todayDateString());
    getPlanDayViews(user.id, user.program_start_date, todayDayNumber).then((v) => {
      setViews(v);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return <div className="p-4 text-gray-400 text-sm">{c.needsProfile}</div>;
  }
  if (loading) {
    return <div className="p-4 text-gray-400 text-sm">{copy.common.loading}</div>;
  }

  const week1 = views.filter((v) => v.dayPlan.week_number === 1);
  const week2 = views.filter((v) => v.dayPlan.week_number === 2);

  return (
    <div className="pb-8">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{c.subtitle}</p>
      </div>

      <div className="mx-4 mt-2 rounded-lg border border-green-100 bg-green-50 p-3">
        <p className="text-sm text-green-900">{c.restBanner}</p>
        <p className="text-xs text-green-800 mt-1">{c.restBannerSub}</p>
      </div>

      {[{ label: c.week(1), days: week1 }, { label: c.week(2), days: week2 }].map((week) => (
        <div key={week.label} className="mt-5">
          <h2 className="px-4 text-sm font-medium text-gray-500">{week.label}</h2>
          <div className="mt-2 divide-y border-t border-b">
            {week.days.map((v) => (
              <button
                key={v.dayPlan.day_number}
                onClick={() => navigate(`/plan/day/${v.dayPlan.day_number}`)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <div className="text-sm font-medium">{v.dayPlan.weekday_label}</div>
                  <div className="text-xs text-gray-500">{dayTitle(v)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${STATE_STYLE[v.state]}`}>
                  {STATE_LABEL[v.state]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function dayTitle(v: PlanDayView): string {
  if (v.dayPlan.day_type === 'workout') {
    return v.dayPlan.workout_id === 'workout-a' ? c.workoutA : c.workoutB;
  }
  return DAY_TYPE_TITLE[v.dayPlan.day_type];
}
