import type { NextRequest } from 'next/server';
import { corsPreflight, enforceRateLimit, json } from '@/lib/http';
import { getRecentQueries } from '@/lib/recent';

export const dynamic = 'force-dynamic';
export const OPTIONS = corsPreflight;

/** 全站最近成功查询；记录由其他成功的服务端查询自动维护。 */
export function GET(req: NextRequest) {
  const rl = enforceRateLimit(req);
  if (!rl.ok) return rl.res;

  return json(getRecentQueries(), { headers: { 'Cache-Control': 'no-store' } });
}
