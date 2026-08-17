/**
 * 服务端全站最近查询。只由成功的老师详情和课程绩点请求写入；客户端只读。
 * 与现有服务端缓存一样，数据随当前运行实例存活，并限制容量避免无界增长。
 */

import type { RecentCourse, RecentQueries, RecentTeacher, TeacherDetail } from './types';

const MAX_RECENT_ITEMS = 20;

const DEFAULT_TEACHERS: RecentTeacher[] = [
  '翁恺',
  '竺可桢',
  '康熙',
  '张我华',
  '陈建海',
  '金日成',
  '张丰',
  '沈红',
].map((name) => ({ name }));

const DEFAULT_COURSES: RecentCourse[] = [
  '电路与电子技术Ⅰ',
  '嵌入式系统',
  'Python程序设计',
  '天文学导论',
  '数字电路分析与设计',
].map((course) => ({ course }));

type RecentStore = {
  teachers: RecentTeacher[];
  courses: RecentCourse[];
};

const store: RecentStore =
  (globalThis as typeof globalThis & { __chalaoshiRecentQueries?: RecentStore }).__chalaoshiRecentQueries ??=
    { teachers: [], courses: [] };

export function recordRecentTeacher(detail: TeacherDetail): void {
  const teacher: RecentTeacher = {
    tid: detail.tid,
    name: detail.name,
    college: detail.college,
  };
  store.teachers = [teacher, ...store.teachers.filter((item) => item.tid !== teacher.tid)].slice(
    0,
    MAX_RECENT_ITEMS
  );
}

export function recordRecentCourse(course: string): void {
  const name = course.trim();
  if (!name) return;

  const item: RecentCourse = { course: name };
  store.courses = [item, ...store.courses.filter((entry) => entry.course !== item.course)].slice(
    0,
    MAX_RECENT_ITEMS
  );
}

export function getRecentQueries(): RecentQueries {
  const teachers = mergeWithDefaults(store.teachers, DEFAULT_TEACHERS, (item) => item.name);
  const courses = mergeWithDefaults(store.courses, DEFAULT_COURSES, (item) => item.course);

  return {
    teachers,
    courses,
  };
}

function mergeWithDefaults<T>(recent: T[], defaults: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return [...recent, ...defaults].filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, MAX_RECENT_ITEMS);
}
