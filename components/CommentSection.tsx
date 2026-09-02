'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Comment, CommentSort } from '@/lib/types';
import { apiError, isComment, isSafeInt, readJson } from '@/lib/apiClient';

const PAGE_SIZE = 20;

interface PageState {
  comments: Comment[];
  total: number;
  page: number;
}

function pageItems(current: number, total: number): Array<number | 'gap'> {
  const pages = new Set([1, current, total]);
  const ordered = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  let previous = 0;

  for (const page of ordered) {
    if (page > previous + 1) items.push('gap');
    items.push(page);
    previous = page;
  }

  return items;
}

/**
 * 显式页码分页的评论列表。
 * 每个排序和页码独立缓存；切换时保留上一页内容直到目标页准备好，避免整块闪烁。
 */
export default function CommentSection({
  tid,
  defaultSort = 'time',
}: {
  tid: string;
  defaultSort?: CommentSort;
}) {
  const [sort, setSort] = useState<CommentSort>(defaultSort);
  const [page, setPage] = useState(1);
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pagesRef = useRef(new Map<string, PageState>());
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const requestsRef = useRef(new Map<string, Promise<PageState>>());
  const controllersRef = useRef(new Map<string, AbortController>());

  const cacheKey = (s: CommentSort, targetPage: number) => `${s}:${targetPage}`;

  const loadPage = useCallback(
    (s: CommentSort, targetPage: number): Promise<PageState> => {
      const key = `${s}:${targetPage}`;
      const pending = requestsRef.current.get(key);
      if (pending) return pending;

      const controller = new AbortController();
      controllersRef.current.set(key, controller);
      const offset = (targetPage - 1) * PAGE_SIZE;
      const request = (async () => {
        const res = await fetch(`/api/comments/${tid}?sort=${s}&limit=${PAGE_SIZE}&offset=${offset}`, {
          signal: controller.signal,
        });
        const data = await readJson(res);
        if (!res.ok) throw new Error(apiError(data, '加载失败'));
        const comments = data.comments;
        const total = data.total;
        if (
          !Array.isArray(comments) ||
          !comments.every(isComment) ||
          !isSafeInt(total) ||
          total < 0
        ) {
          throw new Error('服务返回了无效的评论数据');
        }
        return { comments, total, page: targetPage };
      })();

      requestsRef.current.set(key, request);
      void request
        .finally(() => {
          requestsRef.current.delete(key);
          controllersRef.current.delete(key);
        })
        .catch(() => {});
      return request;
    },
    [tid]
  );

  const adopt = useCallback((s: CommentSort, state: PageState) => {
    setSort(s);
    setPage(state.page);
    setComments(state.comments);
    setTotal(state.total);
  }, []);

  function prefetchOtherSort(s: CommentSort) {
    const other: CommentSort = s === 'time' ? 'rate' : 'time';
    const key = cacheKey(other, 1);
    if (pagesRef.current.has(key)) return;

    loadPage(other, 1)
      .then((state) => pagesRef.current.set(key, state))
      .catch(() => {});
  }

  async function showPage(s: CommentSort, targetPage: number) {
    if (busyRef.current || targetPage < 1) return;
    busyRef.current = true;
    const seq = ++seqRef.current;
    const key = cacheKey(s, targetPage);
    setError(null);

    try {
      const cached = pagesRef.current.get(key);
      if (cached) {
        if (seq === seqRef.current) adopt(s, cached);
        return;
      }

      setLoading(true);
      const state = await loadPage(s, targetPage);
      if (seq !== seqRef.current) return;
      pagesRef.current.set(key, state);
      adopt(s, state);
      if (targetPage === 1) prefetchOtherSort(s);
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
    void showPage(defaultSort, 1);
    return () => {
      seqRef.current += 1;
      for (const controller of controllersRef.current.values()) controller.abort();
      controllersRef.current.clear();
      requestsRef.current.clear();
      pagesRef.current.clear();
    };
    // Initial load is scoped to this component instance, which is keyed by tid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section className="panel">
      <h2 className="section-title">评论</h2>
      <span className="visually-hidden">共 {total} 条, 老评论参考价值较低</span>

      {/* 排序切换用 button + aria-pressed 语义, 不用残缺的 tablist(缺 role=tab/aria-selected 反而误导读屏) */}
      <div className="tabs" aria-label="评论排序">
        <button
          type="button"
          className={`tab ${sort === 'time' ? 'active' : ''}`}
          onClick={() => void showPage('time', 1)}
          aria-pressed={sort === 'time'}
          disabled={loading}
        >
          最新
        </button>
        <button
          type="button"
          className={`tab ${sort === 'rate' ? 'active' : ''}`}
          onClick={() => void showPage('rate', 1)}
          aria-pressed={sort === 'rate'}
          disabled={loading}
        >
          人气
        </button>
      </div>

      {error && (
        <div className="comment-error">
          <div className="error-note">{error}</div>
          <button className="btn ghost" type="button" onClick={() => void showPage(sort, page)}>
            重试
          </button>
        </div>
      )}

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

      {!loading && comments.length === 0 && !error && <p className="results-count">还没有评论。</p>}

      {comments.map((comment) => (
        <article className="comment" key={comment.id}>
          <div className="comment-body">{comment.content}</div>
          <div className="comment-meta">
            <span className="comment-likes" aria-label={`${comment.likes} 个赞`}>▲ {comment.likes}</span>
            <span>{comment.date}</span>
          </div>
        </article>
      ))}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="评论分页" aria-busy={loading}>
          <button
            className="pagination-nav"
            type="button"
            onClick={() => void showPage(sort, page - 1)}
            disabled={loading || page === 1}
          >
            上一页
          </button>
          <div className="pagination-pages">
            {pageItems(page, totalPages).map((item, index) =>
              item === 'gap' ? (
                <span className="pagination-gap" key={`gap-${index}`}>...</span>
              ) : (
                <button
                  className={`pagination-page ${item === page ? 'active' : ''}`}
                  type="button"
                  key={item}
                  onClick={() => void showPage(sort, item)}
                  aria-current={item === page ? 'page' : undefined}
                  aria-label={`第 ${item} 页`}
                  disabled={loading}
                >
                  {item}
                </button>
              )
            )}
          </div>
          <button
            className="pagination-nav"
            type="button"
            onClick={() => void showPage(sort, page + 1)}
            disabled={loading || page === totalPages}
          >
            下一页
          </button>
        </nav>
      )}
    </section>
  );
}
