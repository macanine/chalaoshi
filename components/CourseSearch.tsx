'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GpaRow } from '@/lib/types';
import { apiError, isGpaRow, readJson, replaceUrlParam } from '@/lib/apiClient';
import { clientCacheGet, clientCacheSet } from '@/lib/clientCache';
import GpaTable from './GpaTable';
import RecentQueries from './RecentQueries';

const DEBOUNCE_MS = 300;
const CACHE_TTL_MS = 10 * 60 * 1000;

export default function CourseSearch({ initialCourse = '' }: { initialCourse?: string }) {
  const [course, setCourse] = useState(initialCourse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GpaRow[] | null>(null);
  const [searched, setSearched] = useState('');

  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const runSearch = useCallback(async (kw: string) => {
    const key = `gpa:${kw}`;
    const cached = clientCacheGet<GpaRow[]>(key);
    requestRef.current?.abort();
    const seq = ++seqRef.current;

    setLoading(true);
    setError(null);
    setSearched(kw);
    if (cached) {
      requestRef.current = null;
      setRows(cached);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const res = await fetch('/api/gpa?course=' + encodeURIComponent(kw), { signal: controller.signal });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiError(data, '查询失败'));
      if (!Array.isArray(data.rows) || !data.rows.every(isGpaRow)) {
        throw new Error('服务返回了无效的绩点数据');
      }
      const list: GpaRow[] = data.rows;
      clientCacheSet(key, list, CACHE_TTL_MS);
      if (seq !== seqRef.current) return;
      if (list.length > 0) window.dispatchEvent(new Event('recent-queries-updated'));
      setRows(list);
      // 课程词同步到 URL: 刷新不丢词, 结果可直接分享(仅替换历史, 不产生新记录)
      replaceUrlParam('course', kw);
    } catch (err) {
      if (seq !== seqRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // 失败时保持 rows 为 null, 只显示错误——不要误显示"还没有绩点数据"
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      if (seq === seqRef.current) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  // 支持从老师详情页带 ?course= 直达(新标签页)
  useEffect(() => {
    const kw = initialCourse.trim();
    if (kw) {
      setCourse(initialCourse);
      void runSearch(kw);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    requestRef.current?.abort();
    seqRef.current += 1;
    setCourse('');
    setLoading(false);
    setError(null);
    setRows(null);
    setSearched('');
  }, [initialCourse, runSearch]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    requestRef.current?.abort();
    seqRef.current += 1;
  }, []);

  function onInput(v: string) {
    setCourse(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    requestRef.current?.abort();
    seqRef.current += 1;
    setLoading(false);
    setRows(null);
    setSearched('');
    setError(null);
    const kw = v.trim();
    if (!kw) {
      return;
    }
    if (composingRef.current) return;
    timerRef.current = setTimeout(() => void runSearch(kw), DEBOUNCE_MS);
  }

  function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (composingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const kw = course.trim();
    if (!kw) return;
    void runSearch(kw);
  }

  return (
    <>
      <form className="search-form" onSubmit={doSearch} role="search">
        <input
          type="search"
          value={course}
          onChange={(e) => onInput(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            onInput((e.target as HTMLInputElement).value);
          }}
          placeholder="课程名, 如 程序设计基础及实验 / 高等数学"
          aria-label="搜索课程"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={!initialCourse}
        />
        <button type="submit" disabled={loading || !course.trim()}>
          {loading ? '搜索中…' : '搜索'}
        </button>
      </form>

      {!course.trim() && !searched && <RecentQueries kind="course" />}

      {error && <div className="error-note">{error}</div>}

      {rows && <GpaTable rows={rows} course={searched} />}
    </>
  );
}
