/**
 * 内存 TTL 缓存。挂到 globalThis 上以跨 Next.js 热重载复用。
 * 单进程部署足够; 多实例部署时各实例各自缓存, 无一致性问题。
 */

type CacheEntry<T> = { expires: number; value: T };

const store: Map<string, CacheEntry<unknown>> = (globalThis as { __chalaoshiCache?: Map<string, CacheEntry<unknown>> }).__chalaoshiCache ??= new Map();

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
  store.set(key, { expires: Date.now() + ttlMs, value });
}

export function cacheSize(): number {
  return store.size;
}
