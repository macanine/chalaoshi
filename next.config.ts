import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 显式指定 tracing 根为本站目录: pnpm 的 node_modules 是符号链接结构,
  // 不指明确的话 Next 可能误判工作区/仓库根, 导致构建产物 tracing 异常
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;

// OpenNext Cloudflare: 本地 next dev 时把 wrangler.jsonc 里的 vars/bindings 注入开发环境
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
