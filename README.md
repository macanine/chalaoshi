# chalaoshi

浙江大学「查老师」(chalaoshi.de) 匿名教评系统的反向代理镜像：抓取上游 HTML 解析为结构化 JSON，并提供搜索 / 详情 / 评论 / 绩点查询的前端界面。

- 纯 Next.js 15 + React 19 + TypeScript，零其他运行时依赖
- 服务端内存缓存 + 滑动窗口限流，多域名 failover，失败域名自动熔断冷却后恢复
- 响应式 UI，明暗双主题，支持 PWA

## 快速开始

包管理用 **pnpm**(版本由 `package.json` 的 `packageManager` 钉死,建议装 [corepack](https://nodejs.org/api/corepack.html) 自动接管):

```bash
pnpm install
cp .env.example .env.local   # 按需修改
pnpm dev                     # http://localhost:3000
```

生产部署：

```bash
pnpm build
pnpm start
```

> 运行机器需能访问上游域（通常要科学上网）。上游域名经常更换，换域名时只改 `wrangler.jsonc` 的 vars / 环境变量即可，无需改代码。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CHALAOSHI_WEB_BASE` | `https://dahua309.uk,https://chalaoshi.de` | 网页域，逗号分隔多个，按顺序 failover |
| `CHALAOSHI_API_BASE` | `https://api.dahua309.uk,https://api.chalaoshi.de` | API 域（评论 / 绩点），同样支持 failover |
| `CHALAOSHI_TIMEOUT_MS` | `1000` | 上游请求超时（毫秒），短超时让 failover 切换更快 |
| `FAILOVER_COOLDOWN_MS` | `60000` | 域名失败后被熔断的冷却时长（毫秒），冷却后自动恢复 |
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

## 部署（Cloudflare Workers / Pages）

项目通过 [OpenNext Cloudflare](https://opennext.js.org/cloudflare) 运行在 Cloudflare Workers 上：页面与 API 路由共用一个 Worker，静态资源由 Workers 托管。**完整部署流程（命令行部署 / Git 集成 / 自定义域名 / 排障）见 [`CLOUDFLARE_DEPLOY.md`](CLOUDFLARE_DEPLOY.md)。**

```bash
pnpm cf:build     # 本地构建（.open-next/）
pnpm cf:preview   # 本地 Workers 运行时预览
pnpm cf:deploy    # 构建并部署到 Cloudflare
```

- 环境变量已写在 `wrangler.jsonc` 的 `vars` 里（默认优先 `dahua309.uk`、1s 超时、60s 熔断冷却）；换域名改这里即可，不用动代码。也可在 Cloudflare dashboard 的变量里改。
- 首次部署需 `pnpm exec wrangler login`。
- 也可以走 Cloudflare 的 Git 集成（Workers Builds）：见 `CLOUDFLARE_DEPLOY.md` 方式 B。
- 部署后可用 `/api/health?probe=1` 验证：`servedBy` 显示实际响应的域，被拦的域会出现在 `disabled` 里。

## 数据说明

数据来自 chalaoshi.de 匿名用户与「课否」，存在幸存者偏差，给分也有时效性——判断"给分捞不捞"建议以近期评论为准。本项目为只读代理，内置限流与缓存以减少对上游的压力。
