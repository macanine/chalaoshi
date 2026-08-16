/** API 端点清单: 同一份数据同时喂给 /api 的 JSON 索引与 /docs 文档页 */

export interface ApiEndpoint {
  method: string;
  path: string;
  returns: string;
  example: string;
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/search?q=<名字或拼音>',
    returns: '教师候选列表: tid / 姓名 / 学院 / 评分',
    example: '/api/search?q=陈建海',
  },
  {
    method: 'GET',
    path: '/api/teacher/<tid>',
    returns: '老师详情: 评分 / 打分人数 / 点名率 / 课程绩点 / 评论数',
    example: '/api/teacher/1902',
  },
  {
    method: 'GET',
    path: '/api/comments/<tid>?sort=time|rate&limit=20&offset=0',
    returns: '评论列表(带 total, 支持分页与排序; sort=time 最新 / rate 人气)',
    example: '/api/comments/1902?sort=time&limit=20',
  },
  {
    method: 'GET',
    path: '/api/gpa?course=<课程名>',
    returns: '该课全体任课老师的平均绩点±标准差与人数',
    example: '/api/gpa?course=程序设计基础及实验',
  },
  { method: 'GET', path: '/api/health', returns: '代理存活与上游配置', example: '/api/health' },
];
