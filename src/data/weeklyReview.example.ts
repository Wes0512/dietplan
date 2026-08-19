// =========================================================
// Weekly Review 示例数据 — 仅用于展示数据结构，不参与实际 seed
// 调整点 #5：coach_decision 字段
// =========================================================
import type { WeeklyReview } from '../types';

export const exampleWeek1Review: WeeklyReview = {
  id: 'example-week1-review',
  user_id: 'example-user-id',
  week_number: 1,

  average_weight_kg: 65.8,
  average_steps: 6420,
  average_water_ml: 1850,
  average_sleep_min: 375, // 6h15m
  exercise_completion: '2/2',
  average_energy: 2.8,
  pain_reported: false,

  coach_summary:
    'Workout A 和 B 都完成了，动作没有出现明显疼痛。步数稳定在目标范围内。但睡眠平均只有 6 小时 15 分钟，且午后精神偏低（2.8/5），这两点比训练完成率更值得关注。',

  coach_decision: 'KEEP',
  coach_decision_reason:
    '训练完成率良好（2/2）且没有疼痛，理论上可以推进强度。但睡眠仍然不足，午后精神偏低，说明身体恢复没有跟上。Week 2 先维持相同训练量，重点放在睡眠时间提前 15 分钟，而不是增加运动强度。',

  next_week_goal_1: '尝试比这周提前 15 分钟上床（约 12:15–12:45am）',
  next_week_goal_2: '维持 Workout A / B 各 1 次，动作次数不变',
  next_week_goal_3: '午餐后走 10 分钟保持不变，观察是否对午后精神有帮助',

  created_at: '2026-08-23T21:00:00.000Z',
  updated_at: '2026-08-23T21:00:00.000Z',
};

/**
 * coach_decision 四个取值的使用场景说明（供 Phase 6 coachEngine 实作参考）：
 *
 * KEEP     — 维持当前计划不变（如上例：完成率好但睡眠/精神数据还没跟上）
 * ADJUST   — 计划不变，但需要调整某个具体做法（如减少某动作次数、
 *            换成简化版本），通常因为 pain_reported = true
 * PROGRESS — 各项数据都良好，进入下一阶段或小幅增加训练量，
 *            仅在 Week 2 结束、Week 4 结束等关键节点使用，且需要
 *            App 提示用户确认，不自动跳阶段
 * HOLD     — 出现疼痛持续/加重或睡眠明显恶化，暂停增加任何强度，
 *            并提示"如持续请咨询医生/物理治疗师"
 */
