# FoxLedger Web/PWA

FoxLedger / 狐狐记账 Web/PWA 是移动端优先的个人记账应用。本仓库只维护 `D:\fox\foxledger` Web/PWA 前端、Supabase migrations 和 Supabase Edge Function，不包含原生 App 仓库内容。

当前代码基线：**V3.0 狐狐对话记账版**
生产地址：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

V3.0 已于 2026-08-13 完成 M0–M5 代码、本地生产构建、Vercel 生产部署和真机 PWA 更新验收，现已正式收口。

当前本地代码已完成 V3.1 M0–M2 的代码与自动化检查，尚未推送或发布；V3.1 M3–M5 仍未实施，生产站点仍以 V3.0 为准。

## 当前状态

已完成：

- React + Vite + TypeScript 前端。
- TanStack Router 五栏底部导航：首页、账单、狐狐、统计、设置。
- 页面按路由懒加载，React、TanStack、Supabase 和本地存储依赖独立分包。
- TanStack Query 查询、刷新和同步状态管理。
- Supabase Auth 邮箱密码登录、注册、会话恢复和退出。
- Supabase Postgres `public.transactions` 当前用户读写，继续依赖 RLS 并显式约束当前用户。
- Dexie v4 / IndexedDB 离线只读缓存，按 `user_id` 隔离，并缓存 AI 批次标识。
- 远端全量分页同步，全部页面拉取和校验通过后才替换当前用户本地缓存。
- 首页本月概览、手动记账入口、“和狐狐记一笔”入口。
- 账单搜索、筛选、排序、加载更多、编辑、单条删除、当前已加载账单多选删除。
- 账单搜索只在点击“搜索”或按回车后应用，不逐字刷新。
- 日期范围统计、分类排行、每日趋势轻量条形展示、统计 drilldown 到账单页筛选。
- CSV 前端解析、预览、错误行提示和确认导入。
- 独立懒加载 `/chat` 狐狐页：消息、解析状态、候选摘要、详情、编辑、移除和确认。
- `needs_attention` 候选必须补全并完成核对，或移除后，整批才能确认。
- 用户确认时生成固定 `ai_batch_id` 和 transaction IDs；响应不确定时执行只读协调查询，避免重复记账。
- 保存后区分远端成功与本地缓存刷新失败；`sync_warning` 只重试同步，不重复写入。
- 从 Dexie 当前真实缓存重建最近 AI 批次，支持正式单笔编辑、二次确认删除和整批撤销。
- 当前聊天跨应用内路由保留，刷新、关闭、登录失效或退出后清空，不持久化聊天。
- 原创轻量狐狐提供 normal、listening、thinking、happy、confused 五种状态和 reduced-motion 适配。
- AI 文本解析继续由 Supabase Edge Function `parse-transaction` 完成，候选必须用户确认后才写入 Supabase。
- vite-plugin-pwa / Workbox 应用外壳缓存。
- Workbox 对 Supabase/API 敏感路径和非 GET 请求使用显式 `NetworkOnly`，只对同源静态图片使用运行时缓存。
- Vitest + React Testing Library 覆盖关键规则、缓存、同步、批次状态机和 Chat 交互。
- V3.1 M0 已增加前端与 Edge 共用的环境无关统计模块、严格 query plan / stats envelope / grounded answer 契约，以及统计 drilldown 回归测试。
- V3.1 M1 已抽取 Edge 公共认证、邮箱白名单、环境变量和 OpenAI client，并实现用户 JWT + publishable key + RLS 的完整只读分页、代码白名单筛选、商家聚合、比较统计和最多 500 条 AI 安全明细选择。
- V3.1 M2 已新增尚未部署的 `fox-chat` 第一阶段：一次 AI 严格路由记账、问账、澄清和不支持；记账复用 V3.0 服务端清洗，问账只返回 normalized plan，强制意图纠错只允许记账或问账。
- Vercel 已按 Vite 静态前端部署，线上不再依赖旧 Next `/api/parse-transaction`。

当前限制：

- 没有离线正式写入队列。
- 没有 AI 查账，AI 不读取历史账单、统计数据或本地缓存。
- 没有自定义分类、账户、支付方式管理。
- 没有多币种和汇率。
- CSV 导入只追加新增，不覆盖、不合并、不自动去重。
- 当前自动化以单元/组件/缓存契约测试和构建产物验证为主；真实 Supabase、Service Worker 更新和真机键盘仍需人工验收。

## 技术栈

- React
- Vite
- TypeScript
- TanStack Router
- TanStack Query
- Supabase JS
- Supabase Auth
- Supabase Postgres + RLS
- Supabase Edge Functions
- Dexie / IndexedDB
- vite-plugin-pwa / Workbox
- lucide-react
- ESLint
- Vitest
- React Testing Library

## 关键目录

```text
src/
  main.tsx                         Vite 入口
  app/
    AppShell.tsx                   登录后应用壳和底部导航容器
    queryKeys.ts                   TanStack Query 查询键工厂
    router.tsx                     TanStack Router 路由
  auth/                            Supabase session、登录守卫、登录/注册页
  components/                      底部导航和通用 UI 组件
  features/
    ai/                            Edge Function 调用、AI 候选确认和保存
    chat/                          狐狐内存会话、候选/保存状态机、最近批次和保存后管理
    import/                        CSV 解析和导入 UI
    stats/                         统计范围、统计计算和本地缓存统计读取
    sync/                          同步 Provider 和缓存状态提示
    transactions/                  交易规则、Supabase 写操作、本地缓存读取、账单 UI
  lib/
    date.ts                        本地日期 helper
    env.ts                         前端环境变量读取
    localDb.ts                     Dexie schema 和缓存清理
    supabase.ts                    Supabase browser client
  routes/                          首页、账单、狐狐、统计、设置
  styles/globals.css               全局样式

supabase/
  config.toml
  functions/_shared/               V3.1 共享统计、严格契约、Edge 认证/AI client 和安全只读数据层
  functions/fox-chat/              V3.1 M2 第一次 AI 与严格意图路由（本地，未部署）
  functions/parse-transaction/     AI 解析 Edge Function
  migrations/                      transactions 表和权限 migration
scripts/verify-v3-build.mjs        Chat chunk、角色资源和 Workbox 边界验证
```

## 环境变量

PWA 前端需要：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

兼容旧公开变量：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Supabase Edge Function secrets：

```text
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

说明：

- `OPENAI_BASE_URL` 可以继续使用个人 VPS 的 OpenAI-compatible 转发地址。
- `OPENAI_API_KEY` 只放在 Supabase Edge Function secrets，不进入 PWA 前端。
- 前端只调用 `<SUPABASE_URL>/functions/v1/parse-transaction`。
- 不要在代码、文档、提交记录或截图里写真实密钥。

## 数据和安全规则

核心远端表仍是 `public.transactions`。V3.0 已增加最小字段：

```text
ai_batch_id uuid null
```

`ai_batch_id` 只用于 `source = 'ai'` 的同次确认批次，不新增 batch 或聊天表。

必须保持：

- 不提交 `.env`、`.env.local` 或任何真实密钥。
- 不使用 Supabase `service_role` key。
- 不绕过 RLS。
- 前端只能使用 publishable key。
- 查询、更新、删除除了依赖 RLS，也要显式约束当前用户。
- AI 只解析当前输入文本，不读取历史账单、统计数据或本地缓存。
- AI 不直接写数据库，不计算统计。
- AI 结果必须用户确认后才入库。
- 新 V3.0 AI 账单不持久化 `raw_text`；它只在当前内存候选核对期间存在。
- 离线时禁用正式写操作，包括新增、编辑、删除、多选删除、AI 保存候选和 CSV 导入。

Dexie DB：

```text
name: foxledger
version: 4
stores:
  transactions_cache
  sync_meta
```

`transactions_cache` 只缓存：

```text
cache_key
id
user_id
type
amount
currency
category
merchant
payment_method
date
note
source
ai_batch_id
created_at
updated_at
```

不缓存：`raw_text`、AI 原始响应、Supabase token、登录响应、`tag`、`account`、`ai_confidence`。

## 本地开发

```bash
npm install
npm run dev
```

提交前检查：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run verify:v3
```

预览生产构建：

```bash
npm run preview
```

部署 Edge Function：

```bash
npm run functions:deploy
```

`supabase/config.toml` 中 `parse-transaction` 的 `verify_jwt = false` 是为了函数自己处理 CORS preflight 和中文错误响应；函数内部仍必须验证 `Authorization: Bearer <access_token>`。

## 最近验证结果

当前已验证：

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm run test`：26 个测试文件、129 项测试通过。
- `npm run build`：通过；Chat 页面与公共依赖独立分包，无 chunk size 提示。
- `npm run verify:v3`：通过；验证 Chat gzip、狐狐资源预算、PWA manifest 和 Workbox 敏感缓存边界。
- `npm audit --audit-level=moderate`：0 vulnerabilities。
- 本地生产产物已生成，提交 `94aeba1` 已完成 Vercel 生产部署；生产首页、`/chat`、manifest、Service Worker 和带哈希静态资源检查通过。
- 本地与线上账单同步状态正常，未再出现长时间停留在“同步中”的问题。
- M0–M4 人工验收通过，包括解析、候选核对、固定批次保存、最近批次、正式编辑、单删、部分删除后整批撤销、离线限制和刷新恢复。
- M5 代码、自动化检查、生产部署和真实手机 PWA 更新验收均已通过。

V3.0 静态前端已完成生产部署、服务器产物核对和真机 PWA 更新验收。后续生产状态仍必须以实际部署结果为准，不能仅凭本地构建判断。

文档更新后如只改 Markdown，可不重复部署；如果改代码，仍按提交前检查执行。

## 后续边界

- V3.0 完成发布验收后，才允许按 `docs/V3.1_EXECUTABLE_DESIGN.md` 启动 V3.1。
- V3.1 M0–M2 已在本地完成代码和自动化检查，尚未发布；M3 第二次 AI 与有依据回答及后续批次必须等待用户明确开始。
- 当前 PWA 仍调用生产 `parse-transaction`，尚未接入 `fox-chat`；AI 问账回答、连续追问和全站体验统一仍不是已实现功能，不得写成现状。
- 语音、OCR、图片记账和原生能力不在当前 Web/PWA 范围内。
