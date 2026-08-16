import { cacheSize } from '@/lib/cache';
import { upstreamConfig } from '@/lib/chalaoshi';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游探测可能超过默认 10s, 放宽到 60s

/** 健康检查: 默认本地信息; ?probe=1 时真的去上游探测一次 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get('probe') === '1';
  const { webBases, apiBases } = upstreamConfig();

  const body: Record<string, unknown> = {
    ok: true,
    time: new Date().toISOString(),
    cacheEntries: cacheSize(),
    upstream: { web: webBases, api: apiBases },
  };

  if (probe) {
    try {
      const res = await fetch(webBases[0] + '/search?q=%E9%99%88%E5%BB%BA%E6%B5%B7', {
        headers: { 'User-Agent': 'chalaoshi-web/health' },
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      });
      body.upstreamProbe = { ok: res.ok, status: res.status };
      if (!res.ok) body.ok = false;
    } catch (e) {
      body.upstreamProbe = { ok: false, error: e instanceof Error ? e.message : String(e) };
      body.ok = false;
    }
  }

  return json(body, { status: body.ok ? 200 : 502 });
}
