// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingForm } from '../../components/OnboardingForm';
import { db } from '../../db/schema';

afterEach(async () => {
  cleanup();
  await db.user.clear();
});

describe('OnboardingForm — component interaction (Phase 9 priority #1)', () => {
  it('shows a validation message and does not call onComplete when name is empty', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingForm onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: '开始第 1 天' }));

    expect(await screen.findByText('请输入姓名。')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    expect(await db.user.count()).toBe(0);
  });

  it('creates a User record and calls onComplete when the form is filled correctly', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingForm onComplete={onComplete} />);

    await user.type(screen.getByLabelText('姓名'), '志明');
    await user.click(screen.getByRole('button', { name: '开始第 1 天' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const created = onComplete.mock.calls[0][0];
    expect(created.name).toBe('志明');
    expect(created.program_start_date).toBeDefined();

    const stored = await db.user.get(created.id);
    expect(stored?.name).toBe('志明');
  });
});
