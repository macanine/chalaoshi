'use client';

import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';

/** 自动识别当前部署地址, 渲染基础 URL, 并提供「复制给 AI」按钮(内容是给 AI 用的 JSON 端点清单) */
export default function ApiDocsClient() {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function buildPrompt(base: string): string {
    return [
      '请使用以下 JSON API 查询浙江大学老师教评数据(代理自 chalaoshi.de):',
      '',
      `基础 URL: ${base}`,
      '',
      '端点(全部 GET, 支持 CORS):',
      JSON.stringify(API_ENDPOINTS, null, 2),
      '',
      `示例: curl "${base}/api/search?q=陈建海"`,
    ].join('\n');
  }

  async function copy() {
    const base = origin || window.location.origin;
    const text = buildPrompt(base);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 非 HTTPS 环境降级方案
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板被拒绝时静默 */
    }
  }

  return (
    <div className="docs-top">
      <div className="base-url">
        <span>基础 URL</span>
        <code>{origin || '…'}</code>
      </div>
      <button className="btn docs-copy-btn" onClick={copy} disabled={!origin}>
        {copied ? '已复制 ✓' : '复制给 AI 提示词'}
      </button>
    </div>
  );
}
