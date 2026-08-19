// =========================================================
// Sleep Validation — Service 层（Phase 4 Decision 1）
// 目的：睡眠数据后续会被 statsEngine / coachEngine 使用，
// 异常值（比如时间填反）会污染 7 天平均和 coach_decision 的判断，
// 所以在保存前就做数据质量把关，而不是等分析时才发现问题。
// =========================================================

export type SleepValidation =
  | { status: 'ok'; duration_min: number }
  | { status: 'needs_confirmation'; duration_min: number }
  | { status: 'too_long'; duration_min: number };

/**
 * - <= 12 小时：直接可信，'ok'
 * - > 12 小时且 <= 16 小时：不算离谱但少见（比如熬夜后补觉），
 *   需要用户确认一次，'needs_confirmation'
 * - > 16 小时：大概率是输入错误（比如 AM/PM 填反、时间选错），
 *   不允许直接保存，'too_long'，引导用户重新检查输入
 *
 * 绝不静默修改用户输入的时间；这个函数只做分类判断，不做任何"纠正"。
 * 最终存入数据库的值，必须是用户自己确认过的原始计算结果。
 */
export function validateSleepDuration(duration_min: number): SleepValidation {
  const hours = duration_min / 60;
  if (hours > 16) return { status: 'too_long', duration_min };
  if (hours > 12) return { status: 'needs_confirmation', duration_min };
  return { status: 'ok', duration_min };
}

/** 处理跨午夜的情况（比如 00:30 睡、07:00 醒） */
export function computeSleepDurationMin(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
}

export function formatDuration(duration_min: number): string {
  const h = Math.floor(duration_min / 60);
  const m = duration_min % 60;
  return `${h}h ${m}m`;
}
