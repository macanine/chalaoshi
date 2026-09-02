'use client';

import { rgbToCss, scaleColor, scoreT, useThemeScale } from '@/lib/colorScale';

/**
 * 综合评分徽章。颜色按 0-10 分制绝对位置动态取色(6 分以下均为最低档橙色),
 * 主题自适应; N/A 用中性灰。同一色阶与课程绩点页一致。
 */
export default function ScoreBadge({ score }: { score: string }) {
  const stops = useThemeScale();
  const t = scoreT(score);
  const bg = stops && t !== null ? rgbToCss(scaleColor(t, stops)) : undefined;
  return (
    <span className={`score${t === null ? ' score-na' : ''}`} style={bg ? { background: bg } : undefined}>
      {score}
    </span>
  );
}
