'use client';

import Link from 'next/link';
import type { GpaRow } from '@/lib/types';
import { gpaNum, rgbToCss, scaleColor, useThemeScale } from '@/lib/colorScale';

export default function GpaTable({ rows, course = '' }: { rows: GpaRow[]; course?: string }) {
  const sorted = [...rows].sort((a, b) => gpaNum(b.gpa) - gpaNum(a.gpa));
  const nums = sorted.map((r) => gpaNum(r.gpa)).filter((n) => n >= 0);
  const max = nums.length ? Math.max(...nums) : null;
  const min = nums.length ? Math.min(...nums) : null;
  const range = max !== null && min !== null ? max - min : 0;

  // 动态色阶: 读取主题 tokens, 按数据区间插值取色
  const stops = useThemeScale();

  const colorFor = (v: number): string | undefined => {
    if (!stops || range <= 0 || max === null || min === null) return undefined;
    return rgbToCss(scaleColor((v - min) / range, stops));
  };

  return (
    <section className="panel">
      <div className="section-head">
        <h2 className="section-title">{course ? `「${course}」任课老师` : '任课老师'}</h2>
        <span className="section-count">{rows.length} 位老师</span>
      </div>
      <span className="visually-hidden">按平均绩点从高到低排列, 点老师名查看其评价</span>

      {sorted.length === 0 ? (
        <p className="results-count">这门课还没有绩点数据。</p>
      ) : (
        <ol className="gpa-rank">
          {sorted.map((r, i) => {
            const v = gpaNum(r.gpa);
            const color = v >= 0 ? colorFor(v) : undefined;
            return (
              <li key={`${r.teacher}-${r.gpa}-${i}`} style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}>
                <Link
                  className="gpa-rank-link"
                  href={`/?q=${encodeURIComponent(r.teacher)}`}
                  title={`查看 ${r.teacher} 的教评`}
                >
                  <span className={`gpa-rank-pos${i < 3 ? ' top' : ''}`}>{i + 1}</span>
                  <span className="gpa-rank-info">
                    <span className="gpa-rank-teacher">{r.teacher}</span>
                    <span className="gpa-rank-count">{r.count ? `${r.count} 人上报` : '无上报人数'}</span>
                  </span>
                  <span
                    className={`gpa-rank-val${v < 0 ? ' empty' : ''}`}
                    style={color ? { color } : undefined}
                  >
                    {r.gpa || '—'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
