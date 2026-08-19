// =========================================================
// Day Detail Page — Phase 4
// 点击 Plan 页面某一天，进入这里看完整安排
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { userRepo } from '../repositories/userRepo';
import { workoutRepo } from '../repositories/workoutRepo';
import { getDayPlanByNumber } from '../services/planEngine';
import { computeDayNumber, todayDateString } from '../services/dateEngine';
import { ExerciseCard } from '../components/ExerciseCard';
import { SafetyBanner } from '../components/SafetyBanner';
import { copy } from '../i18n';
import type { DayPlan, User, Workout } from '../types';

const c = copy.dayPlan;

const DAY_TYPE_LABEL: Record<DayPlan['day_type'], string> = {
  workout: c.workoutDay,
  recovery: c.recovery,
  rest: c.rest,
  low_impact: c.lowImpact,
  full_review: c.fullReview,
};

export function DayDetailPage() {
  const { dayNumber } = useParams<{ dayNumber: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | undefined>();
  const [workout, setWorkout] = useState<Workout | undefined>();
  const [loading, setLoading] = useState(true);

  const dayPlan = getDayPlanByNumber(Number(dayNumber));

  useEffect(() => {
    userRepo.getCurrentUser().then(setUser);
  }, []);

  useEffect(() => {
    if (!dayPlan?.workout_id) {
      setLoading(false);
      return;
    }
    workoutRepo.getById(dayPlan.workout_id).then((w) => {
      setWorkout(w);
      setLoading(false);
    });
  }, [dayPlan?.workout_id]);

  if (!dayPlan) {
    return (
      <div className="p-4">
        <p>{c.dayNotFound}</p>
        <button onClick={() => navigate('/plan')} className="text-sm text-blue-600 mt-2">
          {c.backToPlan}
        </button>
      </div>
    );
  }

  const isToday = user
    ? computeDayNumber(user.program_start_date, todayDateString()) === dayPlan.day_number
    : false;

  return (
    <div className="pb-8">
      <div className="p-4 pb-2">
        <button onClick={() => navigate('/plan')} className="text-sm text-blue-600">
          {c.backToPlan}
        </button>
        <h1 className="text-xl font-semibold mt-2">
          {dayPlan.weekday_label} {isToday && <span className="text-sm text-blue-600 font-normal">{c.todayTag}</span>}
        </h1>
        <p className="text-sm text-gray-500">{DAY_TYPE_LABEL[dayPlan.day_type]}</p>
      </div>

      {dayPlan.notes && (
        <p className="mx-4 text-sm text-gray-600 bg-gray-50 border rounded-lg p-3">{dayPlan.notes}</p>
      )}

      {/* Rest / Recovery 天：明确传达"这也是计划的一部分"，不是被跳过的一天 */}
      {(dayPlan.day_type === 'rest' || dayPlan.day_type === 'recovery') && (
        <div className="mx-4 mt-3 rounded-lg border border-green-100 bg-green-50 p-3">
          <p className="text-sm text-green-900 font-medium">
            {dayPlan.day_type === 'rest' ? c.restBanner : c.recoveryBanner}
          </p>
          <p className="text-xs text-green-800 mt-1">{c.restRecoverySubtext}</p>
        </div>
      )}

      {dayPlan.day_type === 'low_impact' && (
        <div className="mx-4 mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-sm text-blue-900">{c.lowImpactDesc}</p>
        </div>
      )}

      {dayPlan.day_type === 'full_review' && (
        <div className="mx-4 mt-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
          <p className="text-sm text-purple-900">{c.fullReviewHint}</p>
        </div>
      )}

      {/* Workout day: Safety banner + Warm-up → Exercises → Cool-down */}
      {dayPlan.day_type === 'workout' && (
        <>
          <SafetyBanner />
          {loading && <p className="p-4 text-gray-400 text-sm">{c.loadingWorkout}</p>}
          {!loading && workout && (
            <div className="px-4 mt-3">
              <p className="text-sm text-gray-500 mb-3">
                {workout.name} · {workout.duration_min_range[0]}–{workout.duration_min_range[1]} 分钟
              </p>
              <ExerciseCard step={workout.warmup} />
              {workout.exercises.map((ex) => (
                <ExerciseCard key={ex.id} step={ex} />
              ))}
              <ExerciseCard step={workout.cooldown} />
              <p className="text-xs text-gray-500 mt-2 mb-2">{workout.safety_notes}</p>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600 mb-4">
                {c.readyToStart}
                <br />
                {c.readyToStartSub}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
