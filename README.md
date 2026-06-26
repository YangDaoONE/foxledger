# FoxLedger / 狐狐记账

FoxLedger 是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA 雏形。它面向个人日常记账场景，解决“快速记录、确认入库、查看真实账单、统计分析、弱网或离线时查看上次同步数据”的闭环问题。

当前基线是 v2.1：项目已经完成登录、手动记账、AI 批量解析、CSV 导入、账单管理、统计 drilldown、本地缓存、离线只读 UI、手动草稿和 Service Worker 外壳缓存。项目仍定位为自用工具，优先级是数据安全、用户隔离、记账准确性、移动端可用性和维护简单。

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

## 功能列表

- Supabase 邮箱密码登录和会话保护。
- `public.transactions` 表、约束、索引、RLS policy 和 authenticated 权限授权。
- 首页本月概览。
- 首页手动记账加号入口，点击后展开手动记账表单。
- 手动记账支持类型、金额、分类、日期，以及可折叠的商家、支付方式、备注。
- 手动记账草稿保存在本设备 IndexedDB，不是正式账单，不参与统计。
- AI 文本账单解析，支持单条和批量候选。
- AI 解析结果必须经用户确认、编辑和选择后才能批量写入数据库。
- AI API 登录校验和邮箱白名单。
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
- 统计由代码基于数据库查询结果或当前用户本地缓存计算，不调用 AI。
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

- 当前是个人 Web App / PWA 雏形，不是完整商业产品。
- 当前没有自定义分类、账户、支付方式管理。
- 当前没有预算、预测、自动建议或 AI 消费分析。
- 当前没有离线正式记账、离线新增/编辑/删除队列或冲突合并。
- 手动草稿仅保存在本设备，不会自动上传，也不会进入统计。
- Service Worker 只缓存应用外壳和静态资源，不缓存 Supabase 或 API 用户数据。
- CSV 导入只做追加新增，不做覆盖、合并或自动去重。
- 账单删除支持单条删除和当前已加载账单的多选删除，不支持按日期范围删除或删除全部账单。
- `components/TransactionList.tsx` 仍保留在仓库中，但当前主界面不再使用首页最近账单模块。
- 当前没有单元测试或 E2E 测试脚本，提交前主要依赖 `npm run lint` 和 `npm run build`。
- 没有 Capacitor App 封装、push notification 或后台定时同步。
