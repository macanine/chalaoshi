import Link from 'next/link';
import type { GpaRow } from '@/lib/types';

function gpaNum(g: string): number {
  const n = parseFloat(g.split('±')[0]);
  return Number.isNaN(n) ? -1 : n;
}

function gpaClass(g: string): string {
  const n = gpaNum(g);
  if (n >= 4.0) return 'high';
  if (n >= 3.5) return 'mid';
  return 'low';
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
        <div className="table-wrap">
          <table className="gpa">
            <thead>
              <tr>
                <th>老师</th>
                <th>平均绩点 ± 标准差</th>
                <th>人数</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.teacher + r.gpa}>
                  <td>
                    <Link className="gpa-teacher" href={`/?q=${encodeURIComponent(r.teacher)}`}>
                      {r.teacher}
                    </Link>
                  </td>
                  <td className={`gpa-val ${gpaClass(r.gpa)}`}>{r.gpa || '—'}</td>
                  <td>{r.count || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="gpa-note">
        提示: 绩点为历史平均值, 含给分时效性; 数据来自愿意上报成绩的同学, 存在幸存者偏差。
      </p>
    </section>
  );
}
