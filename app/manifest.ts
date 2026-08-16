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
      { src: '/icon.png', sizes: '150x150', type: 'image/png', purpose: 'any' },
      { src: '/icon.png', sizes: '150x150', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
