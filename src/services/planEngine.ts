// =========================================================
// Plan Engine — Service 层（Phase 3 更新）
// UI 层（Today / Plan 页面）应该只调用这里的函数，
// 不直接 import plan14day.seed.ts / goalEngine.ts / dateEngine.ts
// =========================================================
import { getDayPlan, plan14Day } from '../data/plan14day.seed';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { computeDailyGoalStatus, groupGoalStatus, summarizeGoalCompletion } from './goalEngine';
import { computeDayNumber, isProgramComplete, yesterdayOf } from './dateEngine';
import type { DailyGoalStatus, DayPlan } from '../types';

export interface TodayGoalsView {
  dayPlan: DayPlan;
  dayNumber: number;
  isProgramComplete: boolean;
  required: DailyGoalStatus[];
  supplementary: DailyGoalStatus[];
  summary: { completed: number; total: number };
  /** 决策 1：昨天没有记录时的非阻塞提示，不代表"失败" */
  yesterdayMissing: boolean;
  yesterdayDate?: string;
}

/**
 * 给 Today 页面用：只需要 user_id + program_start_date + 今天日期，
 * dayNumber 完全由日历推算，不依赖用户是否每天打开 App。
 */
export async function getTodayGoalsView(
  user_id: string,
  program_start_date: string,
  todayStr: string,
): Promise<TodayGoalsView | undefined> {
  const dayNumber = computeDayNumber(program_start_date, todayStr);
  const dayPlan = getDayPlan(dayNumber);
  if (!dayPlan) return undefined;

  const log = await dailyLogRepo.getByDate(user_id, todayStr);
  const statuses = computeDailyGoalStatus(dayPlan, log);
  const { countable, supplementary } = groupGoalStatus(statuses);
  const summary = summarizeGoalCompletion(statuses);

  // 只有 Day 2 之后才检查"昨天"，Day 1 没有"昨天"这个概念
  let yesterdayMissing = false;
  let yesterdayDate: string | undefined;
  if (dayNumber > 1) {
    yesterdayDate = yesterdayOf(todayStr);
    const yesterdayLog = await dailyLogRepo.getByDate(user_id, yesterdayDate);
    yesterdayMissing = !yesterdayLog;
  }

  return {
    dayPlan,
    dayNumber,
    isProgramComplete: isProgramComplete(program_start_date, todayStr),
    required: countable,
    supplementary,
    summary,
    yesterdayMissing,
    yesterdayDate,
  };
}

export function getPlanOverview(): DayPlan[] {
  return plan14Day;
}

export function getDayPlanByNumber(dayNumber: number): DayPlan | undefined {
  return getDayPlan(dayNumber);
}
