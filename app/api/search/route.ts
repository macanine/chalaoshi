import type { NextRequest } from 'next/server';
import { searchTeachers } from '@/lib/chalaoshi';
import { enforceRateLimit, handleError, json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游抓取可能超过默认 10s, 放宽到 60s

export async function GET(req: NextRequest) {
  const rl = enforceRateLimit(req);
  if (!rl.ok) return rl.res;

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return json({ error: '参数缺失: 需要 q (老师姓名或拼音)', code: 'missing_query' }, { status: 400 });
  if (q.length > 100) return json({ error: 'q 最长为 100 个字符', code: 'query_too_long' }, { status: 400 });

  try {
    const teachers = await searchTeachers(q);
    return json({ q, count: teachers.length, teachers });
  } catch (e) {
    return handleError(e);
  }
}
