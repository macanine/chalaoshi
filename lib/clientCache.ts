/**
 * 轻量会话缓存: 客户端搜索结果的模块级缓存, 避免重复请求同一关键词。
 * 仅做短期缓存(TTL 默认 2 分钟), 用于提升输入即搜的响应速度。
 */

const store = new Map<string, { value: unknown; expires: number }>();

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
  store.set(key, { value, expires: Date.now() + ttlMs });
}
