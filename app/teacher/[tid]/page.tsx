import TeacherDetail from '@/components/TeacherDetail';

// 详情页改为客户端按需加载(SPA 体验): 导航瞬间返回骨架屏, 数据走 /api/teacher/<tid>。
// 保留服务端包装以便 Next.js 处理 params / 未知路由。
export const dynamic = 'force-dynamic';

export default async function TeacherPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  return <TeacherDetail tid={tid} />;
}
