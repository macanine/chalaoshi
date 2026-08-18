# AGENTS.md

## 项目契约

这是浙江大学「查老师」(`chalaoshi.de`) 的非官方镜像。它把上游 HTML 解析为结构化 JSON，并提供老师搜索、老师详情、评论与课程绩点的响应式 Web UI。

本文件适用于仓库内的全部修改。修改前先读相关实现；不要基于文件名、旧文档或页面外观猜测运行行为。

## 技术边界

- Next.js 15 App Router、React 19、TypeScript，运行时不引入第三方依赖。
- 只使用 `pnpm`。不得使用 npm 或 yarn，也不得产生它们的 lockfile。
- API 由 Route Handler 提供；缓存、限流和 CORS 统一由 `lib/` 处理。
- 前端以客户端组件提供 SPA 体验；不引入 UI 库。
- 部署目标为 OpenNext Cloudflare Worker。部署细节见 `CLOUDFLARE_DEPLOY.md`。
- 生产数据来自匿名评价和「课否」，存在幸存者偏差与时效性。UI 文案不得把数据表达成事实保证。

## 目录与职责

```text
app/
  api/                    JSON Route Handlers
  page.tsx                老师搜索首页，透传 ?q=
  course/page.tsx         课程绩点页，透传 ?course=
  teacher/[tid]/page.tsx  仅传递 tid 的薄页面包装
  docs/                   人类可读 API 文档；/api 始终是 JSON
  layout.tsx              全局壳、导航、页脚
  globals.css             全站 tokens 与样式
components/
  TeacherSearch.tsx       老师即时搜索
  CourseSearch.tsx        课程即时搜索
  TeacherDetail.tsx       客户端拉取详情与骨架屏
  CommentSection.tsx      评论排序、预取和无限滚动
  GpaTable.tsx            课程绩点表
lib/
  chalaoshi.ts            上游请求、熔断、缓存和 HTML 解析
  http.ts                 JSON、CORS、限流与错误映射
  cache.ts                有界服务端 TTL 缓存
  clientCache.ts          有界会话缓存
  ratelimit.ts            有界滑动窗口限流
  types.ts                API 结构类型
  apiEndpoints.ts         /api 与 /docs 共用的端点清单
```

## 不可破坏的规则

### 上游与解析

1. `lib/chalaoshi.ts` 的 HTML 正则已用真实上游页面验证。不要凭感觉调整解析正则；任何改动都必须拿真实 HTML 重新验证搜索、详情、评论和绩点的结果。
2. 上游域名只能通过环境变量调整，不能硬编码替换代码默认策略。`CHALAOSHI_WEB_BASE`、`CHALAOSHI_API_BASE` 与 `CHALAOSHI_FALLBACK` 都是逗号分隔列表。
3. 主域名失败时维持既有 failover：403、408、429、5xx、超时和空响应会熔断该域；冷却期跳过；所有域都冷却时仍按优先级探测一次；成功立即解除熔断。404 是资源不存在，不应触发 fallback。
4. 上游实测响应通常为 3 至 7 秒。`CHALAOSHI_TIMEOUT_MS` 默认 8000，不能为了“更快”设置为 1 秒这类会持续熔断的值。
5. 相同缓存键的上游请求必须单飞；不得移除 `cached()` / `inFlight` 保护，也不得将有界缓存改回无上限 Map。

### API

1. `/api` 永远返回 JSON，绝不根据 `Accept` 跳转到 `/docs`。`/docs` 才是人类阅读的页面。
2. 所有 Route Handler 都必须 `export const dynamic = 'force-dynamic'`，并在执行逻辑前调用 `enforceRateLimit(req)`。
3. 通过 `json()` 返回响应，保证 CORS 一致；可抛出的上游调用放入 `try/catch` 并经 `handleError()` 映射。
4. 动态参数先验证再请求上游。老师 `tid` 必须为数字；搜索词和课程名必须保持长度上限。
5. 新端点必须同步更新 `lib/types.ts`、`lib/apiEndpoints.ts`、`/docs`，错误体必须有稳定的 `code`；上游错误保留 `upstreamStatus?` 与 `upstreamAttempts?`。429 必须保留 `Retry-After`。
6. `/api/health?probe=1` 会访问上游，只可作为受限探测，不要将其改成未受保护的重请求接口。

### Cloudflare 与配置

1. 环境变量只可在请求时读取。Cloudflare Worker 的 `process.env` 填充晚于模块加载，禁止模块级读取配置。
2. `next.config.ts` 通过 `initOpenNextCloudflareForDev()` 把 `wrangler.jsonc` 的 vars 注入 `next dev`；本地专属覆盖仍写入 `.env.local`，部署和 `cf:preview` 以 `wrangler.jsonc` 为准。
3. 配置值必须校验有限性和合理范围，尤其是 TTL、超时、冷却期与每分钟限流。
4. 不要改为 Next 数据缓存或上游 `fetch` 缓存。该项目依靠显式内存 TTL 缓存和 `cache: 'no-store'` 控制陈旧数据。

### SPA 与数据加载

1. `app/teacher/[tid]/page.tsx` 必须保持薄包装。老师详情由 `TeacherDetail` 客户端请求并显示骨架屏，禁止在页面服务端同步抓上游。
2. 站内跳转使用 `next/link`；仅外链或明确要求新标签页时使用 `<a>`。
3. 搜索必须保留 300ms 防抖、中文输入法 composition 保护、客户端缓存和旧请求取消/序列防护。清空或改词后不得显示过期结果。
4. 详情页与搜索页的离开/新请求必须取消未完成的浏览器请求，避免过期状态回写。
5. 评论必须使用显式页码分页，每页 20 条，提供页码、上一页和下一页；禁止无限滚动与 `IntersectionObserver` 自动加载。两种排序的各页分别缓存；首次加载后后台预取另一种排序的第一页；同一排序和页码请求单飞；切换排序或页码时保留已显示评论，不能整块闪烁。老师 `tid` 改变时评论状态必须重置。

### 设计与可访问性

1. 移动端优先：交互目标至少 44px，输入框字号至少 16px，处理 `safe-area-inset-*`，并在不超过 390px 宽度下检查布局。
2. 全站宽度只使用 `.container`：`max-width: 600px` 加流式边距。禁止局部加宽或额外 `max-width` 与它冲突。
3. 头部和页脚维持毛玻璃 sticky 布局；移动端页脚必须高于底部导航。`body` 保持 `flex` 列布局与 `min-height: 100dvh`。
4. 颜色、圆角、阴影只使用 `app/globals.css` 的设计 tokens。半透明层使用现有 `rgba()` tokens，禁止使用 `color-mix()`。
5. 骨架屏的短文本使用接近真实内容的固定像素宽度，例如姓名约 100px、学院约 190px；仅长段内容可用百分比。
6. 保持明暗主题、`prefers-reduced-motion`、可见焦点、语义标签和移动端绩点卡片布局。

## 常见任务

### 新增查询维度

1. 在 `lib/types.ts` 定义输出结构。
2. 在 `lib/chalaoshi.ts` 实现上游请求和已验证的解析。
3. 新增 API 路由，接入动态渲染、限流、JSON 和错误映射。
4. 更新 `lib/apiEndpoints.ts` 与 `/docs`。
5. 最后增加客户端组件，并遵守本文件的数据加载和移动端规则。

### 调整 UI

- 优先修改 `app/globals.css`，复用既有 class 与 tokens。
- 不要为了小改动重排组件层级或引入新设计系统。
- 改动搜索、详情、评论或绩点时，分别检查 loading、error、empty、缓存命中和窄屏状态。

### 改动上游逻辑

- 先保存或复现真实上游响应，再改正则。
- 检查多域 failover、fallback、熔断恢复、超时和缓存命中路径。
- 上游异常必须转为稳定 API 错误，不得直接把 HTML 或原始 fetch 异常响应给客户端。

## 验证与交付

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm cf:build
```

- 纯前端改动至少做类型检查和窄屏检查。
- API、缓存、限流或解析改动至少做类型检查，并验证受影响端点的成功、参数错误、上游失败与缓存路径。
- Cloudflare 相关改动执行 `pnpm cf:build`；部署前看 `CLOUDFLARE_DEPLOY.md`。
- 工作区可能已有用户改动。只修改与任务有关的文件，不回退或格式化无关变更。
- 无法执行验证时，明确说明原因和未验证的范围。

## 常用命令

```bash
pnpm dev          # Next 本地开发
pnpm build        # Next 生产构建与类型检查
pnpm start        # 运行生产构建
pnpm cf:build     # OpenNext Cloudflare 构建
pnpm cf:preview   # 本地 Worker 预览
pnpm cf:deploy    # 构建并部署 Worker
```
