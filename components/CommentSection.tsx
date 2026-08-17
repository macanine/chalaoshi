'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Comment, CommentSort } from '@/lib/types';

const PAGE = 20;

interface PageState {
  comments: Comment[];
  total: number;
  offset: number;
}

/**
 * 评论列表。
 * 平滑切换优化:
 *  - 每种排序独立缓存(pages), 已看过的排序切回是瞬间的;
 *  - 首次加载完某排序后, 后台预取另一种排序的第一页, 下次切换不再等网络;
 *  - 切换时保留当前列表, 不整块闪烁; 同一时刻只允许一个请求(单飞), 避免竞态。
 */
export default function CommentSection({
  tid,
  defaultSort = 'time',
}: {
  tid: string;
  defaultSort?: CommentSort;
}) {
  const [sort, setSort] = useState<CommentSort>(defaultSort);
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = useRef<Partial<Record<CommentSort, PageState>>>({});
  const sortRef = useRef(sort);
  sortRef.current = sort;
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestsRef = useRef(new Map<string, Promise<PageState>>());

  const loadPage = useCallback(
    (s: CommentSort, off: number): Promise<PageState> => {
      const key = `${s}:${off}`;
      const pending = requestsRef.current.get(key);
      if (pending) return pending;

      const request = (async () => {
        const res = await fetch(`/api/comments/${tid}?sort=${s}&limit=${PAGE}&offset=${off}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '加载失败');
        const comments: Comment[] = data.comments ?? [];
        return { comments, total: data.total ?? 0, offset: off + comments.length };
      })();
      requestsRef.current.set(key, request);
      void request.finally(() => requestsRef.current.delete(key)).catch(() => {});
      return request;
    },
    [tid]
  );

  const adopt = useCallback((s: CommentSort, st: PageState) => {
    setComments(st.comments);
    setTotal(st.total);
    setOffset(st.offset);
  }, []);

  /** 后台预取另一种排序的第一页, 让之后的切换秒开 */
  function prefetchOther(s: CommentSort) {
    const other: CommentSort = s === 'time' ? 'rate' : 'time';
    if (pages.current[other]) return;
    loadPage(other, 0)
      .then((od) => {
        const existing = pages.current[other];
        if (!existing || existing.offset === 0) pages.current[other] = od;
      })
      .catch(() => {});
  }

  /** 加载(或复用)某个排序并切换过去 */
  async function loadSort(s: CommentSort) {
    if (busyRef.current) return;
    busyRef.current = true;
    const seq = ++seqRef.current;
    setSort(s);
    setError(null);
    try {
      const cached = pages.current[s];
      if (cached) {
        adopt(s, cached);
        return;
      }
      setLoading(true);
      const st = await loadPage(s, 0);
      if (seq !== seqRef.current) return;
      pages.current[s] = st;
      adopt(s, st);
      prefetchOther(s);
    } catch (err) {
      if (seq === seqRef.current) setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (seq === seqRef.current) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }

  function onSwitch(s: CommentSort) {
    if (s === sortRef.current || busyRef.current) return;
    void loadSort(s);
  }

  async function loadMore() {
    if (busyRef.current) return;
    const s = sortRef.current;
    const st = pages.current[s];
    if (!st || st.offset >= st.total) return;
    busyRef.current = true;
    const seq = ++seqRef.current;
    setError(null);
    setLoading(true);
    try {
      const next = await loadPage(s, st.offset);
      if (seq !== seqRef.current) return;
      const merged: PageState = {
        comments: [...st.comments, ...next.comments],
        total: next.total,
        offset: next.offset,
      };
      pages.current[s] = merged;
      adopt(s, merged);
    } catch (err) {
      if (seq === seqRef.current) setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (seq === seqRef.current) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadSort(defaultSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 滚动接近底部自动加载下一页; 哨兵元素始终渲染, 由回调判断是否值得加载
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const st = pages.current[sortRef.current];
          if (st && st.offset < st.total && !busyRef.current) void loadMore();
        }
      },
      { rootMargin: '400px 0px' }
    );
    ob.observe(el);
    return () => ob.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMore = offset < total;

  return (
    <section className="panel">
      <h2 className="section-title">评论</h2>
      <p className="section-sub">
        共 {total} 条。老评论参考价值低, 判断当前给分请以近期为主。
      </p>

      <div className="tabs" role="tablist" aria-label="评论排序">
        <button
          className={`tab ${sort === 'time' ? 'active' : ''}`}
          onClick={() => onSwitch('time')}
          aria-pressed={sort === 'time'}
        >
          最新
        </button>
        <button
          className={`tab ${sort === 'rate' ? 'active' : ''}`}
          onClick={() => onSwitch('rate')}
          aria-pressed={sort === 'rate'}
        >
          人气
        </button>
      </div>

      {error && <div className="error-note">{error}</div>}

      {loading && comments.length === 0 && (
        <div className="comment-list-skeleton" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div className="comment" key={i}>
              <div className="skeleton" style={{ height: 14, width: '92%' }} />
              <div className="skeleton" style={{ height: 14, width: '68%', marginTop: 8 }} />
              <div className="skeleton" style={{ height: 11, width: 120, marginTop: 10 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && comments.length === 0 && !error && (
        <p className="results-count">还没有评论。</p>
      )}

      {comments.length > 0 &&
        comments.map((c) => (
          <article className="comment" key={c.id}>
            <div className="comment-body">{c.content}</div>
            <div className="comment-meta">
              <span className="comment-likes" aria-label={`${c.likes} 个赞`}>
                ▲ {c.likes}
              </span>
              <span>{c.date}</span>
            </div>
          </article>
        ))}

      <div ref={sentinelRef} className="load-more">
        {hasMore &&
          (loading ? (
            <span className="spinner" role="status" aria-label="加载中" />
          ) : (
            <button className="btn ghost" onClick={() => void loadMore()} disabled={loading}>
              加载更多 ({comments.length}/{total})
            </button>
          ))}
      </div>
    </section>
  );
}
