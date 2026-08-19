// =========================================================
// i18n Entry Point — Phase 6.5
//
// 两种用法：
// 1. 纯静态短文案：t('nav.today') → '今天'
// 2. 需要插值的文案（数字、日期等）：直接用 copy 对象访问函数，
//    例如 copy.today.dayLabel(4, 1) → '第 4 天 · 第 1 周'
//
// 目前只有 zh-CN 一种语言，但结构上预留了未来接入其他语言
// （比如 en-US）的空间：只需要新增一个同结构的字典文件，
// 再让 getCopy() 根据语言设置返回对应字典即可，组件代码不需要改动。
// =========================================================
import zhCN from './zh-CN';

export type UICopy = typeof zhCN;

/** 目前固定返回中文字典；未来支持多语言时，这里改成根据用户设置切换 */
export function getCopy(): UICopy {
  return zhCN;
}

export const copy = getCopy();

/**
 * 简单的 dot-path 静态文案查找，仅适用于值是纯字符串的 key
 * （不适用于需要传参的函数型文案，那些请直接用 copy.xxx.yyy(...)）
 */
export function t(path: string): string {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = copy;
  for (const part of parts) {
    node = node?.[part];
  }
  if (typeof node !== 'string') {
    console.warn(`[i18n] Missing or non-string translation for key: "${path}"`);
    return path;
  }
  return node;
}

export default copy;
