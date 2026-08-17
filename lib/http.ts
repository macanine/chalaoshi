/** API 路由公共工具: JSON 响应(带 CORS)、限流、错误映射 */

import { NextResponse } from 'next/server';
import { UpstreamError } from './chalaoshi';
import { rateLimit } from './ratelimit';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

const MAX_RATE_LIMIT_PER_MINUTE = 1_000;

/** 统一 JSON 响应, 附上允许跨域的头(方便 AI 工具/前端直接调用) */
export function json(data: unknown, init?: number | ResponseInit): NextResponse {
  const opts: ResponseInit = typeof init === 'number' ? { status: init } : init ?? {};
  const resp = NextResponse.json(data, opts);
  for (const [k, v] of Object.entries(CORS)) resp.headers.set(k, v);
  return resp;
}

/** 浏览器跨域预检。预检不访问上游，也不占用实际 API 请求配额。 */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function clientKey(req: Request): string {
  const forwarded =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local';
  return forwarded.slice(0, 64) || 'local';
}

function rateLimitPerMinute(): number {
  const value = Number(process.env.RATE_LIMIT_PER_MIN ?? 60);
  return Number.isInteger(value) && value >= 0 && value <= MAX_RATE_LIMIT_PER_MINUTE ? value : 60;
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

  return { error: '服务器内部错误', code: 'internal_error' };
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof UpstreamError) {
    const status = e.code === 'teacher_not_found' || e.upstreamStatus === 404 ? 404 : 502;
    return json(errorBody(e), { status });
  }
  console.error('Unhandled API error', e);
  return json(errorBody(e), { status: 500 });
}
