'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TeacherHit } from '@/lib/types';
import TeacherCard from './TeacherCard';
import { clientCacheGet, clientCacheSet } from '@/lib/clientCache';

const DEBOUNCE_MS = 300;
const CACHE_TTL_MS = 2 * 60 * 1000;

export default function TeacherSearch({ initialQ = '' }: { initialQ?: string }) {
  const [q, setQ] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherHit[] | null>(null);
  const [searched, setSearched] = useState('');

  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const runSearch = useCallback(async (kw: string) => {
    const key = `search:${kw}`;
    const cached = clientCacheGet<TeacherHit[]>(key);
    const seq = ++seqRef.current;

    setLoading(true);
    setError(null);
    setSearched(kw);
    if (cached) {
      setTeachers(cached);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(kw));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '查询失败');
      const list = data.teachers ?? [];
      clientCacheSet(key, list, CACHE_TTL_MS);
      if (seq !== seqRef.current) return; // 已被更新的请求取代
      setTeachers(list);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(err instanceof Error ? err.message : '查询失败');
      setTeachers([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  // 支持从首页带 ?q= 直达(例如从课程绩点里点老师名), 或在会话内更换初始词
  useEffect(() => {
    const kw = initialQ.trim();
    if (kw) {
      setQ(initialQ);
      runSearch(kw);
    }
  }, [initialQ, runSearch]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function onInput(v: string) {
    setQ(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    const kw = v.trim();
    if (!kw) {
      setTeachers(null);
      setSearched('');
      setError(null);
      setLoading(false);
      return;
    }
    // 输入法组合期间不触发, 等 compositionend 再搜
    if (composingRef.current) return;
    timerRef.current = setTimeout(() => void runSearch(kw), DEBOUNCE_MS);
  }

  function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    const kw = q.trim();
    if (!kw) return;
    void runSearch(kw);
  }

  return (
    <>
      <form className="search-form" onSubmit={doSearch} role="search">
        <input
          type="search"
          value={q}
          onChange={(e) => onInput(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            onInput((e.target as HTMLInputElement).value);
          }}
          placeholder="老师姓名或拼音, 如 陈建海 / chenjianhai"
          aria-label="搜索老师"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={!initialQ}
        />
        <button type="submit" disabled={loading || !q.trim()}>
          {loading ? '搜索中…' : '搜索'}
        </button>
      </form>

      {error && <div className="error-note">{error}</div>}

      {teachers !== null && (
        <>
          <p className="results-count">
            找到 {teachers.length} 位「{searched}」
          </p>
          {teachers.length > 0 ? (
            <ul className="teacher-list">
              {teachers.map((t, i) => (
                <li key={t.tid} style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}>
                  <TeacherCard teacher={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="results-count">没有匹配的老师(查老师上无记录)。</p>
          )}
        </>
      )}
    </>
  );
}
