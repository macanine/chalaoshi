/** API 路由公共工具: JSON 响应(带 CORS)、限流、错误映射 */

import { NextResponse } from 'next/server';
import { UpstreamError } from './chalaoshi';
import { rateLimit } from './ratelimit';

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
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local'
  );
}

function rateLimitPerMinute(): number {
  const value = Number(process.env.RATE_LIMIT_PER_MIN ?? 60);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 60;
}

export function enforceRateLimit(req: Request): { ok: true } | { ok: false; res: NextResponse } {
  const limit = rateLimitPerMinute();
  if (limit <= 0) return { ok: true };
  const r = rateLimit(clientKey(req), limit, 60_000);
  if (r.allowed) return { ok: true };
  return {
    ok: false,
    res: json(
      { error: `请求过于频繁，请在 ${r.retryAfter} 秒后重试`, code: 'rate_limited', retryAfter: r.retryAfter },
      { status: 429, headers: { 'Retry-After': String(r.retryAfter) } }
    ),
  };
}

export function errorBody(e: unknown): Record<string, unknown> {
  if (e instanceof UpstreamError) {
    return {
      error: e.message,
      code: e.code,
      ...(e.upstreamStatus !== undefined ? { upstreamStatus: e.upstreamStatus } : {}),
      ...(e.attempts.length > 0 ? { upstreamAttempts: e.attempts } : {}),
    };
  }

  const detail = e instanceof Error ? e.message : String(e);
  return { error: '服务器内部错误', code: 'internal_error', detail };
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof UpstreamError) {
    const status = e.code === 'teacher_not_found' || e.upstreamStatus === 404 ? 404 : 502;
    return json(errorBody(e), { status });
  }
  return json(errorBody(e), { status: 500 });
}
