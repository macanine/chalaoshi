/**
 * 内存 TTL 缓存。挂到 globalThis 上以跨 Next.js 热重载复用。
 * 单进程部署足够; 多实例部署时各实例各自缓存, 无一致性问题。
 */

type CacheEntry<T> = { expires: number; value: T };

const store: Map<string, CacheEntry<unknown>> = (globalThis as { __chalaoshiCache?: Map<string, CacheEntry<unknown>> }).__chalaoshiCache ??= new Map();
const MAX_ENTRIES = 1_000;

function pruneExpired(now = Date.now()): void {
  for (const [key, entry] of store) {
    if (entry.expires >= now) continue;
    store.delete(key);
  }
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    store.delete(key);
    return;
  }

  const now = Date.now();
  pruneExpired(now);
  store.delete(key); // Map 保持插入顺序, 刷新命中项也应成为最新项
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  store.set(key, { expires: now + ttlMs, value });
}

export function cacheSize(): number {
  pruneExpired();
  return store.size;
}
