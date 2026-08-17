/**
 * 轻量会话缓存: 客户端搜索结果的模块级缓存, 避免重复请求同一关键词。
 * 仅做短期缓存(TTL 默认 2 分钟), 用于提升输入即搜的响应速度。
 */

const store = new Map<string, { value: unknown; expires: number }>();
const MAX_ENTRIES = 100;

function pruneExpired(now = Date.now()): void {
  for (const [key, entry] of store) {
    if (entry.expires >= now) continue;
    store.delete(key);
  }
}

export function clientCacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function clientCacheSet<T>(key: string, value: T, ttlMs = 2 * 60 * 1000): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    store.delete(key);
    return;
  }

  const now = Date.now();
  pruneExpired(now);
  store.delete(key);
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  store.set(key, { value, expires: now + ttlMs });
}
