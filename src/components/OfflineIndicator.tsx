// =========================================================
// OfflineIndicator — Phase 8
// 轻量提示，不阻断任何操作。核心信息："你的记录仍然可以正常保存。"
// 因为所有数据读写都走 IndexedDB，离线完全不影响记录功能。
// =========================================================
import { useEffect, useState } from 'react';
import { copy } from '../i18n';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [justCameBackOnline, setJustCameBackOnline] = useState(false);
  const c = copy.pwa;

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
      setJustCameBackOnline(false);
    }
    function handleOnline() {
      setIsOffline(false);
      setJustCameBackOnline(true);
      setTimeout(() => setJustCameBackOnline(false), 2500);
    }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !justCameBackOnline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 text-center text-xs py-1.5 safe-top ${
        isOffline ? 'bg-gray-800 text-white' : 'bg-green-600 text-white'
      }`}
    >
      {isOffline ? (
        <span>{c.offline} · {c.offlineDataSafe}</span>
      ) : (
        <span>{c.online}</span>
      )}
    </div>
  );
}
