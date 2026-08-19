// =========================================================
// vite.config.ts — Phase 8（GitHub Pages 部署适配）
// PWA 配置核心原则：
// - Service Worker 只缓存"App 壳"（HTML/JS/CSS/图标/SVG 插图），
//   绝不缓存/代理用户数据——用户数据永远只存在 IndexedDB 里，
//   Service Worker 对 IndexedDB 完全不可见、不干预。
//
// GitHub Pages 部署说明：
// 仓库是 https://wes0512.github.io/dietplan/ 这种"项目页"形式，
// 不是根域名，所以所有资源路径都必须带上 /dietplan/ 这个前缀，
// 否则图标、SVG 插图、manifest 都会 404。BASE_PATH 统一定义，
// 下面所有用到路径的地方都引用它，只要改这一处就能适配别的仓库名。
// =========================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE_PATH = '/dietplan/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // 绝不自动刷新页面——交给 PWAUpdatePrompt 组件由用户决定何时更新
      injectRegister: false, // 用 React 侧的 useRegisterSW 钩子（PWAUpdatePrompt）手动控制注册时机，不需要自动注入的注册脚本，避免重复注册
      includeAssets: ['icons/*.png', 'assets/exercises/*.svg'],
      manifest: {
        name: '个人减脂教练',
        short_name: '减脂教练',
        description: '12 周渐进式健康习惯养成 App',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          { src: `${BASE_PATH}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE_PATH}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BASE_PATH}icons/icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App 壳（构建产出的 JS/CSS/HTML）+ 图标 + 动作示范 SVG 全部预缓存，
        // 保证首次加载过一次之后，离线也能打开 App 并看到训练插图。
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // 绝不把 IndexedDB 当成"网络资源"缓存——用户数据不经过 Service Worker，
        // 这里的 runtimeCaching 只处理"外部补充视频链接"这类真正的网络请求，
        // 使用 NetworkOnly，离线时自然失败，UI 层会明确提示"需要联网"，
        // 不会把不可用的外部视频错误地伪装成"已缓存可用"。
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(www\.)?(nhs\.uk|youtube\.com|youtu\.be)/,
            handler: 'NetworkOnly',
          },
        ],
        navigateFallback: `${BASE_PATH}index.html`,
        navigateFallbackDenylist: [new RegExp(`^${BASE_PATH}icons/`)],
      },
      devOptions: {
        enabled: false, // 开发模式下不启用 SW，避免调试时缓存干扰；生产构建才生成
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
