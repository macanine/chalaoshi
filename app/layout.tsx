import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: { default: '查老师 · 浙大匿名教评', template: '%s · 查老师' },
  description:
    '浙江大学非官方匿名教评系统(chalaoshi.de)镜像——查老师评分、点名率、评论, 对比课程绩点。数据来自匿名用户与「课否」。',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    title: '查老师',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  other: {
    'msapplication-TileColor': '#2f6df6',
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1013' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link className="brand" href="/" aria-label="查老师首页">
              查<span>老师</span>
            </Link>
            <nav className="nav" aria-label="主导航">
              <Link href="/">查老师</Link>
              <Link href="/course">查课程绩点</Link>
              <Link href="/docs">API</Link>
            </nav>
            <a
              className="github-link"
              href="https://github.com/macanine/chalaoshi"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 仓库(新标签页打开)"
              title="GitHub 仓库"
            >
              <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </a>
          </div>
        </header>
        <main className="container main">{children}</main>
        <BottomNav />
        <footer className="site-footer">
          <div className="container">
            <span className="site-pv" id="vercount_container_site_pv">
              本站访问 <span className="site-pv-value" id="vercount_value_site_pv" aria-live="polite">000000</span> 次
            </span>
          </div>
        </footer>
        <Script src="https://events.vercount.one/js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
