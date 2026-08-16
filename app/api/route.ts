import { API_ENDPOINTS } from '@/lib/apiEndpoints';
import { upstreamConfig } from '@/lib/chalaoshi';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 上游抓取可能超过默认 10s, 放宽到 60s

/** API 索引: 结构化 JSON, 直接给 AI / 开发者用。人类看的渲染版在 /docs。 */
export function GET() {
  const { webBases, apiBases, disabledBases } = upstreamConfig();
  return json({
    name: 'chalaoshi-web API',
    docs: '/docs',
    description:
      '浙江大学「查老师」(chalaoshi.de) 匿名教评系统的数据接口。代理上游页面并解析为结构化 JSON 返回。',
    note: '所有端点都支持 CORS 与内存缓存; 数据存在幸存者偏差, 给分有时效性。',
    upstream: { web: webBases, api: apiBases, disabled: disabledBases },
    endpoints: API_ENDPOINTS,
  });
}
