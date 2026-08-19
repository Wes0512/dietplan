// =========================================================
// 仅供测试使用：vite-plugin-pwa 的 `virtual:pwa-register/react` 是构建时
// 由插件动态生成的虚拟模块，vitest 的模块图里并不认识它（vitest.config.ts
// 没有加载 vite-plugin-pwa）。这里提供一个同名的测试替身模块，
// 通过 vitest.config.ts 的 resolve.alias 指过来，
// 让 PWAUpdatePrompt 组件测试可以在不依赖真实构建管线的情况下运行。
//
// 默认导出的 hook 什么都不做（安全的空实现）；
// 需要模拟"发现新版本"等状态时，测试文件会用 vi.mock 覆盖这个模块。
// =========================================================
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
