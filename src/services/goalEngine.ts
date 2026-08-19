// =========================================================
// Daily Goal Status Engine — Phase 2
// schema v2：改用独立 boolean 字段，不再解析 notes 文本
// =========================================================
import type { DailyGoalStatus, DailyLog, DayPlan, GoalRequirement, ProgressState } from '../types';
// 注：本文件是纯函数业务逻辑（不碰数据库），归类为 Service 层。

/** 有"渐进式状态"的数量型目标（不是"完成/失败"的二元判定） */
const PROGRESSIVE_KEYS = new Set(['steps', 'water', 'sitting_breaks']);

/**
 * 核心规则（对应用户第 4 项调整）：
 * - not_applicable → 从列表中过滤掉，UI 永远看不到
 * - required / target → 计入 "X / Y completed" 分母
 * - recommended / optional → 显示在单独区块，不影响完成分数
 *
 * Phase 3 追加规则：数量型目标（steps/water/sitting_breaks）不显示"失败"，
 * 用 not_started / in_progress / almost_there / completed 四级渐进状态展示，
 * 完成分数计算仍然只看 completed 这个布尔值（达标与否），
 * 渐进状态只影响 UI 文案，不改变分母/分子的计算方式。
 *
 * 理念：Consistency > Perfection。分数是给 Coach 做分析用的，
 * 不是考试及格线，用户不该因为差一点点而感觉"失败"。
 */
export function computeDailyGoalStatus(
  dayPlan: DayPlan,
  log: DailyLog | undefined,
): DailyGoalStatus[] {
  return dayPlan.goals
    .filter((g) => g.requirement !== 'not_applicable')
    .map((g) => {
      const completed = isGoalCompleted(g.key, dayPlan, log);
      if (!PROGRESSIVE_KEYS.has(g.key)) {
        return { ...g, completed };
      }
      const current = currentValueFor(g.key, log);
      const target = numericTarget(dayPlan, g.key, currentDefaultTarget(g.key));
      return {
        ...g,
        completed,
        current_value: current,
        progress_state: computeProgressState(current, target),
      };
    });
}

function currentValueFor(key: string, log: DailyLog | undefined): number {
  if (!log) return 0;
  switch (key) {
    case 'steps':
      return log.steps ?? 0;
    case 'water':
      return log.water_ml ?? 0;
    case 'sitting_breaks':
      return log.sitting_breaks ?? 0;
    default:
      return 0;
  }
}

function currentDefaultTarget(key: string): number {
  switch (key) {
    case 'steps':
      return 6500;
    case 'water':
      return 2000;
    case 'sitting_breaks':
      return 3;
    default:
      return 0;
  }
}

/**
 * 渐进状态判定，不产生"失败"这种二元负面标签。
 * - 0 或未记录 → not_started
 * - < 70% → in_progress
 * - < 100% → almost_there
 * - >= 100% → completed
 */
export function computeProgressState(current: number, target: number): ProgressState {
  if (target <= 0) return current > 0 ? 'completed' : 'not_started';
  const ratio = current / target;
  if (current <= 0) return 'not_started';
  if (ratio < 0.7) return 'in_progress';
  if (ratio < 1) return 'almost_there';
  return 'completed';
}

function isGoalCompleted(
  key: string,
  dayPlan: DayPlan,
  log: DailyLog | undefined,
): boolean {
  if (!log) return false;

  switch (key) {
    case 'workout':
      return log.exercise_completed && log.exercise_type === dayPlan.workout_id?.replace('-', '_');
    case 'lunch_walk':
      return log.lunch_walk_done === true;
    case 'shoulder_neck_relax':
      return log.shoulder_relax_done === true;
    case 'stretch':
      return log.stretch_done === true;
    case 'sitting_breaks': {
      const target = numericTarget(dayPlan, 'sitting_breaks', 3);
      return (log.sitting_breaks ?? 0) >= target;
    }
    case 'steps': {
      const target = numericTarget(dayPlan, 'steps', 6500);
      return (log.steps ?? 0) >= target;
    }
    case 'water': {
      const target = numericTarget(dayPlan, 'water', 2000);
      return (log.water_ml ?? 0) >= target;
    }
    case 'low_impact_activity':
      return log.exercise_type === 'low_impact_activity';
    case 'weekly_review':
      return false; // 由 WeeklyReview 表是否已生成来判断，不看 DailyLog
    default:
      return false;
  }
}

function numericTarget(dayPlan: DayPlan, key: string, fallback: number): number {
  const raw = dayPlan.goals.find((g) => g.key === key)?.target_value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** 分组：required+target 进分母；recommended+optional 单独展示，不计分 */
export interface GroupedGoalStatus {
  countable: DailyGoalStatus[];     // required + target
  supplementary: DailyGoalStatus[]; // recommended + optional
}

const COUNTABLE: GoalRequirement[] = ['required', 'target'];

export function groupGoalStatus(statuses: DailyGoalStatus[]): GroupedGoalStatus {
  return {
    countable: statuses.filter((s) => COUNTABLE.includes(s.requirement)),
    supplementary: statuses.filter((s) => !COUNTABLE.includes(s.requirement)),
  };
}

/** Today 页面顶部 "3 / 4 completed" 的汇总，只统计 required + target */
export function summarizeGoalCompletion(statuses: DailyGoalStatus[]): {
  completed: number;
  total: number;
} {
  const { countable } = groupGoalStatus(statuses);
  return {
    completed: countable.filter((s) => s.completed).length,
    total: countable.length,
  };
}
