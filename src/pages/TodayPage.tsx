// =========================================================
// Today Page — Phase 3 完整实作
// 需求点 1–19 全部覆盖，见 PHASE3_REPORT.md 逐条对照
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userRepo } from '../repositories/userRepo';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { workoutRepo } from '../repositories/workoutRepo';
import { getTodayGoalsView, type TodayGoalsView } from '../services/planEngine';
import { todayDateString } from '../services/dateEngine';
import { OnboardingForm } from '../components/OnboardingForm';
import { YesterdayPrompt } from '../components/YesterdayPrompt';
import { GoalList } from '../components/GoalList';
import { QuickCheckIn } from '../components/QuickCheckIn';
import { copy } from '../i18n';
import type { DailyLog, User, Workout } from '../types';

export function TodayPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | undefined | null>(null); // null = loading, undefined = no user
  const [activeDate, setActiveDate] = useState(todayDateString()); // 支持"补昨天"时临时切换
  const [view, setView] = useState<TodayGoalsView | undefined>();
  const [log, setLog] = useState<DailyLog | undefined>();
  const [workout, setWorkout] = useState<Workout | undefined>();
  const [dismissedYesterdayPrompt, setDismissedYesterdayPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const c = copy.today;

  // 加载用户
  useEffect(() => {
    userRepo.getCurrentUser().then(setUser);
  }, []);

  // 加载当天（或补记的那天）的目标视图 + DailyLog + Workout 详情
  useEffect(() => {
    if (!user) {
      // 没有登录用户（首次使用，还没完成 Onboarding）：
      // 明确结束 loading 状态，避免卡在"加载中…"——上面的渲染逻辑
      // 会在 user 为 undefined 时转去显示 OnboardingForm。
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const goalsView = await getTodayGoalsView(user.id, user.program_start_date, activeDate);
      const dayLog = await dailyLogRepo.getByDate(user.id, activeDate);
      const workoutForDay = goalsView?.dayPlan.workout_id
        ? await workoutRepo.getById(goalsView.dayPlan.workout_id)
        : undefined;

      if (!cancelled) {
        setView(goalsView);
        setLog(dayLog);
        setWorkout(workoutForDay);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, activeDate]);

  if (user === null) {
    return <div className="p-4 text-center text-gray-400 mt-20">{copy.common.loading}</div>;
  }

  // ---- 19. Empty state：第一次使用 ----
  if (!user) {
    return <OnboardingForm onComplete={setUser} />;
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400 mt-20">{copy.common.loading}</div>;
  }

  if (!view) {
    return <div className="p-4">{c.noPlanFound}</div>;
  }

  const isFillingYesterday = activeDate !== todayDateString();
  const greeting = getGreeting();

  return (
    <div className="pb-8">
      {/* 1. Today / Day X header */}
      <div className="p-4 pb-2">
        <h1 className="text-xl font-semibold">
          {isFillingYesterday ? c.fillingIn(activeDate) : `${greeting}，${user.name.split(' ')[0]}`}
        </h1>
        <p className="text-sm text-gray-500">
          {c.dayLabel(view.dayNumber, view.dayPlan.week_number)}
        </p>
      </div>

      {/* 18. Yesterday missing-log prompt（非阻塞，Skip 不代表失败） */}
      {!isFillingYesterday && view.yesterdayMissing && !dismissedYesterdayPrompt && view.yesterdayDate && (
        <YesterdayPrompt
          yesterdayDate={view.yesterdayDate}
          onFillYesterday={() => setActiveDate(view.yesterdayDate!)}
          onSkip={() => setDismissedYesterdayPrompt(true)}
        />
      )}
      {isFillingYesterday && (
        <div className="mx-4 mt-2">
          <button
            onClick={() => setActiveDate(todayDateString())}
            className="text-sm text-blue-600"
          >
            {c.backToToday}
          </button>
        </div>
      )}

      {/* 2 + 3. Required goals + progressive target progress */}
      <div className="px-4 mt-3">
        <p className="text-sm text-gray-500">
          {c.requiredGoalsTitle(view.summary.completed, view.summary.total)}
        </p>
        <div className="mt-2 border rounded-lg px-3">
          <GoalList goals={view.required} />
        </div>

        {view.supplementary.length > 0 && (
          <>
            <p className="text-xs text-gray-400 mt-4 mb-1">{c.recommendedTitle}</p>
            <div className="border rounded-lg px-3">
              <GoalList goals={view.supplementary} muted />
            </div>
          </>
        )}
      </div>

      {/* 4–17. Quick Check-in */}
      <div className="px-0 mt-2">
        <p className="px-4 text-xs text-gray-400 mt-4 mb-1">{c.quickCheckIn}</p>
        <QuickCheckIn
          user_id={user.id}
          date={activeDate}
          plannedDayNumber={view.dayPlan.day_number}
          log={log}
          requiredWorkout={workout}
          onChange={setLog}
        />
      </div>

      {/* Phase 7：数据备份入口，藏在角落，不占用底部导航 */}
      <div className="px-4 mt-6">
        <button onClick={() => navigate('/backup')} className="text-xs text-gray-400">
          {copy.backup.title} →
        </button>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return copy.today.greetingMorning;
  if (hour < 18) return copy.today.greetingAfternoon;
  return copy.today.greetingEvening;
}
