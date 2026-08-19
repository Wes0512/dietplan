// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YesterdayPrompt } from '../../components/YesterdayPrompt';

afterEach(cleanup);

describe('YesterdayPrompt — Skip must never look like failure (Phase 9 §4)', () => {
  it('renders the neutral prompt message with the given date', () => {
    render(<YesterdayPrompt yesterdayDate="2026-08-17" onFillYesterday={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('2026-08-17 还没有记录，要补记吗？')).toBeInTheDocument();
  });

  it('"补记昨天" calls onFillYesterday, not onSkip', async () => {
    const user = userEvent.setup();
    const onFillYesterday = vi.fn();
    const onSkip = vi.fn();
    render(<YesterdayPrompt yesterdayDate="2026-08-17" onFillYesterday={onFillYesterday} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: '补记昨天' }));
    expect(onFillYesterday).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('"跳过，继续今天" calls onSkip only — dismissing the prompt is not a failure record', async () => {
    const user = userEvent.setup();
    const onFillYesterday = vi.fn();
    const onSkip = vi.fn();
    render(<YesterdayPrompt yesterdayDate="2026-08-17" onFillYesterday={onFillYesterday} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: '跳过，继续今天' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onFillYesterday).not.toHaveBeenCalled();
  });
});
