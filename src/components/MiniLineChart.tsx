// =========================================================
// MiniLineChart — Phase 5
// 不依赖外部图表库，纯 SVG，viewBox 自适应容器宽度，
// 保证在 iPhone 上永远不需要横向滚动。
// 点按（而不是 hover）显示精确日期/数值，适配触屏。
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useState } from 'react';
import { copy } from '../i18n';

export interface ChartPoint {
  date: string; // 'YYYY-MM-DD'
  value: number;
}

interface MiniLineChartProps {
  data: ChartPoint[];
  unit: string;
  height?: number;
  formatValue?: (v: number) => string;
}

const WIDTH = 320; // viewBox 内部坐标系宽度，实际渲染宽度由外层容器决定（100%）

export function MiniLineChart({ data, unit, height = 120, formatValue }: MiniLineChartProps) {
  const [selected, setSelected] = useState<ChartPoint | undefined>(data[data.length - 1]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400 border rounded-lg" style={{ height }}>
        {copy.progress.noChartData}
      </div>
    );
  }

  if (data.length === 1) {
    const only = data[0];
    return (
      <div className="border rounded-lg p-3">
        <p className="text-sm text-gray-500">{formatDate(only.date)}</p>
        <p className="text-lg font-medium">{formatValue ? formatValue(only.value) : only.value} {unit}</p>
        <p className="text-xs text-gray-400 mt-1">{copy.progress.onlyOneEntryHint}</p>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // 避免除以 0（所有值相同时）
  const padding = 16;
  const plotWidth = WIDTH - padding * 2;
  const plotHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * plotWidth;
    const y = padding + (1 - (d.value - min) / range) * plotHeight;
    return { ...d, x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2} />
        {points.map((p) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={selected?.date === p.date ? 5 : 3.5}
            fill={selected?.date === p.date ? '#1d4ed8' : '#60a5fa'}
            onClick={() => setSelected(p)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>
      <div className="text-xs text-gray-500 mt-1 text-center">
        {selected && (
          <span>
            {formatDate(selected.date)}：<span className="font-medium text-gray-700">{formatValue ? formatValue(selected.value) : selected.value} {unit}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}月${Number(d)}日`;
}
