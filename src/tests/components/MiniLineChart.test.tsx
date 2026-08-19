// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiniLineChart } from '../../components/MiniLineChart';

afterEach(cleanup);

const data = [
  { date: '2026-08-15', value: 66.2 },
  { date: '2026-08-16', value: 66.0 },
  { date: '2026-08-17', value: 65.7 },
];

describe('MiniLineChart — tap to inspect exact date/value (Phase 9 §10 chart interaction)', () => {
  it('shows the empty state when there is no data', () => {
    render(<MiniLineChart data={[]} unit="kg" />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('defaults to showing the most recent point', () => {
    render(<MiniLineChart data={data} unit="kg" formatValue={(v) => v.toFixed(1)} />);
    expect(screen.getByText(/8月17日/)).toBeInTheDocument();
    expect(screen.getByText(/65\.7 kg/)).toBeInTheDocument();
  });

  it('tapping an earlier point updates the displayed date/value to that point', async () => {
    const user = userEvent.setup();
    const { container } = render(<MiniLineChart data={data} unit="kg" formatValue={(v) => v.toFixed(1)} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
    await user.click(circles[0]); // 最早的一天

    expect(screen.getByText(/8月15日/)).toBeInTheDocument();
    expect(screen.getByText(/66\.2 kg/)).toBeInTheDocument();
  });
});
