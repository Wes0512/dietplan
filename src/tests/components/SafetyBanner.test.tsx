// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SafetyBanner } from '../../components/SafetyBanner';

afterEach(cleanup);

describe('SafetyBanner — component interaction (Phase 9 priority #4)', () => {
  it('is collapsed by default, showing only the summary row', () => {
    render(<SafetyBanner />);
    expect(screen.getByText('🛡️ 安全提醒 · 绿 / 黄 / 红')).toBeInTheDocument();
    expect(screen.queryByText('绿色｜正常疲劳')).not.toBeInTheDocument();
  });

  it('expands to show Green/Yellow/Red guidance when tapped, and collapses again on second tap', async () => {
    const user = userEvent.setup();
    render(<SafetyBanner />);

    await user.click(screen.getByText('🛡️ 安全提醒 · 绿 / 黄 / 红'));
    expect(screen.getByText('绿色｜正常疲劳')).toBeInTheDocument();
    expect(screen.getByText('黄色｜明显不适')).toBeInTheDocument();
    expect(screen.getByText('红色｜尖锐疼痛、麻木或头晕')).toBeInTheDocument();

    await user.click(screen.getByText('🛡️ 安全提醒 · 绿 / 黄 / 红'));
    expect(screen.queryByText('绿色｜正常疲劳')).not.toBeInTheDocument();
  });
});
