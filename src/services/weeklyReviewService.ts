// =========================================================
// Weekly Review Service — Phase 6
// 汇总数据 → 调用 coachEngine 生成决策 → 存入 weeklyReviewRepo
// =========================================================
import { plan14Day } from '../data/plan14day.seed';
import { dayNumberToDate } from './dateEngine';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { weeklyReviewRepo } from '../repositories/weeklyReviewRepo';
import { computeWeekStats } from './statsEngine';
import {
  generateCoachDecision,
  buildWeeklyReviewPatch,
  deriveWeeklyHighlights,
  type PreviousWeekSnapshot,
  type WeeklyHighlights,
} from './coachEngine';
import type { WeeklyReview } from '../types';

/** 本 App 目前只实现 14 天 = Phase 1（Week 1-2），Week 2 结束是唯一的阶段边界。
 *  未来若扩展到 Phase 2/3/4，在这里追加对应的边界周即可（只增不改）。 */
const PHASE_BOUNDARY_WEEKS = new Set([2]);

/** 某一周是否已经"到期"，可以生成 Weekly Review（该周最后一天已经过去或就是今天） */
export function isWeekEligibleForReview(week_number: number, todayDayNumber: number): boolean {
  const lastDay = week_number * 7;
  return todayDayNumber >= lastDay;
}

/**
 * 生成（或重新生成）某一周的 Weekly Review 并存入数据库。
 * 重新生成是 upsert（weeklyReviewRepo.save 内部按 [user_id+week_number] 更新），
 * 不会产生重复记录。
 */
export async function generateWeeklyReview(
  user_id: string,
  program_start_date: string,
  week_number: number,
): Promise<WeeklyReview> {
  const daysInWeek = plan14Day.filter((d) => Math.ceil(d.day_number / 7) === week_number);
  const startDate = dayNumberToDate(program_start_date, daysInWeek[0].day_number);
  const endDate = dayNumberToDate(program_start_date, daysInWeek[daysInWeek.length - 1].day_number);

  const logs = await dailyLogRepo.getRange(user_id, startDate, endDate);

  const workoutDays = daysInWeek.filter((d) => d.day_type === 'workout');
  const sessionsArrays = await Promise.all(
    workoutDays.map((d) => workoutSessionRepo.getByPlannedDay(user_id, d.day_number)),
  );
  const sessions = sessionsArrays.flat();

  const stats = computeWeekStats(logs, sessions, workoutDays.length);

  const previousReview = week_number > 1 ? await weeklyReviewRepo.getByWeek(user_id, week_number - 1) : undefined;
  const previous: PreviousWeekSnapshot | undefined = previousReview
    ? {
      average_steps: previousReview.average_steps,
      average_sleep_min: previousReview.average_sleep_min,
      average_energy: previousReview.average_energy,
      exercise_completion: previousReview.exercise_completion,
    }
    : undefined;

  const decision = generateCoachDecision({
    week_number,
    stats,
    logs,
    is_phase_boundary: PHASE_BOUNDARY_WEEKS.has(week_number),
    required_workout_count: workoutDays.length,
    previous,
  });

  const patch = buildWeeklyReviewPatch(week_number, stats, decision);
  return weeklyReviewRepo.save({ user_id, ...patch });
}

export interface WeeklyReviewView {
  review: WeeklyReview;
  highlights: WeeklyHighlights;
}

/** 读取某一周已生成的 Review，附带派生的 highlights（不需要额外存储） */
export async function getWeeklyReviewWithHighlights(
  user_id: string,
  week_number: number,
): Promise<WeeklyReviewView | undefined> {
  const review = await weeklyReviewRepo.getByWeek(user_id, week_number);
  if (!review) return undefined;
  const previous = week_number > 1 ? await weeklyReviewRepo.getByWeek(user_id, week_number - 1) : undefined;
  const highlights = deriveWeeklyHighlights(review, previous);
  return { review, highlights };
}
