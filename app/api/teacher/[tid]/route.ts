import type { NextRequest } from 'next/server';
import { teacherDetail } from '@/lib/chalaoshi';
import { corsPreflight, enforceRateLimit, handleError, json } from '@/lib/http';
import { recordRecentTeacher } from '@/lib/recent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游抓取可能超过默认 10s, 放宽到 60s
export const OPTIONS = corsPreflight;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tid: string }> }
) {
  const rl = enforceRateLimit(req);
  if (!rl.ok) return rl.res;

  const { tid } = await ctx.params;
  if (!/^\d{1,20}$/.test(tid)) {
    return json({ error: 'tid 必须是 1 至 20 位数字', code: 'invalid_tid' }, { status: 400 });
  }

  try {
    const detail = await teacherDetail(tid);
    recordRecentTeacher(detail);
    return json(detail);
  } catch (e) {
    return handleError(e);
  }
}
