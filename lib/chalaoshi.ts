/**
 * chalaoshi.de 反向代理核心: 抓取上游 HTML 并解析为结构化 JSON。
 * 解析正则已对照线上 HTML 验证过, 不要凭感觉改。
 */

import { cacheGet, cacheSet } from './cache';
import type { Comment, CommentSort, CourseGpa, GpaRow, TeacherDetail, TeacherHit } from './types';

export interface UpstreamAttempt {
  base: string;
  code: string;
  message: string;
  upstreamStatus?: number;
}

export class UpstreamError extends Error {
  code: string;
  upstreamStatus?: number;
  attempts: UpstreamAttempt[];

  constructor(
    message: string,
    {
      code = 'upstream_unavailable',
      upstreamStatus,
      attempts = [],
    }: {
      code?: string;
      upstreamStatus?: number;
      attempts?: UpstreamAttempt[];
    } = {}
  ) {
    super(message);
    this.name = 'UpstreamError';
    this.code = code;
    this.upstreamStatus = upstreamStatus;
    this.attempts = attempts;
  }
}

const UA = 'Mozilla/5.0 (compatible; chalaoshi-web/1.0; +reverse-proxy)';

const DEFAULTS = { SEARCH: 60, TEACHER: 300, COMMENTS: 60, GPA: 1800 } as const;
type CacheKind = keyof typeof DEFAULTS;
const inFlight = new Map<string, Promise<unknown>>();

function ttlSeconds(kind: CacheKind): number {
  const v = Number(process.env[`CACHE_TTL_${kind}`]);
  return Number.isFinite(v) && v >= 0 ? Math.min(v, 86_400) : DEFAULTS[kind];
}

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return Promise.resolve(hit);

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      cacheSet(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

function parseBases(env: string | undefined, fallback: string): string[] {
  // env 与 fallback 都是逗号分隔的域名串, 统一按逗号拆(之前 fallback 分支漏拆,
  // 导致 next dev 里 env 未注入时把 "a.com,b.com" 当成了单个域名, 必 502)
  const raw = env && env.trim() ? env : fallback;
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// 环境变量一律在请求时读取(惰性): Cloudflare 的 env->process.env 填充发生在 worker 初始化
// 阶段之后, 模块加载时读会拿到空值而落到默认值; 惰性读取保证部署时配置的变量一定生效。
function getWebBases(): string[] {
  return parseBases(process.env.CHALAOSHI_WEB_BASE, 'https://dahua309.uk,https://chalaoshi.de');
}

function getApiBases(): string[] {
  return parseBases(process.env.CHALAOSHI_API_BASE, 'https://api.dahua309.uk,https://api.chalaoshi.de');
}

/** 全站同类服务兜底: 主域名列表全部失败(被拦/超时/5xx)后, 再试这里配的镜像站。
 *  逗号分隔; 留空则不启用。兜底站必须与上游返回同样结构的 HTML/JSON(同一 path), 例如本项目在另一平台的部署。 */
function getFallbackBases(): string[] {
  return parseBases(process.env.CHALAOSHI_FALLBACK, '');
}

function getTimeoutMs(): number {
  const value = Number(process.env.CHALAOSHI_TIMEOUT_MS ?? 8000);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 120_000) : 8000;
}

function getCooldownMs(): number {
  const value = Number(process.env.FAILOVER_COOLDOWN_MS ?? 60_000);
  return Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), 3_600_000) : 60_000;
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

/** 依次尝试一组域名: 跳过已熔断的, 失败即熔断并切下一个; 整组全失败才返回 { ok:false }。
 *  若所有域名都处于熔断冷却期, 仍按优先级真试一次——否则冷却期内整站一律快速 502,
 *  且上游恢复后也要等冷却结束才重新纳入, 无法立刻感知(曾因超时熔断所有域名导致整站静默 60s) */
async function tryBases(
  bases: string[],
  pathAndQuery: string
): Promise<{ ok: true; text: string } | { ok: false; error: UpstreamError }> {
  const probeAll = bases.length > 0 && bases.every((b) => isBaseDisabled(b));
  const attempts: UpstreamAttempt[] = [];
  let lastError: UpstreamError | null = null;
  for (const base of bases) {
    if (isBaseDisabled(base) && !probeAll) {
      attempts.push({ base, code: 'upstream_circuit_open', message: '该上游正在冷却，已跳过本次请求' });
      continue;
    }
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
        const attempt: UpstreamAttempt = {
          base,
          code: `upstream_http_${res.status}`,
          message: `上游返回 HTTP ${res.status}${res.statusText ? ` (${res.statusText})` : ''}`,
          upstreamStatus: res.status,
        };
        const err = new UpstreamError(attempt.message, {
          code: attempt.code,
          upstreamStatus: res.status,
          attempts: [...attempts, attempt],
        });
        if (isDomainLevelStatus(res.status)) disableBase(base);
        if (res.status === 404) return { ok: false, error: err };
        attempts.push(attempt);
        lastError = err;
        continue;
      }
      const text = await res.text();
      if (!text) {
        disableBase(base);
        const attempt: UpstreamAttempt = {
          base,
          code: 'upstream_empty_response',
          message: '上游返回空内容',
        };
        attempts.push(attempt);
        lastError = new UpstreamError(attempt.message, {
          code: attempt.code,
          attempts: [...attempts],
        });
        continue;
      }
      disabledUntil.delete(base); // 恢复成功, 立即解除该域熔断
      lastServedBase = base;
      return { ok: true, text };
    } catch (e) {
      // 网络错误 / 超时(AbortSignal.timeout): 域名不可达, 熔断
      disableBase(base);
      const isTimeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      const attempt: UpstreamAttempt = {
        base,
        code: isTimeout ? 'upstream_timeout' : 'upstream_network_error',
        message: isTimeout
          ? `上游请求超时（${getTimeoutMs()}ms）`
          : `无法连接上游：${e instanceof Error ? e.message : String(e)}`,
      };
      attempts.push(attempt);
      lastError = new UpstreamError(attempt.message, {
        code: attempt.code,
        attempts: [...attempts],
      });
    }
  }
  return {
    ok: false,
    error:
      lastError ??
      new UpstreamError('未配置可用的上游域名', {
        code: 'upstream_not_configured',
        attempts,
      }),
  };
}

/** 先按优先级试主域名列表, 全部失败再 fallback 到同类镜像站(CHALAOSHI_FALLBACK), 仍失败才抛错 */
async function fetchWithFailover(bases: string[], pathAndQuery: string): Promise<string> {
  const primary = await tryBases(bases, pathAndQuery);
  if (primary.ok) return primary.text;

  // 404 是资源层面"不存在"的确定答案, 同类镜像站也会 404, 不必再兜底
  if (primary.error.upstreamStatus === 404) throw primary.error;

  const fallback = getFallbackBases();
  if (fallback.length > 0) {
    const fb = await tryBases(fallback, pathAndQuery);
    if (fb.ok) return fb.text;
    throw new UpstreamError('主上游与兜底上游均不可用', {
      code: 'upstream_unavailable',
      attempts: [...primary.error.attempts, ...fb.error.attempts],
    });
  }

  throw new UpstreamError(primary.error.message, {
    code: primary.error.code,
    upstreamStatus: primary.error.upstreamStatus,
    attempts: primary.error.attempts,
  });
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
  return cached(key, ttlSeconds('SEARCH') * 1000, async () => {
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
    return hits;
  });
}

// ---------------------------------------------------------------- teacher detail
function parseGpaCount(raw: string): { gpa: string; count: string } {
  const idx = raw.lastIndexOf('/');
  if (idx === -1) return { gpa: raw, count: '' };
  return { gpa: raw.slice(0, idx).trim(), count: raw.slice(idx + 1).trim() };
}

export async function teacherDetail(tid: string): Promise<TeacherDetail> {
  const key = `teacher:${tid}`;
  return cached(key, ttlSeconds('TEACHER') * 1000, async () => {
    const body = await fetchWithFailover(getWebBases(), `/t/${tid}/`);

    const nameM = body.match(/class="teacher">[\s\S]*?<h3>([^<]+)<\/h3>/);
    const name = cleanHtml(nameM?.[1] ?? '');
    if (!name) {
      throw new UpstreamError('未找到该老师(可能不存在或已被删除)', {
        code: 'teacher_not_found',
      });
    }

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

    return {
      tid,
      name,
      college: cleanHtml(collegeM?.[1] ?? ''),
      score: rateM?.[1] ?? 'N/A',
      ratingCount: rateM?.[2] ?? '0',
      rollCallRate: attM ? attM[1] + '%' : '数据不足',
      commentCount: commM?.[1] ?? '0',
      courses,
    };
  });
}

// ---------------------------------------------------------------- comments
export async function fetchComments(tid: string, sort: CommentSort): Promise<Comment[]> {
  const key = `comments:${tid}:${sort}`;
  return cached(key, ttlSeconds('COMMENTS') * 1000, async () => {
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
    return comments;
  });
}

// ---------------------------------------------------------------- course gpa
export async function courseGpa(course: string): Promise<GpaRow[]> {
  const key = `gpa:${course}`;
  return cached(key, ttlSeconds('GPA') * 1000, async () => {
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
    return rows;
  });
}

export function upstreamConfig() {
  return {
    webBases: getWebBases(),
    apiBases: getApiBases(),
    fallbackBases: getFallbackBases(),
    timeoutMs: getTimeoutMs(),
    cooldownMs: getCooldownMs(),
    disabledBases: [...disabledUntil.keys()].filter((b) => isBaseDisabled(b)),
    lastServedBase,
  };
}
