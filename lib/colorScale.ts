/**
 * 动态色阶: 按位置 t∈[0,1] 在 橙 → 琥珀 → 青 → 绿 之间分段插值取色。
 * 端点颜色读取 CSS tokens(--orange/--amber/--teal/--green), 明暗主题各自的值,
 * 无需在 JS 里维护两份配色。
 *
 * 使用约定:
 * - 集合内公平比较(同一门课的不同老师 / 同一位老师的不同课程)→ 相对区间 t=(v-min)/(max-min);
 * - 孤立单值(老师综合评分, 0-10 分制)→ 绝对位置 scoreT()。
 */
import { useEffect, useState } from 'react';

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** 浅色主题 tokens 的值: SSR(无 document)与变量缺失时的兜底 */
const STOPS_FALLBACK: Rgb[] = ['#d9650f', '#c98a0a', '#0f9d8f', '#1f9d55'].map((h) => hexToRgb(h)!);

function readCssVar(name: string, fallback: string): Rgb {
  if (typeof document === 'undefined') return hexToRgb(fallback)!;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return hexToRgb(v || fallback) ?? hexToRgb(fallback)!;
}

/** 读取当前主题的色阶端点 */
export function readThemeScale(): Rgb[] {
  return [
    readCssVar('--orange', '#d9650f'),
    readCssVar('--amber', '#c98a0a'),
    readCssVar('--teal', '#0f9d8f'),
    readCssVar('--green', '#1f9d55'),
  ];
}

/** 挂载后读取主题色阶; 系统明暗切换时自动更新。未挂载时返回 null, 调用方用默认色兜底。 */
export function useThemeScale(): Rgb[] | null {
  const [stops, setStops] = useState<Rgb[] | null>(null);
  useEffect(() => {
    const apply = () => setStops(readThemeScale());
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return stops;
}

/** t∈[0,1] → 插值颜色(内部已 clamp); 端点不足时退回默认色阶 */
export function scaleColor(t: number, stops: Rgb[]): Rgb {
  const s = stops.length >= 2 ? stops : STOPS_FALLBACK;
  const n = s.length - 1;
  const pos = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(pos), n - 1);
  return mix(s[i], s[i + 1], pos - i);
}

export function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** 老师综合评分(0-10 分制)→ 原始数值; 无效(N/A 等)返回 null */
export function scoreNum(score: string): number | null {
  const n = parseFloat(score);
  return Number.isNaN(n) ? null : n;
}

/** 老师综合评分(0-10 分制)→ 绝对位置 t∈[0,1](6 分以下都算最低档); 无效返回 null */
export function scoreT(score: string): number | null {
  const n = scoreNum(score);
  if (n === null) return null;
  return Math.min(Math.max((n - 6) / 4, 0), 1);
}

/** 平均绩点字符串(可含 ±std, 如 '3.76±0.31')→ 数值; 无效返回 -1 */
export function gpaNum(g: string): number {
  const n = parseFloat(g.split('±')[0]);
  return Number.isNaN(n) ? -1 : n;
}
