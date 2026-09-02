/**
 * 客户端组件共用的小工具: API 错误信息提取、响应结构校验、URL 参数同步。
 * 各搜索/详情组件曾各自内联同一份逻辑, 统一收口到这里。
 */

/** 从 API 错误响应体提取 error 文案; 结构不符时返回 fallback */
export function apiError(data: unknown, fallback: string): string {
  return data !== null && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : fallback;
}

/** 读取 JSON 响应体; 解析失败时返回空对象(与各组件原先的 .catch(() => ({})) 行为一致) */
export async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/** 判断值是否为非空字符串(用于逐字段校验 API 响应) */
function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

/** 校验并收窄为安全整数(TS 的 Number.isSafeInteger 不收窄 unknown, 这里补一个类型守卫) */
export function isSafeInt(v: unknown): v is number {
  return Number.isSafeInteger(v);
}

// ---- 各 API 响应结构的运行时校验(与 lib/types.ts 一一对应) ----

import type {
  Comment,
  CourseGpa,
  GpaRow,
  TeacherDetail as TeacherDetailData,
  TeacherHit,
} from './types';

function isCourseGpa(v: unknown): v is CourseGpa {
  if (!v || typeof v !== 'object') return false;
  const c = v as Partial<CourseGpa>;
  return isStr(c.name) && isStr(c.gpa) && isStr(c.count);
}

export function isTeacherHit(value: unknown): value is TeacherHit {
  if (!value || typeof value !== 'object') return false;
  const hit = value as Partial<TeacherHit>;
  return isStr(hit.tid) && isStr(hit.name) && isStr(hit.college) && isStr(hit.score);
}

export function isGpaRow(value: unknown): value is GpaRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<GpaRow>;
  return isStr(row.teacher) && isStr(row.gpa) && isStr(row.count);
}

export function isComment(value: unknown): value is Comment {
  if (!value || typeof value !== 'object') return false;
  const comment = value as Partial<Comment>;
  return (
    isStr(comment.id) &&
    isStr(comment.content) &&
    typeof comment.likes === 'number' &&
    Number.isFinite(comment.likes) &&
    isStr(comment.date)
  );
}

export function isTeacherDetail(value: unknown): value is TeacherDetailData {
  if (!value || typeof value !== 'object') return false;
  const detail = value as Partial<TeacherDetailData>;
  return (
    isStr(detail.tid) &&
    isStr(detail.name) &&
    isStr(detail.college) &&
    isStr(detail.score) &&
    isStr(detail.ratingCount) &&
    isStr(detail.rollCallRate) &&
    isStr(detail.commentCount) &&
    Array.isArray(detail.courses) &&
    detail.courses.every(isCourseGpa)
  );
}

/** 把参数写入当前 URL(history.replaceState, 不产生新历史记录); 值为空时移除该参数 */
export function replaceUrlParam(key: string, value: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, '', url);
}
