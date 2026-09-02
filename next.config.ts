import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 站点只读、无第三方 iframe/表单提交需求, 统一收紧; Cloudflare 的 public/_headers 只盖静态资源,
  // 这里的头对所有路由(含 /api 与 Worker 部署)生效
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  // 显式指定 tracing 根为本站目录: pnpm 的 node_modules 是符号链接结构,
  // 不指明确的话 Next 可能误判工作区/仓库根, 导致构建产物 tracing 异常
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;

// OpenNext Cloudflare: 本地 next dev 时把 wrangler.jsonc 里的 vars/bindings 注入开发环境
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
