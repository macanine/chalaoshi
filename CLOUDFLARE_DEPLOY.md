# Cloudflare 部署指南

本项目通过 [OpenNext Cloudflare](https://opennext.js.org/cloudflare) 把 Next.js 15(App Router)应用编译成**单个 Worker**,部署到 Cloudflare Workers 全球边缘网络。

- 页面路由 + 全部 `/api/*` 跑在同一个 Worker 里(`workerd` 运行时,兼容 Node.js API)
- 静态资源(`/_next/static` 等)由 Workers 静态资源托管(`ASSETS` binding),并已通过 `public/_headers` 配置了 immutable 缓存
- 所有路由都是 `force-dynamic` + `fetch no-store`,**不**使用 Next 数据缓存,因此不接 R2 incremental cache,用默认内存实现即可(见 `open-next.config.ts` 的注释)

---

## 前置要求

| 依赖 | 说明 |
|---|---|
| Node.js ≥ 18 | 推荐 22(本项目开发用的是 v22) |
| pnpm | 版本已由 `package.json` 的 `packageManager: "pnpm@11.22.0"` 钉死 |
| Cloudflare 账号 | 注册即可,无需付费 |
| 能访问上游域的网络 | 抓 chalaoshi.de / dahua309.uk 需要,通常要科学上网 |

## 安装

```bash
pnpm install            # 用 pnpm,别用 npm(本项目是 pnpm workspace 单包)
cp .env.example .env.local   # 本地开发按需修改
```

## 本地开发

```bash
pnpm dev                # http://localhost:3000 (被占用时 Next 自动换端口)
```

`next.config.ts` 里 `initOpenNextCloudflareForDev()` 会把 `wrangler.jsonc` 中的 `vars`/bindings 注入本地 dev 环境,所以本地跑起来就能读到上游域名等配置。

## 本地构建与预览(部署前必验)

```bash
pnpm cf:build       # 编译 Next 并产出 .open-next/ (worker.js + assets)
pnpm cf:preview     # 在 workerd 运行时本地启动,最接近线上行为
```

`preview` 是本地模拟线上,建议正式部署前先跑一遍,确认 `/api/health`、`/api/search?q=xxx` 都正常。

---

## 部署

### 方式 A:命令行直接部署(推荐,手动/CI 通用)

```bash
# 1. 首次先登录 Cloudflare(会打开浏览器授权)
pnpm exec wrangler login

# 2. 构建并部署
pnpm cf:deploy
```

部署完成后访问:https://chalaoshi.`<你的账号子域>`.workers.dev

- `cf:deploy` = `opennextjs-cloudflare build && opennextjs-cloudflare deploy`,产物是 `.open-next/`,由 `wrangler.jsonc` 的 `main` / `assets` 指向。
- 环境变量已写在 `wrangler.jsonc` 的 `vars` 里,部署时会一并同步。**如果你只在 Cloudflare Dashboard 手动改过变量、且不想被仓库里的 `wrangler.jsonc` 覆盖**,部署时加 `--keep-vars`:

  ```bash
  pnpm exec opennextjs-cloudflare deploy -- --keep-vars
  ```

  本项目的设计是"变量以仓库 `wrangler.jsonc` 为准"(换域名只改它),所以通常不需要。

### 方式 B:Git 集成(Workers Builds,自动部署)

1. 把仓库推到 GitHub 或 GitLab。
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Workers** → 选 **Workers Builds**(或 "From Git")→ 连接你的仓库。
3. 配置构建:

   | 字段 | 填法 |
   |---|---|
   | Build command | `corepack enable && corepack prepare pnpm@11.22.0 --activate && pnpm install --frozen-lockfile && pnpm run cf:build` |
   | Deploy command | `pnpm exec opennextjs-cloudflare deploy -- --keep-vars` |
   | Build variables | `NODE_VERSION=22`(如需固定 Node 版本) |

   `corepack` 保证构建机用的是本项目钉死的 pnpm;`--frozen-lockfile` 保证依赖与 `pnpm-lock.yaml` 完全一致。
4. 每次 merge 到 `main`(或你在设置里选的生产分支)就会自动构建部署,非生产分支默认只上传 preview 版本不切换流量。

> 注意:若构建时需要用 `NEXT_PUBLIC_*` 变量做静态内联,必须在 **Build variables** 里单独配置——运行时变量不会自动进入构建阶段。

## 自定义域名

Dashboard → 对应 Worker → **Settings** → **Domains & Routes** → **Add custom domain**,Cloudflare 会自动签发并续期 SSL 证书。推荐直接绑自定义域名,`*.workers.dev` 在国内访问经常不稳定。

---

## 环境变量管理

变量有两个来源,部署时会合并:

1. **仓库 `wrangler.jsonc` 的 `vars`**(默认):已提交,含上游域名、缓存 TTL、限流等,全部有默认值。
2. **Dashboard 运行时变量 / secrets**:在 Worker 的 Settings → Variables 里追加;`pnpm exec wrangler secret put <KEY>` 可设置敏感值。

完整变量清单见 `.env.example` 与 `wrangler.jsonc`,核心几个:

| 变量 | 默认 | 说明 |
|---|---|---|
| `CHALAOSHI_WEB_BASE` | `https://dahua309.uk,https://chalaoshi.de` | 网页域,逗号分隔,按顺序 failover |
| `CHALAOSHI_API_BASE` | `https://api.dahua309.uk,https://api.chalaoshi.de` | API 域(评论/绩点),同样 failover |
| `CHALAOSHI_TIMEOUT_MS` | `8000` | 单个上游请求超时(ms);上游实测 3~7s,设 8s 留余量——太短会导致每次超时并熔断域名,整站 502 |
| `FAILOVER_COOLDOWN_MS` | `60000` | 域名失败后被熔断的冷却时长(ms) |
| `RATE_LIMIT_PER_MIN` | `60` | 每 IP 每分钟 API 上限,`0` 关闭 |

**换上游域名只需改 `wrangler.jsonc` 的 vars(或 Dashboard 变量),不用动代码。** 被拦/超时的域名会自动熔断,冷却后自动恢复;所有域名都在冷却期时仍会按优先级真试一次,上游恢复后立刻重新可用。

## 验证部署

部署后用 curl 检查(替换成你的域名):

```bash
curl -i https://<你的域名>/api/health?probe=1
```

- 返回 `{"status":"ok", ..., "servedBy": "..."}` 说明正常;`servedBy` 是本次实际响应的上游域。
- `disabled` 数组里列出的是当前被熔断(跳过)的域,冷却后会自动恢复。
- 页面:直接访问 `https://<你的域名>/?q=陈建海` 应能搜出结果。

查看部署记录:

```bash
pnpm exec wrangler deployments list --name chalaoshi
pnpm exec wrangler deployments status --name chalaoshi
```

---

## 常见问题

**`/api/health?probe=1` 返回 502 或 `upstreamStatus` 非 2xx**
1. **先看超时**:上游实测 3~7s(搜索页最慢),`CHALAOSHI_TIMEOUT_MS` 必须 ≥8s;设为 1s 这类激进值会导致每次必超时,把所有域名熔断,整站快速 502。
2. 上游域名被 Cloudflare 拦(403)或不可达:确认本机/Worker 能访问该域,并看 `disabled` 里是否熔断了域名。上游域名经常换,优先去改 `CHALAOSHI_WEB_BASE` / `CHALAOSHI_API_BASE`。

**本地 `preview` / `deploy` 报 `nodejs_compat` 相关错误**
`wrangler.jsonc` 已带 `nodejs_compat` 兼容标志,一般不会出现;若出现,确认用的是仓库里的 `wrangler.jsonc` 而不是别处拷贝的旧配置。

**`pnpm install` 很慢或超时**
网络慢时先用国内镜像(项目 `.npmrc` 已配好 `registry.npmmirror.com`),再加大 fetch 超时重试:`pnpm install --fetch-timeout 300000 --fetch-retries 5`(已下载的部分有缓存,重跑会续传)。

**安装时报 `ERR_PNPM_IGNORED_BUILDS`**
pnpm 11 默认拦截依赖的构建脚本。本项目已在 `pnpm-workspace.yaml` 的 `allowBuilds` 里放行 `esbuild` / `sharp` / `workerd`;新增依赖若有构建脚本,按同样方式加进该列表,再 `pnpm install`。

**`deploy` 后 Dashboard 里改的变量丢了**
`opennextjs-cloudflare deploy` 会用 `wrangler.jsonc` 的 vars 同步覆盖。若要以 Dashboard 为准,用 `-- --keep-vars`(见方式 A 的说明)。

**首次冷启动较慢**
Workers 冷启动是正常的,持续访问会自动常驻;路由本身是纯代理 + 内存缓存,热启动很快。
