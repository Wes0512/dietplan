import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // 组件测试环境不加载 vite-plugin-pwa，用一个安全的空实现顶替
      // 它构建时才存在的虚拟模块，测试文件里可以用 vi.mock 再覆盖。
      'virtual:pwa-register/react': fileURLToPath(new URL('./src/tests/mocks/pwaRegisterMock.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
  },
});
