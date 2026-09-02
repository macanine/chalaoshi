import { corsPreflight, json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = corsPreflight;

/** /api 下的未知路径兜底: 按项目契约返回 JSON 而非 HTML 404(具体路由优先级高于 catch-all, 不影响现有端点) */
export function GET() {
  return json(
    { error: '未知的 API 端点, 见 /api 索引或 /docs', code: 'not_found' },
    { status: 404 }
  );
}

export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
export const PATCH = GET;
