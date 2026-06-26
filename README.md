# FoxLedger / 狐狐记账

FoxLedger 是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA。它面向个人日常记账场景，解决“快速记录、确认入库、查看真实账单、统计分析、弱网或离线时查看上次同步数据”的闭环问题。

当前 Web/PWA 版基线为 v2.1 正式版：登录、手动记账、AI 批量解析、CSV 导入、账单管理、统计 drilldown、本地缓存、离线只读 UI、手动草稿和 Service Worker 外壳缓存已经完成。后续规划是保持 Web/PWA v2.1 稳定维护；平级 iOS + Android App v0.x 测试版已在 `D:\fox\foxledger-app` 启动，当前完成到 v0.5 AI 解析迁移。

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

## 功能列表

- Supabase 邮箱密码登录、注册和会话保护。
- `public.transactions` 表、约束、索引、RLS policy 和 authenticated 权限授权。
- 首页本月概览。
- 首页手动记账加号入口，点击后展开手动记账表单。
- 手动记账支持类型、金额、分类、日期，以及可折叠的商家、支付方式、备注。
- 手动记账草稿保存在本设备 IndexedDB，不是正式账单，不参与统计。
- AI 文本账单解析，支持单条和批量候选。
- AI API 登录校验和邮箱白名单。
- AI 解析结果必须经用户确认、编辑和选择后才能批量写入数据库。
- CSV 导入、预览、错误行提示和确认导入。
- 账单页搜索、类型筛选、分类筛选、日期范围筛选、排序、加载更多。
- 账单编辑、单条删除和当前已加载账单的多选删除。
- 统计页支持本周、本月、上月、今年和自定义日期范围。
- 统计展示总支出、总收入、结余、交易笔数、日均支出、最大单笔支出、分类支出排行和每日支出趋势。
- 统计概览、分类排行和每日趋势支持点击跳转到账单页并自动应用筛选。
- Supabase 拉取成功后，将当前用户已同步账单写入 IndexedDB。
- 下次启动先显示本地缓存，再后台同步云端最新数据。
- 首页概览、账单页和统计页基于当前用户本地缓存读取和计算。
- 在线刷新按钮会触发远端同步，成功后覆盖本地缓存并刷新视图。
- 断网时只允许查看上次同步数据，明确显示离线状态和上次同步时间。
- 离线时禁用正式写操作，包括手动保存、AI 解析/保存、CSV 导入、编辑、删除和批量删除。
- 基础 PWA metadata、manifest、动态图标路由。
- Service Worker 缓存应用外壳、Next 静态资源、manifest、图标和离线提示页。
- Vercel 部署。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- OpenAI-compatible Chat Completions API
- IndexedDB
- Service Worker
- Vercel
- lucide-react
- ESLint

## 数据安全与权限

- 项目不使用 Supabase `service_role` key。
- 前端只使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- `.env.local` 不提交到 Git。
- 业务数据存储在 `public.transactions`。
- `transactions.user_id` 绑定 Supabase Auth 用户 id。
- Supabase RLS 已开启，用户只能 select/insert/update/delete 自己的账单。
- 前端查询、更新、删除除了依赖 RLS，也显式加当前用户约束。
- AI API 必须携带 Supabase access token。
- AI API 服务端只验证 token 和邮箱白名单，不读取历史账单。
- AI 只解析当前输入文本，不直接写数据库，不做统计。
- AI 解析结果必须经过服务端清洗、前端确认和用户保存。
- 统计由代码基于 Supabase 当前用户查询结果或本地缓存数据计算，不调用 AI。
- IndexedDB 缓存按 `user_id` 隔离。
- Service Worker 不缓存 `/api/*`、Supabase 请求、登录响应、AI API 响应或任何包含用户数据的网络响应。
- 在线退出成功后会清理当前用户本设备账单缓存和手动草稿。

## 数据规则

核心表：`public.transactions`

字段摘要：

```text
id
user_id
type
amount
currency
category
tag
merchant
payment_method
account
date
note
raw_text
source
ai_confidence
created_at
updated_at
```

主要规则：

- `user_id` 是当前 Supabase Auth 用户 id。
- `type` 只能是 `expense`、`income`、`transfer`。
- `amount` 入库必须大于 0。
- 支出和收入方向由 `type` 表示，不使用负数入库。
- 当前固定货币为 `CNY`。
- 默认分类为：`餐饮`、`交通`、`购物`、`住房`、`学习`、`医疗`、`娱乐`、`日用`、`旅行`、`订阅`、`人情`、`收入`、`转账`、`其他`。
- 非默认分类会归一到 `其他`。
- `source` 只能是 `manual` 或 `ai`。
- `ai_confidence` 可以为空，不为空时必须在 0 到 1 之间。
- `transfer` 暂不计入收入、支出和结余。

## 环境变量

本地 `.env.local` 和 Vercel Project Settings 需要配置以下变量。不要在文档、代码或提交记录中写真实值。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Supabase publishable key。
- `AI_PROVIDER`：当前代码仅支持 `openai`。
- `OPENAI_API_KEY`：OpenAI-compatible provider API key，仅服务端使用。
- `OPENAI_BASE_URL`：OpenAI-compatible API base URL，可为空，默认使用 OpenAI URL。
- `OPENAI_MODEL`：解析账单使用的模型名，未配置时使用代码默认模型。
- `ALLOWED_EMAILS`：允许使用 AI 解析接口的邮箱白名单，逗号分隔。

## 本地开发

安装依赖：

```bash
npm install
```

配置本地环境变量：

```text
手动创建 .env.local，并填入上面的环境变量名和本地值。
不要提交 .env.local。
```

启动开发服务：

```bash
npm run dev
```

基础检查：

```bash
npm run lint
npm run build
```

本地验证 Service Worker 时需要使用生产构建：

```bash
npm run build
npm run start
```

`next dev` 环境不会注册 Service Worker。

## Supabase 初始化

当前 migration 文件：

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

`001_create_transactions.sql` 创建 `transactions` 表、约束、索引、RLS policy 和 `updated_at` trigger。

`002_grant_transactions_permissions.sql` 授权 authenticated 角色访问 `transactions`。

如果出现 `permission denied for table transactions`，优先检查 `002_grant_transactions_permissions.sql` 是否已经在 Supabase SQL Editor 执行。

## 部署

当前部署平台：Vercel。

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

部署注意事项：

- Vercel 连接 GitHub `main` 分支。
- 环境变量在 Vercel Project Settings 配置。
- 修改环境变量后需要 redeploy。
- 排查环境变量问题时，redeploy 建议不要勾选 `Use existing Build Cache`。
- Supabase Auth URL Configuration 需要配置生产地址和 Vercel preview redirect URLs。
- 如果在 Vercel Domains 中绑定自有域名，也需要把该域名加入 Supabase Auth Site URL / Redirect URLs。
- 不要把 `.env.local`、API key、Supabase key、数据库密码或其他密钥提交到 GitHub。

## 当前限制

- 当前是 Web/PWA，不是真正原生 iOS / Android App。
- iOS / Android App 在平级仓库 `D:\fox\foxledger-app` 开发，当前完成到 v0.5；本仓库仍是 Web/PWA 稳定维护线。
- 当前 AI 后端仍在 Web/Next API：`app/api/parse-transaction/route.ts`。
- 当前没有完整离线正式记账、离线新增/编辑/删除队列或冲突合并。
- 当前 Web 版使用 IndexedDB 本地缓存，没有本地 SQLite 缓存。
- 当前没有原生推送。
- 当前没有 Capacitor 封装。
- 当前没有自定义分类、账户、支付方式管理。
- 当前不支持多币种和汇率。
- CSV 导入只做追加新增，不做覆盖、合并或自动去重。
- 账单删除是直接删除，支持单条删除和当前已加载账单的多选删除，不支持恢复、按日期范围删除或删除全部账单。
- 手动草稿仅保存在本设备，不会自动上传，也不会进入统计。
- Service Worker 只缓存应用外壳和静态资源，不缓存 Supabase 或 API 用户数据。
- `components/TransactionList.tsx` 仍保留在仓库中，但当前主界面不再使用首页最近账单模块。
- 当前没有单元测试或 E2E 测试脚本，提交前主要依赖 `npm run lint` 和 `npm run build`。

## App v0.x 方向

Web/PWA v2.1 将作为稳定维护版保留。独立 App 仓库已经在当前仓库平级创建：

```text
D:\fox\
  foxledger\        # 当前 Web/PWA v2.1，稳定维护
  foxledger-app\    # Expo React Native App v0.x，当前至 v0.5
```

App v0.x 目标不是新增大功能，而是迁移 Web/PWA v2.1 已有核心能力，并针对 iOS + Android 做体验和性能优化。当前 App v0.5 已接入现有 Web/Next AI API 完成文本解析、候选确认和用户保存到 Supabase 的最小闭环。推荐技术路线：

```text
Expo React Native + TypeScript
Expo Router
Supabase JS
TanStack Query
SQLite
FlashList
现有 Next.js AI API 先作为过渡后端
```

App v0.x 阶段不应改变 Supabase schema，不应绕过 RLS，不应把 AI key 放进 App，不应把 AI 对话、离线正式记账、自定义分类等 v1.0 之后的功能提前写成已完成。详细迁移方案见 `APP_MIGRATION_PLAN.md`。
