// =========================================================
// Progress Engine — Service 层（Phase 5）
// 核心问题："Am I actually getting better?"
// 所有计算都是纯函数，方便测试；数据不足时明确说明，不假装有趋势。
// =========================================================
import { plan14Day } from '../data/plan14day.seed';
import { dayNumberToDate } from './dateEngine';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import type { DailyLog, PainArea, User } from '../types';

// ---------------------------------------------------------
// 通用小工具
// ---------------------------------------------------------
function average(nums: number[]): number | undefined {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return undefined;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

export type ConsistencyLabel = 'on_track' | 'building_consistency' | 'worth_improving' | 'no_data';

/** 统一的"一致性"分级文案，绝不使用 Failed/Bad/Poor 等字眼 */
export function classifyConsistency(rate: number | undefined): ConsistencyLabel {
  if (rate === undefined) return 'no_data';
  if (rate >= 0.8) return 'on_track';
  if (rate >= 0.5) return 'building_consistency';
  return 'worth_improving';
}

export const CONSISTENCY_LABELS: readonly ConsistencyLabel[] = ['on_track', 'building_consistency', 'worth_improving', 'no_data'] as const;

// ---------------------------------------------------------
// BODY — 体重
// ---------------------------------------------------------
export interface WeightPoint {
  date: string;
  weight_kg: number;
}

export type WeightTrendState =
  | { status: 'getting_started' }
  | { status: 'early_trend' }
  | { status: 'trend'; direction: 'down' | 'up' | 'flat'; recent_avg: number; earlier_avg: number };

/**
 * 渐进式趋势判定：
 * - < 3 天数据：getting_started（"Getting started — not enough data yet."）
 * - 3–6 天：early_trend（"Early trend — keep observing."）
 * - 7+ 天：用近半段平均 vs 早半段平均比较，而不是看单日波动
 *   （0.2kg 以内视为持平，避免把水分/餐后体重波动误判成趋势）
 */
export function computeWeightTrendState(points: WeightPoint[]): WeightTrendState {
  const count = points.length;
  if (count < 3) return { status: 'getting_started' };
  if (count < 7) return { status: 'early_trend' };

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(sorted.length / 2);
  const earlier = sorted.slice(0, half);
  const recent = sorted.slice(sorted.length - half);
  const earlierAvg = average(earlier.map((p) => p.weight_kg))!;
  const recentAvg = average(recent.map((p) => p.weight_kg))!;
  const diff = recentAvg - earlierAvg;

  let direction: 'down' | 'up' | 'flat' = 'flat';
  if (Math.abs(diff) >= 0.2) direction = diff < 0 ? 'down' : 'up';

  return { status: 'trend', direction, recent_avg: recentAvg, earlier_avg: earlierAvg };
}

export interface BodyProgress {
  starting_weight_kg: number;
  target_weight_kg: number;
  current_weight_kg: number | undefined;
  change_kg: number | undefined;
  weight_points: WeightPoint[];
  trend: WeightTrendState;
}

export function computeBodyProgress(user: User, logs: DailyLog[]): BodyProgress {
  const weight_points = logs
    .filter((l): l is DailyLog & { weight_kg: number } => l.weight_kg !== undefined)
    .map((l) => ({ date: l.date, weight_kg: l.weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const current_weight_kg = weight_points.length > 0 ? weight_points[weight_points.length - 1].weight_kg : undefined;
  const change_kg = current_weight_kg !== undefined
    ? Math.round((current_weight_kg - user.starting_weight_kg) * 10) / 10
    : undefined;

  return {
    starting_weight_kg: user.starting_weight_kg,
    target_weight_kg: user.target_weight_kg,
    current_weight_kg,
    change_kg,
    weight_points,
    trend: computeWeightTrendState(weight_points),
  };
}

// ---------------------------------------------------------
// MOVEMENT — 步数 / 训练 / 推荐活动
// ---------------------------------------------------------
export interface MovementProgress {
  avg_steps: number | undefined;
  steps_sample_days: number;
  steps_target: number;
  workout_completed: number;
  workout_required: number;
  workout_consistency: ConsistencyLabel;
  low_impact_completed: number;
  low_impact_planned: number;
  low_impact_consistency: ConsistencyLabel;
}

export async function computeMovementProgress(
  user_id: string,
  program_start_date: string,
  todayDayNumber: number,
  logs: DailyLog[],
): Promise<MovementProgress> {
  const avg_steps = average(logs.map((l) => l.steps).filter((v): v is number => v !== undefined));
  const steps_sample_days = logs.filter((l) => l.steps !== undefined).length;

  const plannedWorkoutDays = plan14Day.filter((d) => d.day_type === 'workout' && d.day_number <= todayDayNumber);
  const workoutResults = await Promise.all(
    plannedWorkoutDays.map((d) => workoutSessionRepo.getByPlannedDay(user_id, d.day_number)),
  );
  const workout_completed = workoutResults.filter((sessions) => sessions.some((s) => s.completed)).length;
  const workout_required = plannedWorkoutDays.length;

  const lowImpactDays = plan14Day.filter((d) => d.day_type === 'low_impact' && d.day_number <= todayDayNumber);
  let low_impact_completed = 0;
  for (const d of lowImpactDays) {
    const date = dayNumberToDate(program_start_date, d.day_number);
    const log = await dailyLogRepo.getByDate(user_id, date);
    if (log?.exercise_type === 'low_impact_activity') low_impact_completed += 1;
  }

  return {
    avg_steps,
    steps_sample_days,
    steps_target: 6500,
    workout_completed,
    workout_required,
    workout_consistency: classifyConsistency(workout_required > 0 ? workout_completed / workout_required : undefined),
    low_impact_completed,
    low_impact_planned: lowImpactDays.length,
    low_impact_consistency: classifyConsistency(
      lowImpactDays.length > 0 ? low_impact_completed / lowImpactDays.length : undefined,
    ),
  };
}

// ---------------------------------------------------------
// RECOVERY — 睡眠 / 精神 / 疼痛观察
// ---------------------------------------------------------
export interface RecoveryProgress {
  avg_sleep_min: number | undefined;
  sleep_sample_days: number;
  avg_energy: number | undefined;
  energy_sample_days: number;
  pain_days_count: number;
  pain_area_counts: Partial<Record<PainArea, number>>;
  days_logged: number;
}

export function computeRecoveryProgress(logs: DailyLog[]): RecoveryProgress {
  const sleepEntries = logs.filter((l) => l.sleep_duration_min !== undefined);
  const avg_sleep_min = average(sleepEntries.map((l) => l.sleep_duration_min!));
  const energyEntries = logs.filter((l) => l.afternoon_energy !== undefined);
  const avg_energy = average(energyEntries.map((l) => l.afternoon_energy!));

  const painDays = logs.filter((l) => (l.pain_area?.length ?? 0) > 0);
  const pain_area_counts: Partial<Record<PainArea, number>> = {};
  for (const l of painDays) {
    for (const area of l.pain_area ?? []) {
      pain_area_counts[area] = (pain_area_counts[area] ?? 0) + 1;
    }
  }

  return {
    avg_sleep_min,
    sleep_sample_days: sleepEntries.length,
    avg_energy,
    energy_sample_days: energyEntries.length,
    pain_days_count: painDays.length,
    pain_area_counts,
    days_logged: logs.length,
  };
}

// ---------------------------------------------------------
// HABITS — 水分 / 午休走路 / 久坐打断
// ---------------------------------------------------------
export interface HabitsProgress {
  avg_water_ml: number | undefined;
  water_sample_days: number;
  water_target_ml: number;
  lunch_walk_rate: number | undefined; // 0-1
  lunch_walk_consistency: ConsistencyLabel;
  avg_sitting_breaks: number | undefined;
  sitting_breaks_sample_days: number;
  sitting_breaks_target: number;
  days_logged: number;
}

export function computeHabitsProgress(logs: DailyLog[]): HabitsProgress {
  const waterEntries = logs.filter((l) => l.water_ml !== undefined && l.water_ml > 0);
  const avg_water_ml = average(waterEntries.map((l) => l.water_ml));
  const sittingEntries = logs.filter((l) => l.sitting_breaks !== undefined && l.sitting_breaks > 0);
  const avg_sitting_breaks = average(sittingEntries.map((l) => l.sitting_breaks));
  const lunch_walk_rate = logs.length > 0
    ? logs.filter((l) => l.lunch_walk_done).length / logs.length
    : undefined;

  return {
    avg_water_ml,
    water_sample_days: waterEntries.length,
    water_target_ml: 2000,
    lunch_walk_rate,
    lunch_walk_consistency: classifyConsistency(lunch_walk_rate),
    avg_sitting_breaks,
    sitting_breaks_sample_days: sittingEntries.length,
    sitting_breaks_target: 3,
    days_logged: logs.length,
  };
}

// ---------------------------------------------------------
// Coach Insight — 必须基于真实数据，数据不足时明确说明，绝不编造
// ---------------------------------------------------------
export interface CoachInsightInput {
  daysLogged: number;
  movement: MovementProgress;
  recovery: RecoveryProgress;
  habits: HabitsProgress;
}

/**
 * 返回 null 表示"数据不足，不生成 insight"——调用方(UI)此时必须显示
 * 中性的"目前数据还不够"提示，而不是留空或硬造一句话。
 *
 * 用词严格避开"失败/不合格/太差/你做得不够"，
 * 优先使用"进展良好/正在建立规律/值得继续改善/继续观察"。
 */
export function generateCoachInsight(input: CoachInsightInput): string | null {
  if (input.daysLogged < 3) return null;

  // 疼痛始终是最高优先级，优先于其他一切正面/待改进的描述
  if (input.recovery.pain_days_count > 0) {
    return '最近有记录到一些身体不适 —— 这是目前最值得关注的事。动作保持轻柔，下次训练前可以先看一下安全提醒。';
  }

  type Area = { name: string; label: ConsistencyLabel };
  const areas: Area[] = [];

  if (input.movement.workout_required > 0) {
    areas.push({ name: '训练规律性', label: input.movement.workout_consistency });
  }
  if (input.recovery.avg_sleep_min !== undefined) {
    const sleepLabel: ConsistencyLabel = input.recovery.avg_sleep_min >= 360
      ? 'on_track'
      : input.recovery.avg_sleep_min >= 300
        ? 'building_consistency'
        : 'worth_improving';
    areas.push({ name: '睡眠', label: sleepLabel });
  }
  if (input.movement.avg_steps !== undefined) {
    const ratio = input.movement.avg_steps / input.movement.steps_target;
    areas.push({ name: '步数', label: classifyConsistency(ratio) });
  }

  if (areas.length === 0) return null;

  const positives = areas.filter((a) => a.label === 'on_track').map((a) => a.name);
  const opportunities = areas.filter((a) => a.label === 'worth_improving' || a.label === 'building_consistency');

  const sentences: string[] = [];
  if (positives.length > 0) {
    sentences.push(`你的${joinNatural(positives)}进展良好。`);
  }
  if (opportunities.length > 0) {
    // 挑一个最值得关注的（worth_improving 优先于 building_consistency）
    const top = opportunities.find((a) => a.label === 'worth_improving') ?? opportunities[0];
    sentences.push(`${top.name}目前是比较值得留意的地方。`);
  }

  if (sentences.length === 0) {
    return '各方面都在稳步建立规律 —— 继续观察身体的反应就好。';
  }

  return sentences.join('');
}

function joinNatural(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`;
}

