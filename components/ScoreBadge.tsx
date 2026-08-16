/** 评分 → 颜色等级。导出一个纯函数供其他组件复用 */
export function scoreClass(score: string): string {
  const n = parseFloat(score);
  if (Number.isNaN(n)) return 'na';
  if (n >= 9) return 'good';
  if (n >= 8) return 'fine';
  if (n >= 7) return 'mid';
  if (n >= 6) return 'low';
  return 'bad';
}

export default function ScoreBadge({ score }: { score: string }) {
  return <span className={`score score-${scoreClass(score)}`}>{score}</span>;
}
