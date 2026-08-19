// =========================================================
// SaveIndicator — 需求点 #17：Save state confirmation
// =========================================================
import { useEffect, useState } from 'react';
import { copy } from '../i18n';

export function useSaveIndicator() {
  const [visible, setVisible] = useState(false);

  function flash() {
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(t);
  }, [visible]);

  return { visible, flash };
}

export function SaveIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <span className="text-xs text-green-600 ml-2">{copy.common.saved}</span>;
}
