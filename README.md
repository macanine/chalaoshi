# 查老师 · web 镜像 (chalaoshi-web)

浙江大学「查老师」(chalaoshi.de) 匿名教评系统的 **反向代理镜像**:

- **结构化 JSON API** —— 把上游的 HTML 页面解析成干净的数据, 以 JSON 返回;
- **清爽 UI** —— 搜老师、看详情(评分/点名率/课程绩点/评论分页)、按课程对比绩点;
- **比原站更好用**: 评论可分页、排序、多域名自动 failover、内存缓存、深色模式。

## 快速开始

```bash
cd web
npm install
cp .env.example .env.local   # 按需修改
npm run dev                  # http://localhost:3000
```

生产部署:

```bash
npm run build
npm start
```

> 运行机器需要能访问 chalaoshi.de(通常要科学上网)。域名经常更换, 换域名时只改环境变量即可, 无需改代码。

## Vercel 部署

项目已内置 `vercel.json` 与路由级 `maxDuration`(API 抓上游可能超过 Vercel 默认的 10s, 已放宽到 60s)。

```bash
vercel          # 按提示选择 Root Directory = web, 关联仓库即可
```

1. **Root Directory 设为 `web`**(项目在仓库子目录);
2. 在 Vercel 项目设置里配置环境变量(与下表一致, 至少 `CHALAOSHI_WEB_BASE` / `CHALAOSHI_API_BASE`);
3. 部署后若查不到数据, 用 `/api/health?probe=1` 探测上游连通性(上游不通通常是域名已更换, 改环境变量即可)。

> 注意: 内存缓存与限流是**每个函数实例各自一份**, Vercel 按需伸缩导致缓存命中率低于单机, 属正常现象。若上游很慢, 可调低 `CHALAOSHI_TIMEOUT_MS`(如 `8000`)让超时更快失败。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CHALAOSHI_WEB_BASE` | `https://chalaoshi.de` | 网页域, 逗号分隔多个, 按顺序 failover |
| `CHALAOSHI_API_BASE` | `https://api.chalaoshi.de` | API 域(评论/绩点), 同样支持 failover |
| `CHALAOSHI_TIMEOUT_MS` | `20000` | 上游请求超时 |
| `CACHE_TTL_*` | 60/300/60/1800s | search/teacher/comments/gpa 缓存时长(秒) |
| `RATE_LIMIT_PER_MIN` | `60` | 每 IP 每分钟 API 上限, `0` 关闭 |

## API(给 AI 用)

所有端点返回 JSON、带 CORS, 走同一套缓存 + 限流。`GET /api` 返回端点清单。

### 1. 搜老师 `GET /api/search?q=<名字或拼音>`

```bash
curl 'http://localhost:3000/api/search?q=陈建海'
```

```json
{
  "q": "陈建海",
  "count": 1,
  "teachers": [{ "tid": "1902", "name": "陈建海", "college": "计算机科学与技术学院", "score": "9.8" }]
}
```

### 2. 老师详情 `GET /api/teacher/<tid>`

```bash
curl 'http://localhost:3000/api/teacher/1902'
```

```json
{
  "tid": "1902",
  "name": "陈建海",
  "college": "计算机科学与技术学院",
  "score": "9.84",
  "ratingCount": "473",
  "rollCallRate": "19.9%",
  "commentCount": "395",
  "courses": [{ "name": "C程序设计基础及实验", "gpa": "4.16", "count": "204" }]
}
```

### 3. 评论 `GET /api/comments/<tid>?sort=time|rate&limit=20&offset=0`

`sort=time` 最新在前, `sort=rate` 赞最多在前。已分页, 响应含 `total` / `hasMore`。

```bash
curl 'http://localhost:3000/api/comments/1902?sort=rate&limit=20'
```

```json
{
  "tid": "1902",
  "sort": "rate",
  "total": 395,
  "offset": 0,
  "limit": 20,
  "hasMore": true,
  "comments": [{ "id": "17295", "content": "陈老师的人格魅力……", "likes": 188, "date": "2017.12.19" }]
}
```

### 4. 课程绩点 `GET /api/gpa?course=<课程名>`

列出该课所有任课老师的平均绩点 ± 标准差。

```bash
curl 'http://localhost:3000/api/gpa?course=程序设计基础及实验'
```

```json
{
  "course": "程序设计基础及实验",
  "count": 11,
  "rows": [{ "teacher": "陈建海", "gpa": "4.16±0.5", "count": "204" }]
}
```

### 5. 健康检查 `GET /api/health` 与 `GET /api/health?probe=1`(真实探测上游)

## AI 使用建议

数据本身即结构化 JSON, 直接喂给模型即可。判断"给分捞不捞"时建议:

1. `GET /api/teacher/<tid>` 看综合评分与课程绩点;
2. `GET /api/comments/<tid>?sort=time&limit=20` 取**最近 20 条**评论(老评论参考价值低, 给分方式可能已变);
3. `GET /api/comments/<tid>?sort=rate&limit=10` 看口碑;
4. 引用绩点时核对是否与所问课程一致(`/api/teacher/<tid>` 的 `courses` 里课程名相似才算)。

## 说明

- 数据来自 chalaoshi.de 匿名用户与「课否」, 存在幸存者偏差, 给分有时效性;
- 这是对第三方网站的只读代理, 遵守对方站点条款; 内置限流与缓存以减少上游压力;
- 项目自带 skill(`.claude/skills/chalaoshi/`)与插件包(`chalaoshi-plugin/`), 本 `web/` 是独立的 Next.js 应用。
