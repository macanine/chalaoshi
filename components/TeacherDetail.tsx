'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CommentSection from './CommentSection';
import { scoreClass } from './ScoreBadge';
import type { TeacherDetail as TeacherDetailData } from '@/lib/types';
import { clientCacheGet, clientCacheSet } from '@/lib/clientCache';

type State =
  | { status: 'loading' }
  | { status: 'ready'; d: TeacherDetailData }
  | { status: 'error'; message: string; is404: boolean };

const CACHE_TTL_MS = 5 * 60 * 1000;

export default function TeacherDetail({ tid }: { tid: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const key = `teacher:${tid}`;
    const cached = clientCacheGet<TeacherDetailData>(key);

    (async () => {
      if (cached) {
        setState({ status: 'ready', d: cached });
        document.title = `${cached.name} · ${cached.college} · 查老师`;
        return;
      }
      setState({ status: 'loading' });
      try {
        const res = await fetch(`/api/teacher/${tid}`, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setState({ status: 'error', message: data.error || '加载失败', is404: res.status === 404 });
          return;
        }
        clientCacheSet(key, data, CACHE_TTL_MS);
        setState({ status: 'ready', d: data });
        document.title = `${data.name} · ${data.college} · 查老师`;
      } catch (err) {
        if (!alive) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({ status: 'error', message: '网络异常, 请重试', is404: false });
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [tid]);

  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label="加载老师详情">
        <section className="panel" aria-hidden="true">
          <div className="teacher-header-top">
            <div style={{ flex: 1 }}>
              {/* 姓名条按真实中文名宽度(2-4字)定宽, 不要用百分比——在宽容器里会撑得巨大 */}
              <div className="skeleton" style={{ width: 100, height: 32 }} />
              <div className="skeleton" style={{ width: 190, height: 18, marginTop: 10 }} />
            </div>
            <div className="skeleton" style={{ width: 72, height: 56, borderRadius: 12 }} />
          </div>
          <div className="stats">
            {[0, 1, 2].map((i) => (
              <div className="stat" key={i}>
                <div className="skeleton" style={{ width: 48, height: 22 }} />
                <div className="skeleton" style={{ width: 60, height: 14, marginTop: 6 }} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel" aria-hidden="true">
          <div className="skeleton" style={{ width: 120, height: 20 }} />
          <div className="course-grid" style={{ marginTop: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <div className="skeleton" key={i} style={{ height: 90, borderRadius: 10 }} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="empty panel">
        <h1>{state.is404 ? '没有找到这位老师' : '出错了'}</h1>
        <p>
          {state.is404
            ? '该老师可能不存在或已被删除。'
            : '可能是上游 chalaoshi.de 暂时无法访问(需要科学上网或域名已更换)。'}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>{state.message}</p>
        <p>
          <Link className="btn" href="/">
            返回搜索
          </Link>
        </p>
      </section>
    );
  }

  const d = state.d;

  return (
    <>
      <Link className="back-link" href="/">
        ← 返回搜索
      </Link>

      <section className="panel">
        <div className="teacher-header-top">
          <div>
            <h1 className="teacher-name">{d.name}</h1>
            <p className="teacher-college">{d.college}</p>
          </div>
          <div className="teacher-score">
            <span className={`score-big ${scoreClass(d.score)}`}>{d.score}</span>
            <span className="teacher-score-label">综合评分</span>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-num">{d.ratingCount}</span>
            <span className="stat-label">人参与评分</span>
          </div>
          <div className="stat">
            <span className="stat-num">{d.rollCallRate}</span>
            <span className="stat-label">认为老师会点名</span>
          </div>
          <div className="stat">
            <span className="stat-num">{d.commentCount}</span>
            <span className="stat-label">条评论</span>
          </div>
        </div>
      </section>

      {d.courses.length > 0 && (
        <section className="panel">
          <h2 className="section-title">课程绩点</h2>
          <p className="section-sub">来自「课否」, 格式: 平均绩点 / 人数</p>
          <div className="course-grid">
            {d.courses.map((c) => (
              <a
                className="course-chip course-chip-link"
                key={c.name}
                href={`/course?course=${encodeURIComponent(c.name)}`}
                target="_blank"
                rel="noreferrer"
                title={`新标签页查「${c.name}」的绩点`}
              >
                <span className="course-chip-name">{c.name}</span>
                <span className="course-chip-gpa">{c.gpa}</span>
                {c.count && <span className="course-chip-count">{c.count} 人</span>}
              </a>
            ))}
          </div>
        </section>
      )}

      <CommentSection key={tid} tid={tid} />
    </>
  );
}
