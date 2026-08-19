import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const DIST_DIR = join(PROJECT_ROOT, 'dist');

/**
 * 这些测试检查的是"npx vite build"的真实产物，而不是源代码本身——
 * PWA manifest / service worker 是构建时生成的，必须确保构建结果本身
 * 是正确的（Chinese 名称、正确的图标、正确的预缓存清单），而不是只检查
 * vite.config.ts 里"写了什么配置"。
 *
 * 如果 dist/ 目录不存在（比如 CI 环境还没跑过 build），自动先跑一次构建，
 * 保证这份测试永远是针对"当前源代码真实构建出来的产物"做校验。
 */
beforeAll(() => {
  if (!existsSync(join(DIST_DIR, 'manifest.webmanifest'))) {
    execSync('npx vite build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
  }
}, 60_000);

describe('Phase 8 — PWA build artifacts', () => {
  it('1. manifest.webmanifest exists in the build output', () => {
    expect(existsSync(join(DIST_DIR, 'manifest.webmanifest'))).toBe(true);
  });

  it('2. manifest has the correct Chinese name and required PWA fields', () => {
    const manifest = JSON.parse(readFileSync(join(DIST_DIR, 'manifest.webmanifest'), 'utf-8'));
    expect(manifest.name).toBe('个人减脂教练');
    expect(manifest.short_name).toBe('减脂教练');
    expect(manifest.lang).toBe('zh-CN');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('3. service worker (sw.js) is generated', () => {
    expect(existsSync(join(DIST_DIR, 'sw.js'))).toBe(true);
  });

  it('4. required app-shell assets (JS/CSS/HTML) are included in the precache list', () => {
    const sw = readFileSync(join(DIST_DIR, 'sw.js'), 'utf-8');
    expect(sw).toMatch(/index\.html/);
    expect(sw).toMatch(/assets\/index-[\w-]+\.js/);
    expect(sw).toMatch(/assets\/index-[\w-]+\.css/);
  });

  it('5. all 15 exercise SVG illustrations are in the precache list (available offline)', () => {
    const sw = readFileSync(join(DIST_DIR, 'sw.js'), 'utf-8');
    const matches = sw.match(/assets\/exercises\/[\w-]+\.svg/g) ?? [];
    const unique = new Set(matches);
    expect(unique.size).toBe(15);
  });

  it('app icons (192/512/512-maskable/apple-touch-icon) are in the precache list', () => {
    const sw = readFileSync(join(DIST_DIR, 'sw.js'), 'utf-8');
    expect(sw).toMatch(/icons\/icon-192\.png/);
    expect(sw).toMatch(/icons\/icon-512\.png/);
    expect(sw).toMatch(/icons\/icon-512-maskable\.png/);
    expect(sw).toMatch(/icons\/apple-touch-icon\.png/);
  });

  it('the built index.html has iOS PWA meta tags (viewport-fit=cover, apple-mobile-web-app-capable)', () => {
    const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf-8');
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/apple-mobile-web-app-capable/);
    expect(html).toMatch(/apple-touch-icon/);
    expect(html).toMatch(/lang="zh-CN"/);
  });

  it('service worker does not attempt to cache/proxy IndexedDB or user-data-like network paths', () => {
    const sw = readFileSync(join(DIST_DIR, 'sw.js'), 'utf-8');
    // 不应该出现任何指向业务 API/数据端点的 runtime caching 规则——
    // 用户数据只走 IndexedDB，不应该有网络层的用户数据请求需要被 SW 处理
    expect(sw).not.toMatch(/\/api\//);
    expect(sw).not.toMatch(/indexedDB/i);
  });

  it('PNG icon files physically exist and are non-trivial in size', () => {
    const iconsDir = join(PROJECT_ROOT, 'public', 'icons');
    for (const file of ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png']) {
      const path = join(iconsDir, file);
      expect(existsSync(path), `missing icon: ${file}`).toBe(true);
      const stat = readFileSync(path);
      expect(stat.length).toBeGreaterThan(500); // 排除空文件/占位符
    }
  });
});
