# AGENTS.md — 查老师 web 镜像(开发指南)

浙江大学「查老师」(chalaoshi.de) 匿名教评系统的**反向代理镜像**。抓取上游 HTML 解析为结构化 JSON,提供老师搜索/详情/评论/课程绩点,前端为响应式 SPA 风格 UI。

> 供 AI agent 与开发者阅读。改代码前先读这份,尤其「关键约定」一节。

## 技术栈

- **Next.js 15(App Router)+ React 19 + TypeScript**,零其他运行时依赖
- 包管理:**pnpm**(`package.json` 的 `packageManager` 字段钉死版本,**不要用 npm/yarn 新增或安装依赖**——它们的 lockfile 会污染项目)
- 服务端: Route Handlers 做 API;内存缓存 + 滑动窗口限流
- 前端: 全客户端组件实现 SPA 式体验(无第三方 UI 库)
- 部署: **OpenNext Cloudflare** 编译成单个 Worker 跑在 Cloudflare Workers 上,见 `CLOUDFLARE_DEPLOY.md`
- 设计系统: `app/globals.css` 里的 CSS 变量(明/暗双主题),所有组件共用

## 目录结构

```
app/
  layout.tsx          全局壳: 顶栏毛玻璃 header / main / 底部 tab(BottomNav) / 毛玻璃 footer
  page.tsx            首页(查老师): 读 searchParams.q 传给 TeacherSearch 做直达搜索
  course/page.tsx     查课程绩点
  teacher/[tid]/page.tsx  老师详情——薄服务端包装, 只把 tid 交给客户端组件
  docs/page.tsx       API 渲染版文档(/docs), 人类看的
  manifest.ts         PWA manifest
  globals.css         设计 tokens + 全部样式
  api/                Route Handlers(见下)
components/
  TeacherSearch.tsx   查老师: 防抖即搜 + 输入法处理 + 客户端缓存
  CourseSearch.tsx    查课程: 同上
  TeacherDetail.tsx   详情页主体: 客户端拉 /api/teacher/<tid>, 骨架屏加载
  CommentSection.tsx  评论: 每排序独立缓存 + 后台预取 + 无限滚动
  TeacherCard.tsx     搜索结果卡片
  ScoreBadge.tsx      评分色阶(导出纯函数 scoreClass 供复用)
  GpaTable.tsx        绩点表(移动端 CSS 变卡片), 老师名链到 /?q=
  BottomNav.tsx       移动端底部 tab 栏
  ApiDocsClient.tsx   /docs 上的「基础 URL + 复制给 AI 提示词」
lib/
  chalaoshi.ts        核心: 抓上游 HTML + 正则解析 + 多域名 failover
  types.ts            结构化类型(与上游 HTML 一一对应)
  cache.ts            内存 TTL 缓存(挂 globalThis 跨 HMR 复用)
  ratelimit.ts        滑动窗口限流
  http.ts             json() 带 CORS / 限流 / 错误映射
  apiEndpoints.ts     端点清单——/api 索引与 /docs 复制按钮共用同一份
  clientCache.ts      客户端会话缓存(搜索结果等)
```

## 服务端 API

| 端点 | 说明 |
|---|---|
| `GET /api/search?q=` | 老师候选(tid/name/college/score) |
| `GET /api/teacher/<tid>` | 详情(评分/点名率/评论数/课程绩点) |
| `GET /api/comments/<tid>?sort=&limit=&offset=` | 评论, 分页, 返回 total/hasMore |
| `GET /api/gpa?course=` | 该课各老师平均绩点 |
| `GET /api/health[?probe=1]` | 存活/上游探测 |
| `GET /api` | 端点索引(纯 JSON) |

所有 API: `dynamic = 'force-dynamic'`,统一走 `enforceRateLimit(req)` + `handleError(e)` + `json()`(自动带 CORS)。错误体 `{ error, upstreamStatus? }`;404=老师不存在,429=限流(带 `retryAfter`),502=上游不可达。

## 关键约定(改代码前必读)

1. **`lib/chalaoshi.ts` 的正则解析直接移植自 `.claude/skills/chalaoshi/scripts/chalaoshi.py`(线上验证过)。不要凭感觉改正则**——改了必须对线上 HTML 重新验证。注释里写着"不要凭感觉改"。

2. **上游域名经常换**。多域名 failover(逗号分隔),换域名只改环境变量,不动代码。**失败域名自动熔断**: `fetchWithFailover` 对 403(Cloudflare 拦截)/5xx/超时/空响应会禁用该域, 冷却期内跳过, 冷却后自动恢复。默认优先 `dahua309.uk`, `CHALAOSHI_TIMEOUT_MS` 默认 1000ms 让切换更快。

3. **`/api` 永远返回 JSON,`/docs` 才是人类看的渲染版。** 曾在 `/api` 加过 Accept 头判断→重定向到 `/docs`,导致浏览器访问 `/api` 死循环(跳来跳去),**已移除**。以后也不要加这类重定向——AI 与 curl 需要直达 JSON,文档页靠导航指向 `/docs`。

4. **SPA 体验是硬需求**(查得快)。老师详情页是薄服务端包装 + 客户端 `TeacherDetail` 拉数据 + 骨架屏。**不要**在 `/teacher/[tid]` 页做同步上游 fetch(会阻塞导航,变回慢加载)。

5. **搜索要"输入即搜"**: 300ms 防抖 + 处理中文输入法组合(compositionstart/end 期间不触发)+ 客户端缓存(`lib/clientCache.ts`)。改搜索逻辑时保持这三点。

6. **评论切换(最新/人气)必须顺滑**: 每种排序在 `pages` ref 里独立缓存、首次加载后后台预取另一种排序、单飞(`busyRef`)防竞态、切换时保留当前列表不整块闪烁。这是用户明确要求过的性能点。

7. **移动端是第一优先**: 触摸目标 ≥44px、输入框字号 ≥16px(防 iOS 聚焦缩放)、`env(safe-area-inset-*)` 处理刘海屏、底部 tab 栏(`BottomNav`,≤768px 显示)、绩点表在手机上变卡片。页面改动记得在 ≤390px 宽度下检查。

8. **顶栏/页脚是固定的毛玻璃条**: header sticky top / footer sticky bottom,`blur(18px) saturate(170%)` + 半透明底;footer 在移动端要抬到 tab 栏上方(`bottom: calc(56px + safe-area)`)。`body` 是 `flex column min-height:100dvh`,`main` 撑满。

9. **设计 tokens 在 `globals.css` `:root` + `@media (prefers-color-scheme: dark)`**,颜色/圆角/阴影一律用变量,不要硬编码。**半透明层(毛玻璃底/边框/焦点环/骨架屏闪光)用 `rgba()` 变量(`--glass-bg`/`--glass-border`/`--nav-bg`/`--accent-ring`/`--red-bg`/`--shimmer`),不要用 `color-mix()`**——它在不支持的浏览器里会让背景直接失效变透明,出过兼容性事故。

10. **首页支持 `/?q=名字` 直达**(从绩点表点老师名跳过来)。`page.tsx` 读 `searchParams` 传给 `TeacherSearch initialQ`。

11. **宽度系统是全站唯一的——全局 600px**: 所有页面共用 `.container`(`max-width: 600px` + `clamp(16px, 4vw, 28px)` 流式边距),搜索页、详情页、文档页全是一个窄栏,顶栏/内容/页脚自动对齐。这是用户反复斟酌后的明确决定(曾试过 1100/1280 全宽,被打回)。**禁止给任何元素另设与容器冲突的 `max-width` 或局部加宽**。

12. **骨架屏宽度要对齐真实内容,不要用容器百分比**: 中文字很短,姓名条用 `40%` 在宽容器里会变成 400px 的巨杠,和真实的 80px 名字严重不符。姓名/学院/统计等短内容一律用**固定像素宽**(姓名 ~100px、学院 ~190px),评论这种整段长文才可以用百分比。`.skeleton` 基类带 `width: 100%` 兜底,不会塌陷。

13. **环境变量惰性读取**: 不要在模块加载时读 `process.env`——Cloudflare 的 env→`process.env` 填充(`populateProcessEnv`)发生在 worker 初始化后, 模块级读取会拿到空值而落到默认值。一律在请求时读, `lib/chalaoshi.ts` 的 `getWebBases()`/`getTimeoutMs()` 就是样板。

## 开发命令

```bash
pnpm dev      # 开发, http://localhost:3000 (本机占用时 Next 会换端口, 看日志)
pnpm build    # 生产构建(兼做类型检查)
pnpm start    # 生产启动
pnpm cf:build     # OpenNext Cloudflare 构建(.open-next/)
pnpm cf:preview   # 本地 Workers 运行时预览
pnpm cf:deploy    # 构建并部署到 Cloudflare Workers
```

环境变量见 `.env.example`(本地 dev 用 `.env.local`) 与 `wrangler.jsonc` 的 `vars`(CF 部署用)。运行机器需能访问上游域(通常要科学上网)。完整部署流程见 `CLOUDFLARE_DEPLOY.md`。

## 常见改动路径

- **加一个查询维度**: 在 `lib/chalaoshi.ts` 加解析函数 → 加 `/api` 路由(套 `enforceRateLimit`+`handleError`+`json`)→ 加 `lib/types.ts` 类型 → 加组件;若在端点清单里就同步更新 `lib/apiEndpoints.ts`。
- **调 UI**: 只动 `globals.css` 的变量与选择器,尽量不改组件结构;新样式组件优先复用已有 class。
- **改数据解析**: 先对着线上真实 HTML 验证再改,并保留缓存/限流。

## 数据说明

数据来自 chalaoshi.de 匿名用户与「课否」,存在幸存者偏差,给分有时效性——判断"给分捞不捞"建议以**近期评论**为准(`sort=time`),并核对课程名是否与所问一致。
