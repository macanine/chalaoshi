/** 结构化类型:与 chalaoshi.de 原始 HTML 一一对应, 由 lib/chalaoshi.ts 解析产出 */

export interface TeacherHit {
  tid: string;
  name: string;
  college: string;
  /** 评分字符串, 数据不足时为 'N/A' */
  score: string;
}

export interface CourseGpa {
  name: string;
  /** 平均绩点(可能含 ±std, 如 '3.76±0.31' 或 'N/A') */
  gpa: string;
  /** 参与人数(可能为空) */
  count: string;
}

export interface TeacherDetail {
  tid: string;
  name: string;
  college: string;
  score: string;
  ratingCount: string;
  /** 点名率, 如 '64.4%'; 人数不足时为 '数据不足' */
  rollCallRate: string;
  commentCount: string;
  courses: CourseGpa[];
}

export interface Comment {
  id: string;
  content: string;
  likes: number;
  /** 形如 2026.01.20 */
  date: string;
}

export interface GpaRow {
  teacher: string;
  /** 平均绩点 ± 标准差, 如 '3.76±0.31' */
  gpa: string;
  count: string;
}

export type CommentSort = 'time' | 'rate';
