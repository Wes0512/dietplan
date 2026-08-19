// =========================================================
// App Root — 路由骨架
// 底部导航固定四个：Today / Plan / Progress / Coach
// Phase 8：接入 iPhone 安全区、离线状态提示、PWA 更新提示
// =========================================================
import { NavLink, Route, HashRouter as Router, Routes } from 'react-router-dom';
import { TodayPage } from './pages/TodayPage';
import { PlanPage } from './pages/PlanPage';
import { DayDetailPage } from './pages/DayDetailPage';
import { ProgressPage } from './pages/ProgressPage';
import { CoachPage } from './pages/CoachPage';
import { BackupPage } from './pages/BackupPage';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { t } from './i18n';

const navItems = [
  { to: '/today', label: t('nav.today') },
  { to: '/plan', label: t('nav.plan') },
  { to: '/progress', label: t('nav.progress') },
  { to: '/coach', label: t('nav.coach') },
];

export function App() {
  return (
    <Router>
      <OfflineIndicator />
      <div className="min-h-screen safe-bottom-content max-w-md mx-auto">
        <Routes>
          <Route path="/today" element={<TodayPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/plan/day/:dayNumber" element={<DayDetailPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="*" element={<TodayPage />} />
        </Routes>

        <nav className="fixed bottom-0 left-0 right-0 flex border-t bg-white safe-bottom-nav max-w-md mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `tap-target flex-1 flex items-center justify-center text-sm ${isActive ? 'font-semibold text-black' : 'text-gray-500'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <PWAUpdatePrompt />
      </div>
    </Router>
  );
}
