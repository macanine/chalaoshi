/** 极简滑动窗口限流, 保护上游 chalaoshi.de */

type Window = { timestamps: number[] };

const windows = new Map<string, Window>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  let win = windows.get(key);
  if (!win) {
    win = { timestamps: [] };
    windows.set(key, win);
  }
  while (win.timestamps.length && win.timestamps[0] <= now - windowMs) {
    win.timestamps.shift();
  }
  if (win.timestamps.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((win.timestamps[0] + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }
  win.timestamps.push(now);
  return { allowed: true, remaining: limit - win.timestamps.length, retryAfter: 0 };
}
