// =========================================================
// Coach Engine — Service 层（Phase 6，Phase 6.5 文案本地化为简体中文）
//
// Coach 回答的问题："根据这一周发生的事情，接下来该怎么做？"
// （Progress 回答的是"我是不是在变好" —— 两者不重复）
//
// 硬性原则（不允许被打破）：
// 1. 绝不自动建议"减少热量"或"每天跑步"这类激进指令
// 2. 体重没下降时，先检查睡眠/饮食份量/零食/含糖饮料/步数/训练一致性/
//    周末饮食，而不是直接归因于"运动量不够"
// 3. 出现疼痛 → 优先降低强度，pain_reported=true 时 decision 只能是
//    ADJUST 或 HOLD，绝不允许是 PROGRESS
// 4. PROGRESS 只能出现在阶段边界（本 App 目前是 Week 2 结束），
//    且需要 App 提示用户"是否进入下一阶段"，由用户确认，不自动跳
// 5. 体重短期波动不能自动触发负面 coaching；如果训练/步数/睡眠/精神/
//    饮食习惯比上周改善，即使体重没变化，也要认可这是有意义的进步
//
// 注：本文件生成的所有文案都是用户会直接看到的（Coach 页面 Weekly Review
// 卡片），因此按 Phase 6.5 要求使用简体中文；内部字段名/枚举值（decision
// 取值 KEEP/ADJUST/PROGRESS/HOLD 等）保持不变，只本地化展示文案。
// =========================================================
import type { CoachDecision, WeeklyReview } from '../types';
import type { WeekStats } from './statsEngine';
import { computeWeightTrend } from './statsEngine';
import type { DailyLog } from '../types';

export interface PreviousWeekSnapshot {
  average_steps?: number;
  average_sleep_min?: number;
  average_energy?: number;
  exercise_completion: string;
}

export interface CoachDecisionInput {
  week_number: number;
  stats: WeekStats;
  logs: DailyLog[]; // 用于体重趋势计算
  is_phase_boundary: boolean; // 是否处于阶段边界（本 App 目前只有 Week 2）
  required_workout_count: number;
  /** 上一周的关键数据快照，用于识别"体重没变但行为在进步"的情况 */
  previous?: PreviousWeekSnapshot;
}

export interface CoachDecisionResult {
  decision: CoachDecision;
  reason: string;
  next_week_goals: [string, string, string];
}

function joinNatural(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`;
}

function formatMinutes(min: number): string {
  return `${Math.floor(min / 60)} 小时 ${Math.round(min % 60)} 分钟`;
}

/**
 * 识别"相比上周有改善"的行为维度，用于在体重没有明显下降时，
 * 依然向用户明确指出他们做对了什么，而不是让体重数字主导整个反馈。
 */
function describeImprovements(current: WeekStats, previous?: PreviousWeekSnapshot): string {
  if (!previous) return '';
  const notes: string[] = [];

  if (
    previous.average_sleep_min !== undefined &&
    current.average_sleep_min !== undefined &&
    current.average_sleep_min - previous.average_sleep_min >= 10
  ) {
    notes.push('睡眠');
  }
  if (
    previous.average_steps !== undefined &&
    current.average_steps !== undefined &&
    current.average_steps - previous.average_steps >= 200
  ) {
    notes.push('步数');
  }
  if (
    previous.average_energy !== undefined &&
    current.average_energy !== undefined &&
    current.average_energy - previous.average_energy >= 0.3
  ) {
    notes.push('午后精神');
  }
  const [pc, pt] = previous.exercise_completion.split('/').map(Number);
  const [cc, ct] = current.exercise_completion.split('/').map(Number);
  if (pt > 0 && ct > 0 && cc / ct > pc / pt) {
    notes.push('训练规律性');
  }

  if (notes.length === 0) return '';
  return `而且和上周相比，${joinNatural(notes)}都有改善 —— 即使体重变化不大，这些同样是有意义的进步。`;
}

export function generateCoachDecision(input: CoachDecisionInput): CoachDecisionResult {
  const { stats, is_phase_boundary, previous } = input;

  // ---- 规则 1：疼痛优先 ----
  if (stats.pain_reported) {
    return {
      decision: 'ADJUST',
      reason:
        '这周有记录到一些身体不适。根据安全原则，我们会优先降低动作强度，或改用简化版本，而不是增加训练量。' +
        '如果不适持续、反复出现或加重，建议咨询医生或物理治疗师。',
      next_week_goals: [
        '造成不适的动作先用简化版本，继续观察身体反应',
        '步数和饮水目标维持不变',
        '继续记录不适出现的部位和频率，供下次复盘参考',
      ],
    };
  }

  const [completed, total] = stats.exercise_completion.split('/').map(Number);
  const workoutCompletionRate = total > 0 ? completed / total : 0;
  const weightTrend = computeWeightTrend(input.logs);
  const sleepOk = (stats.average_sleep_min ?? 0) >= 360; // 6 小时是本阶段的及格线，不是最终目标
  const energyOk = (stats.average_energy ?? 0) >= 3;
  const improvementNote = describeImprovements(stats, previous);

  // ---- 规则 2：训练完成率低 → 维持不变，不惩罚 ----
  if (workoutCompletionRate < 0.5) {
    return {
      decision: 'KEEP',
      reason:
        `这周训练完成次数比较少（${stats.exercise_completion}）。现在的重点是先建立习惯，不是求快 —— ` +
        '下周维持原本的安排，不会增加任何要求。',
      next_week_goals: [
        '维持原本的训练安排，做到比做多更重要',
        '特别累的那天，做一半动作也比完全不做好',
        '继续记录，帮助我们了解卡住的原因',
      ],
    };
  }

  // ---- 规则 3：睡眠/精神没跟上 → 维持不变，即使训练完成率好 ----
  if (!sleepOk || !energyOk) {
    const sleepText = stats.average_sleep_min !== undefined ? formatMinutes(stats.average_sleep_min) : '数据还不够';
    return {
      decision: 'KEEP',
      reason:
        `训练完成率不错（${stats.exercise_completion}），但睡眠或午后精神还没跟上` +
        `（平均睡眠 ${sleepText}，午后精神 ${stats.average_energy ?? '暂无记录'}/5）。` +
        '在恢复状况改善之前，训练量维持不变 —— 睡眠是现在的重点。',
      next_week_goals: [
        '试着比这周提前 15 分钟上床',
        '训练量维持不变',
        '留意午餐份量和午后精神的关系',
      ],
    };
  }

  // ---- 规则 4：体重上升但其他数据都好 → 维持不变，不做激进建议 ----
  if (weightTrend === 'up') {
    return {
      decision: 'KEEP',
      reason:
        '训练、睡眠、精神状态都不错，只是体重稍微上升了一点。这通常和水分、饮食份量或周末吃得比较多有关，' +
        `不代表计划没有效果。计划维持不变，多看 7 天趋势，不用在意单一数字。${improvementNote}`,
      next_week_goals: [
        '训练量维持不变',
        '留意周末的饮食份量，不需要精确计算热量',
        '继续记录体重，关注 7 天趋势而不是单一数字',
      ],
    };
  }

  // ---- 规则 5：一切良好 + 处于阶段边界 → 可以逐步增加，但需要用户确认 ----
  if (is_phase_boundary) {
    return {
      decision: 'PROGRESS',
      reason:
        `这周训练完成情况不错（${stats.exercise_completion}），没有不适，睡眠和精神都维持得住，` +
        `体重呈${weightTrend === 'down' ? '下降' : '持平'}趋势。现在正好是阶段边界 —— ` +
        `进入下一阶段看起来是合理的，但需要你确认后才会做任何调整。${improvementNote}`,
      next_week_goals: [
        '（确认后由下一阶段计划填入）',
        '（确认后由下一阶段计划填入）',
        '（确认后由下一阶段计划填入）',
      ],
    };
  }

  // ---- 默认：一切良好但非阶段边界 → 先保持 ----
  return {
    decision: 'HOLD',
    reason:
      `这周的各项数据都不错（训练 ${stats.exercise_completion}，没有不适，睡眠和精神都良好）。` +
      `强度调整只在阶段边界才会评估，这周维持现状。${improvementNote}`,
    next_week_goals: [
      '训练量和生活习惯维持不变',
      '继续记录 —— 这些数据会用在下一次阶段复盘',
      '如果状态持续良好，下一个阶段边界会考虑逐步增加',
    ],
  };
}

/** 组装成可直接存入 WeeklyReview 的部分字段（不含 id/user_id/created_at） */
export function buildWeeklyReviewPatch(
  week_number: number,
  stats: WeekStats,
  decisionResult: CoachDecisionResult,
): Omit<WeeklyReview, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    week_number,
    average_weight_kg: stats.average_weight_kg,
    average_steps: stats.average_steps,
    average_water_ml: stats.average_water_ml,
    average_sleep_min: stats.average_sleep_min,
    exercise_completion: stats.exercise_completion,
    average_energy: stats.average_energy,
    pain_reported: stats.pain_reported,
    coach_summary: decisionResult.reason,
    coach_decision: decisionResult.decision,
    coach_decision_reason: decisionResult.reason,
    next_week_goal_1: decisionResult.next_week_goals[0],
    next_week_goal_2: decisionResult.next_week_goals[1],
    next_week_goal_3: decisionResult.next_week_goals[2],
  };
}

// ---------------------------------------------------------
// What went well / What needs attention — 从已存储的 WeeklyReview
// 数值字段派生，不需要额外的数据库字段，历史 review 也能正确展示。
// ---------------------------------------------------------
export interface WeeklyHighlights {
  wentWell: string[];
  needsAttention: string[];
}

export function deriveWeeklyHighlights(review: WeeklyReview, previous?: WeeklyReview): WeeklyHighlights {
  const wentWell: string[] = [];
  const needsAttention: string[] = [];

  const [completed, total] = review.exercise_completion.split('/').map(Number);
  if (total > 0) {
    if (completed / total >= 0.5) {
      wentWell.push(`训练 ${review.exercise_completion} 已完成`);
    } else {
      needsAttention.push(`训练完成情况：${review.exercise_completion}`);
    }
  }

  if (review.average_steps !== undefined) {
    const stepsText = Math.round(review.average_steps).toLocaleString();
    if (review.average_steps >= 6000) {
      wentWell.push(`步数维持在接近目标（${stepsText}/天）`);
    } else {
      needsAttention.push(`平均步数：${stepsText}/天`);
    }
  }

  if (review.average_sleep_min !== undefined) {
    const text = `平均睡眠：${formatMinutes(review.average_sleep_min)}`;
    // 用 7 小时（长期目标）作为"这周做得不错"的判定线，比 coachEngine 决策用的
    // 6 小时及格线更严格——这里是"值得关注的亮点/待改善点"展示，不是
    // "是否要推进阶段"的判定，所以标准可以不同。
    if (review.average_sleep_min >= 420) wentWell.push(text);
    else needsAttention.push(text);
  }

  if (review.average_energy !== undefined) {
    const text = `午后精神：${review.average_energy.toFixed(1)}/5`;
    if (review.average_energy >= 3) wentWell.push(text);
    else needsAttention.push(text);
  }

  if (review.pain_reported) {
    needsAttention.push('这周有记录到一些身体不适');
  } else {
    wentWell.push('最近没有记录到身体不适');
  }

  // 周环比改善——即使体重没变化，也要显性认可行为层面的进步
  if (previous) {
    const improvements: string[] = [];
    if (
      previous.average_sleep_min !== undefined &&
      review.average_sleep_min !== undefined &&
      review.average_sleep_min > previous.average_sleep_min
    ) {
      improvements.push(`睡眠从 ${formatMinutes(previous.average_sleep_min)} 提升到 ${formatMinutes(review.average_sleep_min)}`);
    }
    if (
      previous.average_steps !== undefined &&
      review.average_steps !== undefined &&
      review.average_steps > previous.average_steps
    ) {
      improvements.push(`步数从 ${Math.round(previous.average_steps).toLocaleString()} 提升到 ${Math.round(review.average_steps).toLocaleString()}`);
    }
    if (
      previous.average_energy !== undefined &&
      review.average_energy !== undefined &&
      review.average_energy > previous.average_energy
    ) {
      improvements.push(`午后精神从 ${previous.average_energy.toFixed(1)} 提升到 ${review.average_energy.toFixed(1)}`);
    }
    const [prevC, prevT] = previous.exercise_completion.split('/').map(Number);
    const [curC, curT] = review.exercise_completion.split('/').map(Number);
    if (prevT > 0 && curT > 0 && curC / curT > prevC / prevT) {
      improvements.push(`训练规律性提升了（${previous.exercise_completion} \u2192 ${review.exercise_completion}）`);
    }
    if (improvements.length > 0) {
      wentWell.unshift(`和上周相比：${improvements.join('，')}`);
    }
  }

  return { wentWell, needsAttention };
}
