# chalaoshi

浙江大学「查老师」(chalaoshi.de) 匿名教评系统的反向代理镜像：抓取上游 HTML 解析为结构化 JSON，并提供搜索 / 详情 / 评论 / 绩点查询的前端界面。

- 纯 Next.js 15 + React 19 + TypeScript，零其他运行时依赖
- 服务端内存缓存 + 滑动窗口限流，多域名自动 failover
- 响应式 UI，明暗双主题，支持 PWA

## 快速开始

```bash
npm install
cp .env.example .env.local   # 按需修改
npm run dev                  # http://localhost:3000
```

生产部署：

```bash
npm run build
npm start
```

> 运行机器需能访问 chalaoshi.de（通常要科学上网）。上游域名经常更换，换域名时只改环境变量即可，无需改代码。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CHALAOSHI_WEB_BASE` | `https://chalaoshi.de` | 网页域，逗号分隔多个，按顺序 failover |
| `CHALAOSHI_API_BASE` | `https://api.chalaoshi.de` | API 域（评论 / 绩点），同样支持 failover |
| `CHALAOSHI_TIMEOUT_MS` | `20000` | 上游请求超时（毫秒） |
| `CACHE_TTL_SEARCH` | `60` | 搜索结果缓存（秒） |
| `CACHE_TTL_TEACHER` | `300` | 老师详情缓存（秒） |
| `CACHE_TTL_COMMENTS` | `60` | 评论缓存（秒） |
| `CACHE_TTL_GPA` | `1800` | 绩点缓存（秒） |
| `RATE_LIMIT_PER_MIN` | `60` | 每 IP 每分钟 API 上限，`0` 关闭 |

## API

所有端点返回 JSON、带 CORS。`GET /api` 返回端点索引，`GET /api/docs` 有渲染版文档。

| 端点 | 说明 |
|---|---|
| `GET /api/search?q=<姓名或拼音>` | 搜索老师，返回候选列表 |
| `GET /api/teacher/<tid>` | 老师详情：评分、点名率、评论数、课程绩点 |
| `GET /api/comments/<tid>?sort=time\|rate&limit=&offset=` | 评论分页，返回 `total` / `hasMore` |
| `GET /api/gpa?course=<课程名>` | 该课各任课老师的平均绩点 |
| `GET /api/health[?probe=1]` | 存活检查；`probe=1` 时真实探测上游 |

```bash
curl 'http://localhost:3000/api/search?q=陈建海'
```

错误响应形如 `{ "error": "...", "upstreamStatus"?: 502 }`：404 老师不存在，429 限流（带 `retryAfter`），502 上游不可达。

## Vercel 部署

项目根目录即 Next.js 应用，`vercel.json` 已内置。API 路由设置了 `maxDuration = 60`（上游抓取可能超过默认 10s）。在 Vercel 关联仓库后，按 `.env.example` 配置环境变量即可，至少要有 `CHALAOSHI_WEB_BASE` / `CHALAOSHI_API_BASE`。

部署后查不到数据时，用 `/api/health?probe=1` 探测上游连通性（上游不通通常是域名已更换）。

## 数据说明

数据来自 chalaoshi.de 匿名用户与「课否」，存在幸存者偏差，给分也有时效性——判断"给分捞不捞"建议以近期评论为准。本项目为只读代理，内置限流与缓存以减少对上游的压力。
