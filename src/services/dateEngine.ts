// =========================================================
// Date Engine — Service 层（Phase 3）
// 决策 1：按自然日历推进，不按 App 打开次数冻结进度
// =========================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 字符串转成 UTC 零点的 Date，避免时区导致的"差一天"问题 */
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayOf(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 计算今天对应 14 天计划的第几天。
 * - 完全按日历天数差 + 1 计算，用户漏打开 App 不会"冻结"进度
 * - clamp 在 [1, 14]：还没到 start_date 按 Day 1 处理（理论不该发生）；
 *   超过 14 天，说明 14 天计划已结束，返回 14（Phase 6 之后由 Coach 页面
 *   接手"计划已完成，是否进入下一阶段"的逻辑，Phase 3 先保证不越界报错）
 */
export function computeDayNumber(program_start_date: string, todayStr: string): number {
  const start = parseDateOnly(program_start_date);
  const today = parseDateOnly(todayStr);
  const diffDays = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY);
  const dayNumber = diffDays + 1;
  return Math.min(14, Math.max(1, dayNumber));
}

export function isProgramComplete(program_start_date: string, todayStr: string): boolean {
  const start = parseDateOnly(program_start_date);
  const today = parseDateOnly(todayStr);
  const diffDays = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY);
  return diffDays + 1 > 14;
}

/** 反向换算：14 天计划里的第 N 天对应的真实日历日期 */
export function dayNumberToDate(program_start_date: string, day_number: number): string {
  const start = parseDateOnly(program_start_date);
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + (day_number - 1));
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 修复：之前 Plan 页面用的是种子数据里写死的"周一/周二/..."文字，
 * 隐含假设"用户一定是从周一开始 Day 1"——但 program_start_date
 * 是用户实际开始使用 App 的那一天，可能是任何一个星期几。
 * 这里改成从真实日期算出真正的星期几，不再依赖写死的文字。
 */
export function getWeekdayZh(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  return WEEKDAY_ZH[d.getUTCDay()];
}
