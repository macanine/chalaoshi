'use client';

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="empty">
      <h1>出错了</h1>
      <p>可能是上游 chalaoshi.de 暂时无法访问(需要科学上网或域名已更换)。</p>
      <p>
        <button type="button" className="btn" onClick={() => reset()}>
          重试
        </button>
      </p>
    </section>
  );
}
