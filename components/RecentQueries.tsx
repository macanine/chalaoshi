'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { RecentCourse, RecentTeacher } from '@/lib/types';

type RecentKind = 'teacher' | 'course';
const MINIMUM_DISPLAY_ITEMS = 10;

function validItems(kind: RecentKind, value: unknown): RecentTeacher[] | RecentCourse[] {
  if (!Array.isArray(value)) return [];
  if (kind === 'teacher') {
    return value.filter(
      (item): item is RecentTeacher =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.name === 'string' &&
        (item.tid === undefined || typeof item.tid === 'string')
    );
  }
  return value.filter(
    (item): item is RecentCourse =>
      item !== null && typeof item === 'object' && typeof item.course === 'string'
  );
}

export default function RecentQueries({ kind }: { kind: RecentKind }) {
  const [items, setItems] = useState<RecentTeacher[] | RecentCourse[] | null>(null);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch('/api/recent', { cache: 'no-store', signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!active || !res.ok) return;
        const next = kind === 'teacher' ? data.teachers : data.courses;
        setItems(validItems(kind, next));
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setItems([]);
      }
    }

    void load();
    window.addEventListener('recent-queries-updated', load);
    window.addEventListener('pageshow', load);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('recent-queries-updated', load);
      window.removeEventListener('pageshow', load);
    };
  }, [kind]);

  if (!items?.length) return null;

  const isTeacher = kind === 'teacher';
  const entries = isTeacher
    ? (items as RecentTeacher[]).map((teacher) => ({
        id: teacher.tid ?? teacher.name,
        href: teacher.tid ? `/teacher/${teacher.tid}` : `/?q=${encodeURIComponent(teacher.name)}`,
        label: teacher.name,
      }))
    : (items as RecentCourse[]).map((course) => ({
        id: course.course,
        href: `/course?course=${encodeURIComponent(course.course)}`,
        label: course.course,
      }));
  const displayEntries = Array.from(
    { length: Math.ceil(MINIMUM_DISPLAY_ITEMS / entries.length) },
    () => entries
  )
    .flat()
    .slice(0, MINIMUM_DISPLAY_ITEMS);

  return (
    <section className="recent-queries" aria-label={isTeacher ? '全站最近访问的老师' : '全站最近查询的课程'}>
      <div className="recent-queries-viewport">
        <div className="recent-queries-track">
          {[0, 1].map((copy) => (
            <ul className="recent-queries-list" key={copy} aria-hidden={copy === 1 || undefined}>
              {displayEntries.map((entry, index) => (
                <li key={`${entry.id}-${index}`}>
                  <Link className="recent-query" href={entry.href} title={entry.label} tabIndex={copy === 1 ? -1 : undefined}>
                    <span className="recent-query-name">{entry.label}</span>
                    <span className="recent-query-arrow" aria-hidden="true">↗</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
