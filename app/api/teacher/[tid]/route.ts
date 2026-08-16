import type { NextRequest } from 'next/server';
import { teacherDetail } from '@/lib/chalaoshi';
import { enforceRateLimit, handleError, json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游抓取可能超过默认 10s, 放宽到 60s

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tid: string }> }
) {
  const rl = enforceRateLimit(req);
  if (!rl.ok) return rl.res;

  const { tid } = await ctx.params;
  if (!/^\d+$/.test(tid)) {
    return json({ error: 'tid 必须是数字' }, { status: 400 });
  }

  try {
    const detail = await teacherDetail(tid);
    return json(detail);
  } catch (e) {
    return handleError(e);
  }
}
