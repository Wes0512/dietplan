// =========================================================
// Progress Page — Phase 5
// 核心问题："我是不是正在变得更好？"
// 不是塞满图表的仪表盘，而是有解读的四个板块。
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useEffect, useState } from 'react';
import { userRepo } from '../repositories/userRepo';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { todayDateString, computeDayNumber } from '../services/dateEngine';
import {
  computeBodyProgress,
  computeMovementProgress,
  computeRecoveryProgress,
  computeHabitsProgress,
  generateCoachInsight,
  type BodyProgress,
  type MovementProgress,
  type RecoveryProgress,
  type HabitsProgress,
} from '../services/progressEngine';
import { MiniLineChart } from '../components/MiniLineChart';
import { DailyDetailsList } from '../components/DailyDetailsList';
import { ConsistencyBadge } from '../components/ConsistencyBadge';
import { copy } from '../i18n';
import type { DailyLog, User } from '../types';

const c = copy.progress;

interface ProgressData {
  body: BodyProgress;
  movement: MovementProgress;
  recovery: RecoveryProgress;
  habits: HabitsProgress;
  daysLogged: number;
  logs: DailyLog[];
}

export function ProgressPage() {
  const [user, setUser] = useState<User | undefined>();
  const [data, setData] = useState<ProgressData | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userRepo.getCurrentUser().then((u) => setUser(u ?? undefined));
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const today = todayDateString();
      const todayDayNumber = computeDayNumber(user.program_start_date, today);
      const logs = await dailyLogRepo.getRange(user.id, user.program_start_date, today);

      const body = computeBodyProgress(user, logs);
      const movement = await computeMovementProgress(user.id, user.program_start_date, todayDayNumber, logs);
      const recovery = computeRecoveryProgress(logs);
      const habits = computeHabitsProgress(logs);

      if (!cancelled) {
        setData({ body, movement, recovery, habits, daysLogged: logs.length, logs });
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return <div className="p-4 text-gray-400 text-sm">{c.setupProfileFirst}</div>;
  }
  if (loading || !data) {
    return <div className="p-4 text-gray-400 text-sm">{copy.common.loading}</div>;
  }

  const { body, movement, recovery, habits, daysLogged } = data;

  const insight = generateCoachInsight({ daysLogged, movement, recovery, habits });

  return (
    <div className="pb-8">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{c.subtitle}</p>
      </div>

      {/* Top summary */}
      <div className="mx-4 rounded-xl border p-4">
        <p className="text-xs text-gray-500">{c.twelveWeekGoal}</p>
        <p className="text-base font-medium">{body.starting_weight_kg} kg → {body.target_weight_kg} kg</p>
        <div className="mt-3 flex justify-between">
          <div>
            <p className="text-xs text-gray-500">{c.currentWeight}</p>
            <p className="text-lg font-semibold">
              {body.current_weight_kg !== undefined ? `${body.current_weight_kg} kg` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{c.change}</p>
            <p className="text-lg font-semibold">
              {body.change_kg !== undefined ? formatChange(body.change_kg) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Coach Insight */}
      <div className="mx-4 mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-900 uppercase tracking-wide">{c.coachInsight}</p>
        {insight ? (
          <p className="text-sm text-blue-900 mt-1">{insight}</p>
        ) : (
          <p className="text-sm text-blue-800 mt-1">{c.insightInsufficientData}</p>
        )}
      </div>

      {/* BODY */}
      <Section title={c.body}>
        <p className="text-sm font-medium mb-2">{c.weightTrendTitle}</p>
        {renderWeightTrend(body)}
        <MiniLineChart
          data={body.weight_points.map((p) => ({ date: p.date, value: p.weight_kg }))}
          unit="kg"
          formatValue={(v) => v.toFixed(1)}
        />
        <DailyDetailsList
          rows={body.weight_points.map((p) => ({ date: p.date, label: `${p.weight_kg} kg` }))}
        />
      </Section>

      {/* MOVEMENT */}
      <Section title={c.movement}>
        <div className="py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{c.averageSteps}</span>
            <span className="text-sm text-gray-600">
              {movement.avg_steps !== undefined ? `${Math.round(movement.avg_steps).toLocaleString()}${c.perDay}` : copy.common.noData}
            </span>
          </div>
          {movement.avg_steps !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">{c.sampleSize(movement.steps_sample_days)}</p>
          )}
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">{c.workout}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{c.sessionsUnit(movement.workout_completed, movement.workout_required)}</span>
            <ConsistencyBadge label={movement.workout_consistency} />
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">{c.lowImpactActivity}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{c.sessionsUnit(movement.low_impact_completed, movement.low_impact_planned)}</span>
            <ConsistencyBadge label={movement.low_impact_consistency} />
          </div>
        </div>
      </Section>

      {/* RECOVERY */}
      <Section title={c.recovery}>
        <div className="py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{c.averageSleep}</span>
            <span className="text-sm text-gray-600">{recovery.avg_sleep_min !== undefined ? formatDuration(recovery.avg_sleep_min) : copy.common.noData}</span>
          </div>
          {recovery.avg_sleep_min !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">{c.sampleSize(recovery.sleep_sample_days)}</p>
          )}
        </div>
        <div className="py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{c.afternoonEnergy}</span>
            <span className="text-sm text-gray-600">{recovery.avg_energy !== undefined ? `${recovery.avg_energy.toFixed(1)} / 5` : copy.common.noData}</span>
          </div>
          {recovery.avg_energy !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">{c.sampleSize(recovery.energy_sample_days)}</p>
          )}
        </div>
        <div className="py-2">
          <span className="text-sm">{c.painDiscomfort}</span>
          {recovery.pain_days_count === 0 ? (
            <p className="text-xs text-gray-500 mt-1">{c.noDiscomfort}</p>
          ) : (
            <p className="text-xs text-blue-700 mt-1">
              {c.discomfortReported(
                recovery.pain_days_count,
                Object.keys(recovery.pain_area_counts).length > 0 ? topPainArea(recovery.pain_area_counts) : undefined,
              )}
            </p>
          )}
        </div>
      </Section>

      {/* HABITS */}
      <Section title={c.habits}>
        <div className="py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{c.averageWater}</span>
            <span className="text-sm text-gray-600">
              {habits.avg_water_ml !== undefined ? `${Math.round(habits.avg_water_ml).toLocaleString()} ml${c.perDay}` : copy.common.noData}
            </span>
          </div>
          {habits.avg_water_ml !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">
              {c.sampleSizeWithTarget(habits.water_sample_days, `${habits.water_target_ml.toLocaleString()} ml`)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">{copy.checkIn.lunchWalk}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {habits.lunch_walk_rate !== undefined ? c.lunchWalkRate(Math.round(habits.lunch_walk_rate * 100)) : copy.common.noData}
            </span>
            <ConsistencyBadge label={habits.lunch_walk_consistency} />
          </div>
        </div>
        <div className="py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{copy.checkIn.sittingBreaks}</span>
            <span className="text-sm text-gray-600">
              {habits.avg_sitting_breaks !== undefined ? c.sittingBreaksAvg(habits.avg_sitting_breaks.toFixed(1), habits.sitting_breaks_target) : copy.common.noData}
            </span>
          </div>
          {habits.avg_sitting_breaks !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">{c.sampleSize(habits.sitting_breaks_sample_days)}</p>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="px-4 text-sm font-semibold text-gray-700">{title}</h2>
      <div className="mx-4 mt-2 border rounded-lg px-3 divide-y">{children}</div>
    </div>
  );
}

function formatChange(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change} kg`;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} 小时 ${m} 分钟`;
}

function topPainArea(counts: Partial<Record<string, number>>): string {
  const entries = Object.entries(counts) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const label: Record<string, string> = {
    lower_back: c.painAreaLowerBack,
    foot: c.painAreaFoot,
    knee: c.painAreaKnee,
    shoulder_neck: c.painAreaShoulderNeck,
    other: c.painAreaOther,
  };
  return label[entries[0][0]] ?? entries[0][0];
}

function renderWeightTrend(body: BodyProgress) {
  const { trend } = body;
  if (trend.status === 'getting_started') {
    return <p className="text-sm text-gray-500 mb-3">{c.weightGettingStarted}</p>;
  }
  if (trend.status === 'early_trend') {
    return <p className="text-sm text-gray-500 mb-3">{c.weightEarlyTrend}</p>;
  }
  const text = trend.direction === 'down'
    ? c.weightTrendDown(trend.recent_avg, trend.earlier_avg)
    : trend.direction === 'up'
      ? c.weightTrendUp(trend.recent_avg, trend.earlier_avg)
      : c.weightTrendFlat(trend.recent_avg);
  return <p className="text-sm text-gray-700 mb-3">{text}</p>;
}
