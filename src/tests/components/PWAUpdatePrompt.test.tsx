// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateServiceWorker = vi.fn();
let needRefreshValue = false;
const setNeedRefresh = vi.fn((v: boolean) => { needRefreshValue = v; });

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefreshValue, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  needRefreshValue = false;
});

describe('PWAUpdatePrompt — never auto-reloads, user decides (Phase 9 §15)', () => {
  it('renders nothing when no update is available', async () => {
    const { PWAUpdatePrompt } = await import('../../components/PWAUpdatePrompt');
    const { container } = render(<PWAUpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "发现新版本" with 更新应用/稍后更新 buttons when an update is available, and does not call updateServiceWorker on render', async () => {
    needRefreshValue = true;
    const { PWAUpdatePrompt } = await import('../../components/PWAUpdatePrompt');
    render(<PWAUpdatePrompt />);

    expect(screen.getByText('发现新版本')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更新应用' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '稍后更新' })).toBeInTheDocument();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('"更新应用" calls updateServiceWorker only after explicit user click', async () => {
    needRefreshValue = true;
    const user = userEvent.setup();
    const { PWAUpdatePrompt } = await import('../../components/PWAUpdatePrompt');
    render(<PWAUpdatePrompt />);

    await user.click(screen.getByRole('button', { name: '更新应用' }));
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('"稍后更新" dismisses the prompt without ever calling updateServiceWorker', async () => {
    needRefreshValue = true;
    const user = userEvent.setup();
    const { PWAUpdatePrompt } = await import('../../components/PWAUpdatePrompt');
    render(<PWAUpdatePrompt />);

    await user.click(screen.getByRole('button', { name: '稍后更新' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });
});
