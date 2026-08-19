// =========================================================
// 14-Day Plan Seed Data — Phase 1
// 调整点 #3 + #4：每日目标区分 required / target / recommended /
// optional / not_applicable，Rest day 绝不出现 "Workout incomplete"
// =========================================================
import type { DailyGoalDefinition, DayPlan } from '../types';

// ---- 可复用的目标模板（不同天引用不同 requirement） ----

const stepsGoal = (): DailyGoalDefinition => ({
  key: 'steps',
  label: '步数 ~6,500–7,000',
  requirement: 'target',
  target_value: 6500,
});

const waterGoal = (): DailyGoalDefinition => ({
  key: 'water',
  label: '饮水 ~2,000 ml',
  requirement: 'target',
  target_value: 2000,
});

const sittingBreaksGoal = (requirement: DailyGoalDefinition['requirement']): DailyGoalDefinition => ({
  key: 'sitting_breaks',
  label: '久坐休息（至少站起来 3 次）',
  requirement,
  target_value: 3,
});

const workoutGoal = (
  workoutName: string,
  requirement: DailyGoalDefinition['requirement'],
): DailyGoalDefinition => ({
  key: 'workout',
  label: workoutName,
  requirement,
});

const lunchWalkGoal = (requirement: DailyGoalDefinition['requirement']): DailyGoalDefinition => ({
  key: 'lunch_walk',
  label: '午餐后散步 ~10 分钟',
  requirement,
});

const shoulderRelaxGoal = (requirement: DailyGoalDefinition['requirement']): DailyGoalDefinition => ({
  key: 'shoulder_neck_relax',
  label: '肩颈放松 3–5 分钟',
  requirement,
});

const lowImpactGoal = (): DailyGoalDefinition => ({
  key: 'low_impact_activity',
  label: '20–30 分钟低冲击活动',
  requirement: 'recommended',
  target_value: '20-30 min',
});

const optionalStretchGoal = (): DailyGoalDefinition => ({
  key: 'stretch',
  label: '额外伸展 5 分钟（可选）',
  requirement: 'optional',
});

const weeklyReviewGoal = (label: string): DailyGoalDefinition => ({
  key: 'weekly_review',
  label,
  requirement: 'required',
});

// ---------------------------------------------------------
// Week 1
// ---------------------------------------------------------
const week1: DayPlan[] = [
  {
    day_number: 1,
    week_number: 1,
    day_type: 'workout',
    workout_id: 'workout-a',
    goals: [
      workoutGoal('训练 A', 'required'),
      lunchWalkGoal('recommended'),
      waterGoal(),
      stepsGoal(),
      sittingBreaksGoal('recommended'),
    ],
  },
  {
    day_number: 2,
    week_number: 1,
    day_type: 'recovery',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      lunchWalkGoal('required'),
      shoulderRelaxGoal('required'),
      waterGoal(),
      stepsGoal(),
    ],
    notes: '不需要正式训练，重点是午餐后走 10 分钟 + 肩颈放松。',
  },
  {
    day_number: 3,
    week_number: 1,
    day_type: 'rest',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      sittingBreaksGoal('required'),
      waterGoal(),
      stepsGoal(),
    ],
    notes: 'Rest / Movement Break：工作中至少 3 次站起来，正常通勤步行即可。',
  },
  {
    day_number: 4,
    week_number: 1,
    day_type: 'workout',
    workout_id: 'workout-b',
    goals: [
      workoutGoal('训练 B', 'required'),
      lunchWalkGoal('recommended'),
      waterGoal(),
      stepsGoal(),
      sittingBreaksGoal('recommended'),
    ],
  },
  {
    day_number: 5,
    week_number: 1,
    day_type: 'recovery',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      optionalStretchGoal(),
      waterGoal(),
      stepsGoal(),
    ],
    notes: '正常走路，可选 5 分钟轻松伸展。',
  },
  {
    day_number: 6,
    week_number: 1,
    day_type: 'low_impact',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      lowImpactGoal(),
      waterGoal(),
      stepsGoal(),
    ],
    notes: '20–30 分钟低冲击活动：散步 / 骑车皆可。这个阶段先不安排跑步、跳跃或高强度训练。',
  },
  {
    day_number: 7,
    week_number: 1,
    day_type: 'full_review',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      waterGoal(),
      stepsGoal(),
      weeklyReviewGoal('第 1 周复盘'),
    ],
    notes: '轻松活动，晚上完成第 1 周复盘。',
  },
];

// ---------------------------------------------------------
// Week 2（结构与 Week 1 相同，训练重点转为"动作质量"，
// 次数是否增加由 Week 1 review 的 coach_decision 决定，
// 不在数据层硬编码"自动加量"）
// ---------------------------------------------------------
const week2: DayPlan[] = [
  {
    day_number: 8,
    week_number: 2,
    day_type: 'workout',
    workout_id: 'workout-a',
    goals: [
      workoutGoal('训练 A', 'required'),
      lunchWalkGoal('recommended'),
      waterGoal(),
      stepsGoal(),
      sittingBreaksGoal('recommended'),
    ],
    notes: '如果第 1 周身体适应良好，教练会建议每个动作增加 1–2 次，而不是自动加量。',
  },
  {
    day_number: 9,
    week_number: 2,
    day_type: 'recovery',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      lunchWalkGoal('required'),
      shoulderRelaxGoal('required'),
      waterGoal(),
      stepsGoal(),
    ],
  },
  {
    day_number: 10,
    week_number: 2,
    day_type: 'rest',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      sittingBreaksGoal('required'),
      waterGoal(),
      stepsGoal(),
    ],
  },
  {
    day_number: 11,
    week_number: 2,
    day_type: 'workout',
    workout_id: 'workout-b',
    goals: [
      workoutGoal('训练 B', 'required'),
      lunchWalkGoal('recommended'),
      waterGoal(),
      stepsGoal(),
      sittingBreaksGoal('recommended'),
    ],
    notes: '重点是动作质量，不是速度。',
  },
  {
    day_number: 12,
    week_number: 2,
    day_type: 'recovery',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      optionalStretchGoal(),
      waterGoal(),
      stepsGoal(),
    ],
    notes: '正常通勤，轻松伸展 5 分钟。',
  },
  {
    day_number: 13,
    week_number: 2,
    day_type: 'low_impact',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      lowImpactGoal(),
      waterGoal(),
      stepsGoal(),
    ],
  },
  {
    day_number: 14,
    week_number: 2,
    day_type: 'full_review',
    goals: [
      workoutGoal('训练', 'not_applicable'),
      waterGoal(),
      stepsGoal(),
      weeklyReviewGoal('完整复盘（第 1–2 周）'),
    ],
    notes: '整理这两周的体重、步数、睡眠、饮水、训练完成率、饮食习惯、午后精神与身体不适记录。',
  },
];

export const plan14Day: DayPlan[] = [...week1, ...week2];

/** 按 day_number 查找当天计划，UI 层唯一应该使用的入口 */
export function getDayPlan(dayNumber: number): DayPlan | undefined {
  return plan14Day.find((d) => d.day_number === dayNumber);
}
