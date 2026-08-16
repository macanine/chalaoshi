import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 存在多个 lockfile 时(仓库根目录也有 package-lock.json), 显式指定 tracing 根为本站目录,
  // 避免 Next 误判工作区根导致构建产物 tracing 异常
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
