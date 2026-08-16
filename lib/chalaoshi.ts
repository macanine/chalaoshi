/**
 * chalaoshi.de 反向代理核心: 抓取上游 HTML 并解析为结构化 JSON。
 * 解析正则直接移植自 .claude/skills/chalaoshi/scripts/chalaoshi.py (线上验证过), 不要凭感觉改。
 */

import { cacheGet, cacheSet } from './cache';
import type { Comment, CommentSort, CourseGpa, GpaRow, TeacherDetail, TeacherHit } from './types';

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

const UA = 'Mozilla/5.0 (compatible; chalaoshi-web/1.0; +reverse-proxy)';

const DEFAULTS = { SEARCH: 60, TEACHER: 300, COMMENTS: 60, GPA: 1800 } as const;
type CacheKind = keyof typeof DEFAULTS;

function ttlSeconds(kind: CacheKind): number {
  const v = Number(process.env[`CACHE_TTL_${kind}`]);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULTS[kind];
}

function parseBases(env: string | undefined, fallback: string): string[] {
  if (env && env.trim()) {
    return env
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }
  return [fallback];
}

// 环境变量一律在请求时读取(惰性): Cloudflare 的 env->process.env 填充发生在 worker 初始化
// 阶段之后, 模块加载时读会拿到空值而落到默认值; 惰性读取保证部署时配置的变量一定生效。
function getWebBases(): string[] {
  return parseBases(process.env.CHALAOSHI_WEB_BASE, 'https://dahua309.uk,https://chalaoshi.de');
}

function getApiBases(): string[] {
  return parseBases(process.env.CHALAOSHI_API_BASE, 'https://api.dahua309.uk,https://api.chalaoshi.de');
}

function getTimeoutMs(): number {
  return Number(process.env.CHALAOSHI_TIMEOUT_MS ?? 1000);
}

function getCooldownMs(): number {
  return Number(process.env.FAILOVER_COOLDOWN_MS ?? 60_000);
}

// ---- 域级故障熔断: 某域名失败(CF 拦截/超时/5xx/空响应)后, 冷却期内跳过它, 冷却结束自动恢复 ----
const disabledUntil = new Map<string, number>();
let lastServedBase: string | null = null;

function isBaseDisabled(base: string): boolean {
  const until = disabledUntil.get(base);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    disabledUntil.delete(base); // 冷却结束, 重新纳入轮换
    return false;
  }
  return true;
}

function disableBase(base: string): void {
  disabledUntil.set(base, Date.now() + getCooldownMs());
}

/** 该状态码说明"这个域名本身坏了"(Cloudflare 拦截 / 上游故障 / 限流), 应熔断; 404 之类是资源层面, 不熔断 */
function isDomainLevelStatus(status: number): boolean {
  return status === 403 || status === 408 || status === 429 || status >= 500;
}

/** 依次尝试多个域名: 跳过已熔断的, 失败即熔断并切下一个, 全部失败才抛错(域名经常换, failover 提升可用性) */
async function fetchWithFailover(bases: string[], pathAndQuery: string): Promise<string> {
  let lastError: unknown;
  for (const base of bases) {
    if (isBaseDisabled(base)) continue;
    try {
      const res = await fetch(base + pathAndQuery, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
        },
        signal: AbortSignal.timeout(getTimeoutMs()),
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = new UpstreamError(`上游返回 HTTP ${res.status} (${res.statusText})`, res.status);
        if (isDomainLevelStatus(res.status)) disableBase(base);
        lastError = err;
        continue;
      }
      const text = await res.text();
      if (!text) {
        disableBase(base);
        lastError = new UpstreamError('上游返回空内容', 502);
        continue;
      }
      lastServedBase = base;
      return text;
    } catch (e) {
      // 网络错误 / 超时(AbortSignal.timeout): 域名不可达, 熔断
      disableBase(base);
      lastError = e;
    }
  }
  if (lastError instanceof UpstreamError) throw lastError;
  throw new UpstreamError(`无法连接上游 ${bases.join(', ')} (需要科学上网或域名已更换)`, 502);
}

/** 去掉标签与 HTML 实体, 压缩空白 */
function cleanHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- search
export async function searchTeachers(q: string): Promise<TeacherHit[]> {
  const key = `search:${q}`;
  const cached = cacheGet<TeacherHit[]>(key);
  if (cached) return cached;

  const path = '/search?' + new URLSearchParams({ q }).toString();
  const body = await fetchWithFailover(getWebBases(), path);

  const re =
    /class="item"[^>]*window\.location='\/t\/(\d+)\/'[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<p>([^<]*)<\/p>[\s\S]*?<h2>([^<]+)<\/h2>/g;
  const hits: TeacherHit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    hits.push({
      tid: m[1],
      name: cleanHtml(m[2]),
      college: cleanHtml(m[3]),
      score: cleanHtml(m[4]),
    });
  }
  cacheSet(key, hits, ttlSeconds('SEARCH') * 1000);
  return hits;
}

// ---------------------------------------------------------------- teacher detail
function parseGpaCount(raw: string): { gpa: string; count: string } {
  const idx = raw.lastIndexOf('/');
  if (idx === -1) return { gpa: raw, count: '' };
  return { gpa: raw.slice(0, idx).trim(), count: raw.slice(idx + 1).trim() };
}

export async function teacherDetail(tid: string): Promise<TeacherDetail> {
  const key = `teacher:${tid}`;
  const cached = cacheGet<TeacherDetail>(key);
  if (cached) return cached;

  const body = await fetchWithFailover(getWebBases(), `/t/${tid}/`);

  const nameM = body.match(/class="teacher">[\s\S]*?<h3>([^<]+)<\/h3>/);
  const name = cleanHtml(nameM?.[1] ?? '');
  if (!name) throw new UpstreamError('未找到该老师(可能不存在或已被删除)', 404);

  const collegeM = body.match(/<p id="cmcinfo">[^<]*<\/p>\s*<p>([^<]+)<\/p>/);
  const rateM = body.match(/<div class="right">\s*<h2>([0-9.]+|N\/A)<\/h2>\s*<p>(\d+)人参与评分/);
  const attM = body.match(/([\d.]+)%的人认为该老师会点名/);
  const commM = body.match(/(\d+)个评论/);

  const courses: CourseGpa[] = [];
  const courseRe = /class="course_name">([^<]+)<\/p>\s*<\/div>\s*<div class="right">\s*<p>([^<]+)<\/p>/g;
  let cm: RegExpExecArray | null;
  while ((cm = courseRe.exec(body))) {
    const { gpa, count } = parseGpaCount(cleanHtml(cm[2]));
    courses.push({ name: cleanHtml(cm[1]), gpa, count });
  }

  const detail: TeacherDetail = {
    tid,
    name,
    college: cleanHtml(collegeM?.[1] ?? ''),
    score: rateM?.[1] ?? 'N/A',
    ratingCount: rateM?.[2] ?? '0',
    rollCallRate: attM ? attM[1] + '%' : '数据不足',
    commentCount: commM?.[1] ?? '0',
    courses,
  };
  cacheSet(key, detail, ttlSeconds('TEACHER') * 1000);
  return detail;
}

// ---------------------------------------------------------------- comments
export async function fetchComments(tid: string, sort: CommentSort): Promise<Comment[]> {
  const key = `comments:${tid}:${sort}`;
  const cached = cacheGet<Comment[]>(key);
  if (cached) return cached;

  const body = await fetchWithFailover(getApiBases(), `/comments/${tid}?sort=${sort}`);

  const comments: Comment[] = [];
  // 前 10 条为排序头部, 其余用 <hr id="sep"> 分隔; 解析整段即可拿到全部评论(顺序与上游排序一致)
  const re =
    /id="comment-page">[\s\S]*?<p>([\s\S]*?)<\/p>\s*<\/div>\s*<div class="right">\s*<a class="up[^"]*" id="like_(\d+)"[^>]*>[^<]*<\/a>\s*<p class="\d+-count">([^<]*)<\/p>\s*<a class="down[^"]*" id="dislike_\d+"[^>]*>[^<]*<\/a>\s*<\/div>\s*<\/div>\s*<p class="comment-footer">发布于&nbsp;([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const digits = (m[3].match(/\d+/g) ?? []).join('');
    comments.push({
      id: m[2],
      content: cleanHtml(m[1]),
      likes: digits ? Number(digits) : 0,
      date: m[4],
    });
  }
  cacheSet(key, comments, ttlSeconds('COMMENTS') * 1000);
  return comments;
}

// ---------------------------------------------------------------- course gpa
export async function courseGpa(course: string): Promise<GpaRow[]> {
  const key = `gpa:${course}`;
  const cached = cacheGet<GpaRow[]>(key);
  if (cached) return cached;

  const body = await fetchWithFailover(getApiBases(), '/gpa?' + new URLSearchParams({ course }).toString());

  const rows: GpaRow[] = [];
  const re =
    /<tr[^>]*>\s*<td class="course_name">([^<]+)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    rows.push({
      teacher: cleanHtml(m[1]),
      gpa: cleanHtml(m[2]),
      count: cleanHtml(m[3]),
    });
  }
  cacheSet(key, rows, ttlSeconds('GPA') * 1000);
  return rows;
}

export function upstreamConfig() {
  return {
    webBases: getWebBases(),
    apiBases: getApiBases(),
    timeoutMs: getTimeoutMs(),
    cooldownMs: getCooldownMs(),
    disabledBases: [...disabledUntil.keys()].filter((b) => isBaseDisabled(b)),
    lastServedBase,
  };
}
