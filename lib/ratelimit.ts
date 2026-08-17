/** 极简滑动窗口限流, 保护上游 chalaoshi.de */

type Window = { timestamps: number[]; lastSeen: number };

const windows = new Map<string, Window>();
const MAX_CLIENTS = 5_000;
let nextPruneAt = 0;

function pruneWindows(now: number, windowMs: number): void {
  for (const [key, win] of windows) {
    if (win.lastSeen > now - windowMs) continue;
    windows.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  if (now >= nextPruneAt) {
    pruneWindows(now, windowMs);
    nextPruneAt = now + Math.min(windowMs, 60_000);
  }
  let win = windows.get(key);
  if (!win) {
    while (windows.size >= MAX_CLIENTS) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
    win = { timestamps: [], lastSeen: now };
    windows.set(key, win);
  }
  win.lastSeen = now;
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
