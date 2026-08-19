// =========================================================
// CoachDecisionBadge — Phase 6
// KEEP/ADJUST/PROGRESS/HOLD 四种决策的中性展示，没有红色警示配色
// Phase 6.5：显示文案改为简体中文，内部枚举值不变
// =========================================================
import { copy } from '../i18n';
import type { CoachDecision } from '../types';

const STYLE: Record<CoachDecision, string> = {
  KEEP: 'bg-blue-100 text-blue-800',
  ADJUST: 'bg-amber-100 text-amber-800',
  PROGRESS: 'bg-green-100 text-green-800',
  HOLD: 'bg-gray-100 text-gray-700',
};

export function CoachDecisionBadge({ decision }: { decision: CoachDecision }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STYLE[decision]}`}>
      {copy.coachDecision[decision]}
    </span>
  );
}
