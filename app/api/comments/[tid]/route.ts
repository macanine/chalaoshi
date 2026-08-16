import type { NextRequest } from 'next/server';
import { fetchComments } from '@/lib/chalaoshi';
import { enforceRateLimit, handleError, json } from '@/lib/http';
import type { CommentSort } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游抓取可能超过默认 10s, 放宽到 60s

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

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

  const sp = req.nextUrl.searchParams;
  const sort: CommentSort = sp.get('sort') === 'rate' ? 'rate' : 'time';
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  try {
    const all = await fetchComments(tid, sort);
    const comments = all.slice(offset, offset + limit);
    return json({
      tid,
      sort,
      total: all.length,
      offset,
      limit,
      hasMore: offset + limit < all.length,
      comments,
    });
  } catch (e) {
    return handleError(e);
  }
}
