import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '查老师 · 浙大匿名教评',
    short_name: '查老师',
    description:
      '查浙大老师评分、点名率、评论, 对比课程绩点。数据来自 chalaoshi.de 匿名用户与「课否」。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0e1013',
    theme_color: '#2f6df6',
    lang: 'zh-CN',
    icons: [
      // 192/512 是 Android 安装到主屏 / 应用列表的必需尺寸; maskable 需要更大的安全边距
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.png', sizes: '150x150', type: 'image/png', purpose: 'any' },
      { src: '/icon.png', sizes: '150x150', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
