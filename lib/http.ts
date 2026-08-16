/** API 路由公共工具: JSON 响应(带 CORS)、限流、错误映射 */

import { NextResponse } from 'next/server';
import { UpstreamError } from './chalaoshi';
import { rateLimit } from './ratelimit';

const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 60);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

/** 统一 JSON 响应, 附上允许跨域的头(方便 AI 工具/前端直接调用) */
export function json(data: unknown, init?: number | ResponseInit): NextResponse {
  const opts: ResponseInit = typeof init === 'number' ? { status: init } : init ?? {};
  const resp = NextResponse.json(data, opts);
  for (const [k, v] of Object.entries(CORS)) resp.headers.set(k, v);
  return resp;
}

function clientKey(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export function enforceRateLimit(req: Request): { ok: true } | { ok: false; res: NextResponse } {
  if (RATE_LIMIT_PER_MIN <= 0) return { ok: true };
  const r = rateLimit(clientKey(req), RATE_LIMIT_PER_MIN, 60_000);
  if (r.allowed) return { ok: true };
  return {
    ok: false,
    res: json(
      { error: 'rate_limited', retryAfter: r.retryAfter },
      { status: 429, headers: { 'Retry-After': String(r.retryAfter) } }
    ),
  };
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof UpstreamError) {
    const status = e.status >= 500 ? 502 : e.status >= 400 ? e.status : 502;
    return json({ error: e.message, upstreamStatus: e.status }, { status });
  }
  const msg = e instanceof Error ? e.message : String(e);
  return json({ error: 'internal_error', detail: msg }, { status: 500 });
}
