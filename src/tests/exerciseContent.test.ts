import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedWorkouts } from '../data/workouts.seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..'); // src/tests -> app root
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');

describe('exercise teaching content — in-app completeness (no external video required to understand)', () => {
  const allSteps = seedWorkouts.flatMap((w) => [w.warmup, ...w.exercises, w.cooldown]);

  it('every exercise has a non-empty value for every required teaching field', () => {
    for (const step of allSteps) {
      expect(step.name_display.length).toBeGreaterThan(0);
      expect(step.why.length).toBeGreaterThan(0);
      expect(step.start_position.length).toBeGreaterThan(0);
      expect(step.movement_steps.length).toBeGreaterThan(0);
      expect(step.reps_or_duration.length).toBeGreaterThan(0);
      expect(step.key_points.length).toBeGreaterThan(0);
      expect(step.common_mistakes.length).toBeGreaterThan(0);
      expect(step.stop_if.length).toBeGreaterThan(0);
    }
  });

  it('any external_video present is explicitly marked as supplementary', () => {
    for (const step of allSteps) {
      if (step.external_video) {
        expect(step.external_video.is_supplementary).toBe(true);
      }
    }
  });

  it('Workout A and Workout B both have warmup, 3 exercises, and cooldown', () => {
    for (const w of seedWorkouts) {
      expect(w.warmup).toBeDefined();
      expect(w.exercises.length).toBe(3);
      expect(w.cooldown).toBeDefined();
    }
  });
});

describe('exercise visual demonstrations — real SVG assets (Phase 4.5)', () => {
  const allSteps = seedWorkouts.flatMap((w) => [w.warmup, ...w.exercises, w.cooldown]);
  // 六个动作：warmup, chair-squat, wall-pushup, glute-bridge, bird-dog, cooldown
  const uniqueSteps = Array.from(new Map(allSteps.map((s) => [s.id, s])).values());

  it('all six exercises have a visual_demo with at least one frame', () => {
    expect(uniqueSteps.length).toBe(6);
    for (const step of uniqueSteps) {
      expect(step.visual_demo).toBeDefined();
      expect(step.visual_demo!.frames.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('multi-position exercises (squat/push-up/bridge/bird-dog) use 2-3 frames to show movement direction', () => {
    const multiFrameIds = ['chair-squat', 'wall-pushup', 'glute-bridge', 'bird-dog'];
    for (const step of uniqueSteps) {
      if (multiFrameIds.includes(step.id)) {
        expect(step.visual_demo!.frames.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('every referenced SVG asset actually exists on disk under /public', () => {
    for (const step of uniqueSteps) {
      for (const frame of step.visual_demo!.frames) {
        const filePath = join(PUBLIC_DIR, frame.asset_path.replace(/^\//, ''));
        expect(existsSync(filePath), `Missing asset: ${frame.asset_path}`).toBe(true);
      }
    }
  });

  it('every SVG asset is well-formed (starts with <svg, has closing tag, non-trivial size)', () => {
    for (const step of uniqueSteps) {
      for (const frame of step.visual_demo!.frames) {
        const filePath = join(PUBLIC_DIR, frame.asset_path.replace(/^\//, ''));
        const content = readFileSync(filePath, 'utf-8').trim();
        expect(content.startsWith('<svg')).toBe(true);
        expect(content.includes('</svg>')).toBe(true);
        expect(content.length).toBeGreaterThan(100); // 排除空/占位文件
      }
    }
  });

  // Phase 8 手动移动端 QA 发现：SVG 图片里手画的 <text> 说明曾经是英文，
  // 属于 Phase 4.5 遗留、Phase 6.5 本地化时漏检查的内容（因为它烧录在
  // 图片像素里，不是 React 渲染的字符串，文本扫描测试查不到）。
  // 这里直接读取 SVG 文件内容，确保图内文字是中文，防止再次回归。
  it('SVG asset internal <text> captions are Chinese, not leftover English (Phase 8 regression guard)', () => {
    const CJK = /[\u4e00-\u9fff]/;
    for (const step of uniqueSteps) {
      for (const frame of step.visual_demo!.frames) {
        const filePath = join(PUBLIC_DIR, frame.asset_path.replace(/^\//, ''));
        const content = readFileSync(filePath, 'utf-8');
        const textMatches = [...content.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];
        for (const match of textMatches) {
          expect(match[1], `English text found baked into ${frame.asset_path}: "${match[1]}"`).toMatch(CJK);
        }
      }
    }
  });

  it('every frame has a non-empty label and alt_text (accessibility + UI captions)', () => {
    for (const step of uniqueSteps) {
      for (const frame of step.visual_demo!.frames) {
        expect(frame.label.length).toBeGreaterThan(0);
        expect(frame.alt_text.length).toBeGreaterThan(0);
      }
    }
  });
});
