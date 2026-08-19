// =========================================================
// YesterdayPrompt — 决策 1：非阻塞提示，Skip 绝不代表失败
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { copy } from '../i18n';

interface YesterdayPromptProps {
  yesterdayDate: string;
  onFillYesterday: () => void;
  onSkip: () => void;
}

export function YesterdayPrompt({ yesterdayDate, onFillYesterday, onSkip }: YesterdayPromptProps) {
  const c = copy.yesterdayPrompt;
  return (
    <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm text-amber-900">{c.message(yesterdayDate)}</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onFillYesterday}
          className="rounded-md bg-amber-900 text-white text-sm px-3 py-1.5"
        >
          {c.fillYesterday}
        </button>
        <button
          onClick={onSkip}
          className="rounded-md border border-amber-300 text-amber-900 text-sm px-3 py-1.5"
        >
          {c.skipAndContinue}
        </button>
      </div>
    </div>
  );
}
