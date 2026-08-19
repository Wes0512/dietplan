// =========================================================
// ConsistencyBadge — Phase 5
// 用中性/鼓励性配色呈现一致性，没有红色"警示/失败"配色
// Phase 6.5：文案改由 i18n 字典提供，服务层不再持有 UI 文本
// =========================================================
import type { ConsistencyLabel } from '../services/progressEngine';
import { copy } from '../i18n';

const STYLE: Record<ConsistencyLabel, string> = {
  on_track: 'bg-green-100 text-green-800',
  building_consistency: 'bg-amber-100 text-amber-800',
  worth_improving: 'bg-blue-100 text-blue-800', // 刻意不用红色/灰色暗示失败
  no_data: 'bg-gray-100 text-gray-500',
};

const LABEL: Record<ConsistencyLabel, string> = {
  on_track: copy.consistency.onTrack,
  building_consistency: copy.consistency.buildingConsistency,
  worth_improving: copy.consistency.worthImproving,
  no_data: copy.consistency.noData,
};

export function ConsistencyBadge({ label }: { label: ConsistencyLabel }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${STYLE[label]}`}>
      {LABEL[label]}
    </span>
  );
}
