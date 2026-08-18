import Link from 'next/link';
import type { GpaRow } from '@/lib/types';

function gpaNum(g: string): number {
  const n = parseFloat(g.split('±')[0]);
  return Number.isNaN(n) ? -1 : n;
}

export default function GpaTable({ rows }: { rows: GpaRow[] }) {
  const sorted = [...rows].sort((a, b) => gpaNum(b.gpa) - gpaNum(a.gpa));

  return (
    <section className="panel">
      <h2 className="section-title">各任课老师平均绩点</h2>
      <p className="section-sub">数据来自「课否」, 按平均绩点从高到低排列; 点老师名可直达其评价</p>

      {sorted.length === 0 ? (
        <p className="results-count">这门课还没有绩点数据。</p>
      ) : (
        <div className="course-grid">
          {sorted.map((r) => (
            <Link className="course-chip course-chip-link" href={`/?q=${encodeURIComponent(r.teacher)}`} key={r.teacher + r.gpa}>
              <span className="course-chip-name">{r.teacher}</span>
              <span className="course-chip-gpa">{r.gpa || '—'}</span>
              <span className="course-chip-count">{r.count ? `${r.count} 人` : '—'}</span>
            </Link>
          ))}
        </div>
      )}

      <p className="gpa-note">
        提示: 绩点为历史平均值, 含给分时效性; 数据来自愿意上报成绩的同学, 存在幸存者偏差。
      </p>
    </section>
  );
}
