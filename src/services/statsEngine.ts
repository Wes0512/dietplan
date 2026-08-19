// =========================================================
// Stats Engine — Service 层
// 只做"按需计算"，不在每次写入时触发，
// 由 Progress / Coach 页面在打开时调用。
// =========================================================
import type { DailyLog, WorkoutSession } from '../types';

export interface WeekStats {
  average_weight_kg?: number;
  average_steps?: number;
  average_water_ml?: number;
  average_sleep_min?: number;
  average_energy?: number;
  exercise_completion: string; // '2/2'
  pain_reported: boolean;
}

function average(nums: number[]): number | undefined {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return undefined;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

/**
 * 计算一周的统计数据。
 * @param logs 该周 7 天的 DailyLog（可能不足 7 条，缺的天数不计入平均）
 * @param sessions 该周的 WorkoutSession 记录
 * @param requiredWorkoutCount 该周计划要求完成的训练次数（如 Week1 = 2）
 */
export function computeWeekStats(
  logs: DailyLog[],
  sessions: WorkoutSession[],
  requiredWorkoutCount: number,
): WeekStats {
  const completedWorkouts = sessions.filter((s) => s.completed).length;
  const painReported = logs.some((l) => (l.pain_area?.length ?? 0) > 0)
    || sessions.some((s) => (s.pain_area?.length ?? 0) > 0);

  return {
    average_weight_kg: average(logs.map((l) => l.weight_kg).filter((v): v is number => v !== undefined)),
    average_steps: average(logs.map((l) => l.steps).filter((v): v is number => v !== undefined)),
    average_water_ml: average(logs.map((l) => l.water_ml)),
    average_sleep_min: average(logs.map((l) => l.sleep_duration_min).filter((v): v is number => v !== undefined)),
    average_energy: average(
      logs.map((l) => l.afternoon_energy).filter((v): v is 1 | 2 | 3 | 4 | 5 => v !== undefined),
    ),
    exercise_completion: `${completedWorkouts}/${requiredWorkoutCount}`,
    pain_reported: painReported,
  };
}

/** 体重趋势用：不因单日波动判定"失败"，用简单线性趋势（首尾均值比较） */
export function computeWeightTrend(logs: DailyLog[]): 'down' | 'up' | 'flat' | 'insufficient_data' {
  const weights = logs
    .filter((l): l is DailyLog & { weight_kg: number } => l.weight_kg !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (weights.length < 3) return 'insufficient_data';

  const firstHalf = weights.slice(0, Math.ceil(weights.length / 2));
  const secondHalf = weights.slice(Math.floor(weights.length / 2));
  const firstAvg = average(firstHalf.map((w) => w.weight_kg)) ?? 0;
  const secondAvg = average(secondHalf.map((w) => w.weight_kg)) ?? 0;

  const diff = secondAvg - firstAvg;
  if (Math.abs(diff) < 0.2) return 'flat'; // 0.2kg 以内视为持平，避免单日波动误判
  return diff < 0 ? 'down' : 'up';
}
