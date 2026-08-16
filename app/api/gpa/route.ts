import type { NextRequest } from 'next/server';
import { courseGpa } from '@/lib/chalaoshi';
import { enforceRateLimit, handleError, json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游抓取可能超过默认 10s, 放宽到 60s

export async function GET(req: NextRequest) {
  const rl = enforceRateLimit(req);
  if (!rl.ok) return rl.res;

  const course = req.nextUrl.searchParams.get('course')?.trim();
  if (!course) return json({ error: '参数缺失: 需要 course (课程名)' }, { status: 400 });

  try {
    const rows = await courseGpa(course);
    return json({ course, count: rows.length, rows });
  } catch (e) {
    return handleError(e);
  }
}
