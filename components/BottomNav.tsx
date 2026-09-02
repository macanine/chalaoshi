'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/',
    label: '查老师',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20.8 20.8 16.6 16.6" />
      </svg>
    ),
  },
  {
    href: '/course',
    label: '查绩点',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
        <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
      </svg>
    ),
  },
  {
    href: '/docs',
    label: 'API',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m8 9-3 3 3 3" />
        <path d="m16 9 3 3-3 3" />
        <path d="m13 6-2 12" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  // 老师详情页归入「查老师」tab; 其余按前缀匹配(如 /course/xxx 归入「查绩点」)
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname.startsWith('/teacher/');
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav className="bottom-nav" aria-label="底部导航">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={isActive(t.href) ? 'active' : ''}
          aria-current={isActive(t.href) ? 'page' : undefined}
        >
          {t.icon}
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
