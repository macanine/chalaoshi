import type { NextRequest } from 'next/server';
import { fetchComments } from '@/lib/chalaoshi';
import { corsPreflight, enforceRateLimit, handleError, json } from '@/lib/http';
import type { CommentSort } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游抓取可能超过默认 10s, 放宽到 60s
export const OPTIONS = corsPreflight;

const MAX_LIMIT = 100;
const MAX_OFFSET = 100_000;
const DEFAULT_LIMIT = 20;

function parseInteger(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number | null {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

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

  const sp = req.nextUrl.searchParams;
  const sortParam = sp.get('sort') ?? 'time';
  if (sortParam !== 'time' && sortParam !== 'rate') {
    return json({ error: 'sort 只能是 time 或 rate', code: 'invalid_sort' }, { status: 400 });
  }
  const sort: CommentSort = sortParam;
  const offset = parseInteger(sp.get('offset'), 0, 0, MAX_OFFSET);
  const limit = parseInteger(sp.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  if (offset === null || limit === null) {
    return json(
      {
        error: `offset 必须是 0 至 ${MAX_OFFSET} 的整数，limit 必须是 1 至 ${MAX_LIMIT} 的整数`,
        code: 'invalid_pagination',
      },
      { status: 400 }
    );
  }

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
