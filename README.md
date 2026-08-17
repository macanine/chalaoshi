# chalaoshi

浙江大学「查老师」(chalaoshi.de) 匿名教评系统的**反向代理镜像**：抓取上游 HTML 解析为结构化 JSON，提供老师搜索 / 详情 / 评论 / 课程绩点查询的 API 与响应式前端界面。

- **技术栈**：Next.js 15 (App Router) + React 19 + TypeScript，运行时零其他依赖；包管理用 pnpm
- **健壮性**：多域名 failover + 失败域名自动熔断冷却恢复 + 同类镜像站兜底（`CHALAOSHI_FALLBACK`）
- **前端**：响应式 UI、明暗双主题、PWA（可添加到主屏）
- **接口**：所有 API 返回 JSON、带 CORS，内置内存缓存与滑动窗口限流

## 快速开始

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

生产运行：`pnpm build && pnpm start`。

> 本地开发机器需能访问上游域（通常要科学上网）。默认上游域名已内置，无需任何配置；要覆盖时复制 `.env.example` 为 `.env.local` 再改。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CHALAOSHI_WEB_BASE` | `https://dahua309.uk,https://chalaoshi.de` | 网页域，逗号分隔多个，按顺序 failover |
| `CHALAOSHI_API_BASE` | `https://api.dahua309.uk,https://api.chalaoshi.de` | API 域（评论 / 绩点），同样支持 failover |
| `CHALAOSHI_FALLBACK` | 空 | 同类镜像站兜底：主域名全部失败（被拦 / 超时 / 5xx）后改试这里，逗号分隔，留空不启用 |
| `CHALAOSHI_TIMEOUT_MS` | `8000` | 上游请求超时（毫秒）；上游实测 3~7s，设 8s 留余量，太短会让每次都超时并熔断域名 |
| `FAILOVER_COOLDOWN_MS` | `60000` | 域名失败后被熔断的冷却时长（毫秒），冷却后自动恢复 |
| `CACHE_TTL_SEARCH` | `60` | 搜索结果缓存（秒） |
| `CACHE_TTL_TEACHER` | `300` | 老师详情缓存（秒） |
| `CACHE_TTL_COMMENTS` | `60` | 评论缓存（秒） |
| `CACHE_TTL_GPA` | `1800` | 绩点缓存（秒） |
| `RATE_LIMIT_PER_MIN` | `60` | 每 IP 每分钟 API 上限，`0` 关闭 |

## API

所有端点 `GET`、返回 JSON、带 CORS。`/api` 返回机器可读的端点索引，`/docs` 是渲染版文档页。

| 端点 | 返回 |
|---|---|
| `GET /api/search?q=<姓名或拼音>` | `{ q, count, teachers: [{ tid, name, college, score }] }` |
| `GET /api/teacher/<tid>` | `{ tid, name, college, score, ratingCount, rollCallRate, commentCount, courses: [{ name, gpa, count }] }` |
| `GET /api/comments/<tid>?sort=time\|rate&limit=20&offset=0` | `{ tid, sort, total, offset, limit, hasMore, comments: [{ id, content, likes, date }] }` |
| `GET /api/gpa?course=<课程名>` | `{ course, count, rows: [{ teacher, gpa, count }] }` |
| `GET /api/health[?probe=1]` | 存活与上游配置；`probe=1` 时真实走一次上游搜索 |

```bash
curl 'http://localhost:3000/api/search?q=陈建海'
```

错误响应统一包含稳定的 `code`，例如 `{ "error": "参数缺失: 需要 q (老师姓名或拼音)", "code": "missing_query" }`。上游不可达时返回 502，并附 `upstreamStatus`（上游 HTTP 状态）和 `upstreamAttempts`（每个域名的具体失败原因）；`404` 为 `teacher_not_found`，`429` 为 `rate_limited`（带 `retryAfter`）。

## 前端页面

| 路由 | 内容 |
|---|---|
| `/` | 首页：按老师名 / 拼音搜索，支持 `/?q=<名字>` 直达 |
| `/course` | 按课程查各任课老师的平均绩点 |
| `/teacher/<tid>` | 老师详情：评分、点名率、评论、课程绩点 |
| `/docs` | 渲染版 API 文档（与 `/api` 同一份端点数据） |

## 部署（双平台）

同一份代码，两个部署目标都支持。

### Cloudflare Workers（OpenNext）

```bash
pnpm cf:build     # 构建（.open-next/）
pnpm cf:preview   # 本地 Workers 运行时预览
pnpm cf:deploy    # 构建并部署到 Cloudflare
```

- 环境变量写在 `wrangler.jsonc` 的 `vars` 里，换域名改这里或 Cloudflare dashboard 的变量即可，不动代码
- 首次部署 `pnpm exec wrangler login`；也支持 Git 集成（Workers Builds）
- 完整流程见 [`CLOUDFLARE_DEPLOY.md`](CLOUDFLARE_DEPLOY.md)

### Vercel

- 仓库含 `vercel.json`，在 Vercel dashboard 导入项目即可，或 `vercel` CLI 部署
- API 路由已设 `maxDuration = 60`（上游抓取可能超过默认 10s）
- 环境变量在 dashboard 的 Settings → Environment Variables 配置（同环境变量表）；不配则用代码默认值

### 排障

部署后先看 `/api/health`：`upstream.disabled` 列出被熔断的域名，`lastServedBase` 显示上次实际服务的域名；`probe=1` 会真实请求一次上游。

> **注意**：Vercel / Cloudflare 的出口是数据中心 IP，上游（Cloudflare 保护的反爬站点）可能直接拦截（403 或超时），导致域名被全部熔断、整站 502。务必备好 `CHALAOSHI_FALLBACK` 指向一个能通的同类镜像站作为最后一层兜底。

## 数据说明

数据来自 chalaoshi.de 匿名用户与「课否」，存在幸存者偏差，给分也有时效性——判断"给分捞不捞"建议以近期评论为准（`sort=time`）。本项目为只读代理，内置限流与缓存以减少对上游的压力。
