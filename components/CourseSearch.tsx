'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GpaRow } from '@/lib/types';
import GpaTable from './GpaTable';
import { clientCacheGet, clientCacheSet } from '@/lib/clientCache';

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
  const seqRef = useRef(0);

  const runSearch = useCallback(async (kw: string) => {
    const key = `gpa:${kw}`;
    const cached = clientCacheGet<GpaRow[]>(key);
    const seq = ++seqRef.current;

    setLoading(true);
    setError(null);
    setSearched(kw);
    if (cached) {
      setRows(cached);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/gpa?course=' + encodeURIComponent(kw));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '查询失败');
      const list = data.rows ?? [];
      clientCacheSet(key, list, CACHE_TTL_MS);
      if (seq !== seqRef.current) return;
      setRows(list);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(err instanceof Error ? err.message : '查询失败');
      setRows([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  // 支持从老师详情页带 ?course= 直达(新标签页)
  useEffect(() => {
    const kw = initialCourse.trim();
    if (kw) {
      setCourse(initialCourse);
      void runSearch(kw);
    }
  }, [initialCourse, runSearch]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function onInput(v: string) {
    setCourse(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    const kw = v.trim();
    if (!kw) {
      setRows(null);
      setSearched('');
      setError(null);
      setLoading(false);
      return;
    }
    if (composingRef.current) return;
    timerRef.current = setTimeout(() => void runSearch(kw), DEBOUNCE_MS);
  }

  function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
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
          {loading ? '查询中…' : '查询'}
        </button>
      </form>
      <p className="form-hint">输入即查 · 回车直达 · 支持课程名模糊匹配</p>

      {error && <div className="error-note">{error}</div>}

      {rows && (
        <p className="results-count">
          课程「{searched}」共 {rows.length} 位老师有绩点数据
        </p>
      )}

      {rows && <GpaTable rows={rows} />}
    </>
  );
}
