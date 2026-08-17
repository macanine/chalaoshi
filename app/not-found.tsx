import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="empty">
      <h1>404</h1>
      <p>没有找到这个页面或老师。</p>
      <p>
        <Link className="btn" href="/">
          返回首页
        </Link>
      </p>
    </section>
  );
}
