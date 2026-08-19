// =========================================================
// Plan Status Engine — Service 层（Phase 4）
// 计算 14 天里每一天在 Plan 页面上该显示的视觉状态。
// 硬性规则：Rest / Recovery 天永远不会被标记为 "Failed"，
// 过去没完成的训练日也不用负面标签，只是"没有完成徽章"而已。
// =========================================================
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { weeklyReviewRepo } from '../repositories/weeklyReviewRepo';
import { plan14Day } from '../data/plan14day.seed';
import type { DayPlan } from '../types';

export type PlanDayVisualState = 'today' | 'completed' | 'upcoming' | 'rest' | 'recovery';

export interface PlanDayView {
  dayPlan: DayPlan;
  state: PlanDayVisualState;
  /** 这一天对应的真实日历日期，Plan 页面点进详情页时会用到 */
  date: string;
}

/**
 * 给 Plan 页面用：program_start_date 用来把 day_number 换算成真实日期，
 * todayDayNumber 由 dateEngine.computeDayNumber() 算好后传进来。
 */
export async function getPlanDayViews(
  user_id: string,
  program_start_date: string,
  todayDayNumber: number,
): Promise<PlanDayView[]> {
  const start = parseDateOnly(program_start_date);
  const views: PlanDayView[] = [];

  for (const dayPlan of plan14Day) {
    const date = addDays(start, dayPlan.day_number - 1);
    const state = await computeDayState(user_id, dayPlan, todayDayNumber, date);
    views.push({ dayPlan, state, date });
  }

  return views;
}

async function computeDayState(
  user_id: string,
  dayPlan: DayPlan,
  todayDayNumber: number,
  dateStr: string,
): Promise<PlanDayVisualState> {
  // Rest / Recovery 类型天，视觉状态恒定，不随日期或完成情况变化——
  // 它们本来就"不需要完成什么"，标成 Today/Upcoming 反而会造成误导
  // （用户可能以为 Rest 天也要打卡）。day_type 优先于日期判断。
  if (dayPlan.day_type === 'rest') return 'rest';
  if (dayPlan.day_type === 'recovery') return 'recovery';

  if (dayPlan.day_number === todayDayNumber) return 'today';
  if (dayPlan.day_number > todayDayNumber) return 'upcoming';

  // 过去的 workout / low_impact / full_review 天：检查是否有完成记录。
  // 没完成也不返回任何"失败"状态——直接归为 upcoming 的视觉呈现
  // （即"未强调完成"，UI 层不加绿色徽章即可，不引入额外的负面状态值）。
  const completed = await isPastActionDayCompleted(user_id, dayPlan, dateStr);
  return completed ? 'completed' : 'upcoming';
}

async function isPastActionDayCompleted(user_id: string, dayPlan: DayPlan, dateStr: string): Promise<boolean> {
  if (dayPlan.day_type === 'workout' && dayPlan.workout_id) {
    // 决策 4：按 planned_day_number 查询，支持补做——用户不需要在
    // "原计划日期"当天才能让这一天显示为已完成。
    const sessions = await workoutSessionRepo.getByPlannedDay(user_id, dayPlan.day_number);
    return sessions.some((s) => s.completed && s.workout_id === dayPlan.workout_id);
  }
  if (dayPlan.day_type === 'low_impact') {
    const log = await dailyLogRepo.getByDate(user_id, dateStr);
    return log?.exercise_type === 'low_impact_activity';
  }
  if (dayPlan.day_type === 'full_review') {
    const review = await weeklyReviewRepo.getByWeek(user_id, dayPlan.week_number);
    return review !== undefined;
  }
  return false;
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
