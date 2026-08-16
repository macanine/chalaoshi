import { cacheSize } from '@/lib/cache';
import { searchTeachers, upstreamConfig } from '@/lib/chalaoshi';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游探测可能超过默认 10s, 放宽到 60s

/** 健康检查: 默认本地信息; ?probe=1 时真实走一次搜索(经过 failover + 熔断) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get('probe') === '1';
  const { webBases, apiBases, fallbackBases, disabledBases, lastServedBase } = upstreamConfig();

  const body: Record<string, unknown> = {
    ok: true,
    time: new Date().toISOString(),
    cacheEntries: cacheSize(),
    upstream: { web: webBases, api: apiBases, fallback: fallbackBases, disabled: disabledBases },
    lastServedBase,
  };

  if (probe) {
    try {
      const hits = await searchTeachers('陈建海');
      body.upstreamProbe = { ok: true, hits: hits.length, servedBy: upstreamConfig().lastServedBase };
    } catch (e) {
      body.upstreamProbe = { ok: false, error: e instanceof Error ? e.message : String(e) };
      body.ok = false;
    }
  }

  return json(body, { status: body.ok ? 200 : 502 });
}
