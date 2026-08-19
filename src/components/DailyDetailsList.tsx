// =========================================================
// DailyDetailsList — Phase 5
// 图表只是概览，原始每日数据始终可以展开查看
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { copy } from '../i18n';

interface DailyDetailsListProps {
  rows: { date: string; label: string }[];
}

export function DailyDetailsList({ rows }: DailyDetailsListProps) {
  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 mt-2">{copy.progress.noDailyEntries}</p>;
  }
  return (
    <details className="mt-2">
      <summary className="text-xs text-blue-600 cursor-pointer">{copy.progress.viewDailyEntries(rows.length)}</summary>
      <ul className="mt-2 text-xs text-gray-600 divide-y border rounded-lg">
        {[...rows].reverse().map((r) => (
          <li key={r.date} className="flex justify-between px-3 py-1.5">
            <span>{formatDate(r.date)}</span>
            <span className="text-gray-800">{r.label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}月${Number(d)}日`;
}
