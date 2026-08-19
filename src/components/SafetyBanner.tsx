// =========================================================
// SafetyBanner — "安全提醒" + 绿/黄/红 疼痛规则
// Phase 4.5：默认折叠减少视觉干扰，但保持每次进入训练页都可见，
// 不加"不再提醒"开关、不新增任何数据库字段——纯组件内 state。
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useState } from 'react';
import { copy } from '../i18n';

export function SafetyBanner() {
  const [expanded, setExpanded] = useState(false);
  const c = copy.safety;

  return (
    <div className="mx-4 mt-3 rounded-lg border border-blue-100 bg-blue-50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold text-blue-900">{c.collapsedTitle}</span>
        <span className="text-xs text-blue-600">{expanded ? c.hide : c.tapToView}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <p className="text-xs text-blue-800">{c.intro}</p>
          <div className="mt-2 space-y-1 text-xs">
            <p><span className="font-medium text-green-700">{c.green}</span>{c.greenDesc}</p>
            <p><span className="font-medium text-amber-700">{c.yellow}</span>{c.yellowDesc}</p>
            <p><span className="font-medium text-red-700">{c.red}</span>{c.redDesc}</p>
          </div>
          <p className="text-xs text-blue-800 mt-2">{c.footer}</p>
        </div>
      )}
    </div>
  );
}
