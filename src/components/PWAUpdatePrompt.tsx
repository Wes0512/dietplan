// =========================================================
// PWAUpdatePrompt — Phase 8
// 检测到新版本时提示"发现新版本"，用户主动点击才会更新，
// 绝不在用户可能正在输入数据时自动刷新页面导致数据丢失风险。
// =========================================================
import { useRegisterSW } from 'virtual:pwa-register/react';
import { copy } from '../i18n';

export function PWAUpdatePrompt() {
  const c = copy.pwa;

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // 定期检查更新，但绝不自动应用——只负责发现，不负责替用户决定
      if (!registration) return;
      const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 每小时检查一次即可，不需要更频繁
      setInterval(() => {
        registration.update().catch(() => {
          // 网络不可用时检查失败是正常情况，静默忽略，不打扰用户
        });
      }, CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  function handleUpdateNow() {
    updateServiceWorker(true);
  }

  function handleLater() {
    setNeedRefresh(false);
  }

  return (
    <div className="fixed left-4 right-4 z-50 rounded-lg border border-blue-200 bg-white shadow-lg p-3" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
      <p className="text-sm font-medium text-gray-900">{c.updateAvailableTitle}</p>
      <p className="text-xs text-gray-500 mt-1">{c.updateAvailableDesc}</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleUpdateNow}
          className="tap-target rounded-md bg-black text-white text-sm px-4 py-2"
        >
          {c.updateNow}
        </button>
        <button
          onClick={handleLater}
          className="tap-target rounded-md border text-sm px-4 py-2"
        >
          {c.updateLater}
        </button>
      </div>
    </div>
  );
}
