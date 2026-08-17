'use client';

import { useEffect, useState } from 'react';

/** 显示 Skill 的实际地址和安装目录；安装后由兼容 Agent 自动发现。 */
export default function SkillGuide() {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const skillUrl = `${origin || 'https://chalaoshi.xhuya.cn'}/skills/course-schedule-planner/SKILL.md`;

  async function copyInstallInstruction() {
    const text = [
      skillUrl,
      '',
      '请安装并启用这个 Agent Skill。请读取上面的 SKILL.md，根据你当前 AI 工具支持的规范自行安装到可用的 skill 目录，安装完成后确认已启用。',
    ].join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="skill-guide" aria-labelledby="skill-guide-title">
      <div className="skill-guide-head">
        <div>
          <p className="skill-kicker">Agent Skill · course-schedule-planner</p>
          <h2 id="skill-guide-title">用 Skill 让 AI 帮你排课</h2>
        </div>
        <button className="btn docs-skill-btn" type="button" onClick={copyInstallInstruction}>
          {copied ? '已复制安装指令' : '复制给 AI 安装'}
        </button>
      </div>

      <ol className="skill-steps">
        <li>
          <strong>复制安装指令</strong>
          <span>点击上方按钮，复制 Skill 地址和安装要求。</span>
        </li>
        <li>
          <strong>粘贴给 AI</strong>
          <span>
            让 AI 自己读取地址，并安装到它支持的 skill 目录。
          </span>
        </li>
        <li>
          <strong>确认并使用</strong>
          <span>安装完成后，让 AI 处理选课、排课或比较老师给分。</span>
        </li>
      </ol>

      <div className="skill-use">
        <h3>使用时提供这些信息</h3>
        <p>学期、课程和班次时间（星期/节次）、学分、必修与可替换课程，以及你的偏好，例如稳 GPA、少早八或少空课。</p>
        <p>Skill 会先排除时间冲突，再综合平均绩点、近 180 天或当前学年的给分讨论、总体评分和高赞评价，给出推荐方案与备选方案。</p>
      </div>

    </section>
  );
}
