// =========================================================
// main.tsx — Phase 8
// 应用启动入口。渲染 App 之前先跑 initDatabase()：
// - 首次安装：写入 appConfig + seed workout 内容
// - 已有数据：按需执行 schema 迁移（Dexie 自动 + 应用层记账）
// 这样保证"打开 App → 数据可用"这件事永远发生在渲染业务页面之前，
// 不会出现"页面先渲染、数据库还没迁移完"的竞态问题。
// =========================================================
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initDatabase } from './db/migrations';
import './index.css';

function Root() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('initDatabase failed', err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-red-600">
        App 启动时出现问题，你的数据没有丢失，请尝试关闭后重新打开。
        <br />
        <span className="text-xs text-gray-400">{error}</span>
      </div>
    );
  }

  if (!ready) {
    return <div className="p-6 text-center text-sm text-gray-400">加载中…</div>;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
