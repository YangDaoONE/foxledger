# FoxLedger Web/PWA

FoxLedger / 狐狐记账是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA。本仓库只维护 Web/PWA 版本，以及 Web 侧的 AI 解析 API。

当前 Web/PWA 基线：v2.1 正式版。

生产地址：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

## 当前功能

- Supabase 邮箱密码登录、注册和会话保护。
- `public.transactions` 表、约束、索引、RLS policy 和 authenticated 权限授权。
- 首页本月概览。
- 首页手动记账入口，点击后展开手动记账表单。
- 手动记账支持类型、金额、分类、日期、商家、支付方式和备注。
- 手动记账草稿保存在本设备 IndexedDB，不是正式账单，不参与统计。
- AI 文本账单解析，支持单条和批量候选。
- AI API 登录校验和邮箱白名单。
- AI 解析结果必须经用户确认、编辑和选择后才能批量写入数据库。
- CSV 导入、预览、错误行提示和确认导入。
- 账单搜索、类型筛选、分类筛选、日期范围筛选、排序和加载更多。
- 账单编辑、单条删除和当前已加载账单多选删除。
- 统计页支持本周、本月、上月、今年和自定义日期范围。
- 统计展示总支出、总收入、结余、交易笔数、日均支出、最大单笔支出、分类支出排行和每日支出趋势。
- 统计概览、分类排行和每日趋势支持 drilldown 到账单页并自动应用筛选。
- Supabase 全量同步成功后，将当前用户账单写入 IndexedDB。
- 下次启动先显示本地缓存，再后台同步云端最新数据。
- 首页概览、账单页和统计页基于当前用户本地缓存读取和计算。
- 断网时只允许查看上次同步数据，并显示离线状态和上次同步时间。
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

## 目录结构

```text
app/
  api/parse-transaction/route.ts    AI 解析 API
  manifest.ts                       PWA manifest
  layout.tsx                        metadata 和 Service Worker 注册挂载
  page.tsx                          AuthGate + Dashboard 入口
  icons/*/route.tsx                 PWA 图标路由

components/
  AuthGate.tsx                      登录态守卫、当前用户上下文、退出清理
  AuthForm.tsx                      登录/注册表单
  Dashboard.tsx                     主界面、底部导航、远端同步协调
  BottomNav.tsx                     首页/账单/统计/设置导航
  MonthlySummary.tsx                首页本月概览
  ManualTransactionForm.tsx         手动记账和本设备草稿
  ChatInput.tsx                     AI 文本输入
  ConfirmTransactionBatch.tsx       AI 候选确认与保存
  ImportTransactions.tsx            CSV 导入
  TransactionManager.tsx            账单搜索、筛选、排序、加载更多、多选删除
  TransactionCard.tsx               账单卡片
  EditTransactionForm.tsx           编辑账单
  StatsPanel.tsx                    日期范围统计和 drilldown
  SyncStatusBanner.tsx              在线/离线和同步状态提示
  ServiceWorkerRegistration.tsx     生产环境注册 Service Worker

lib/
  supabase.ts                       Supabase browser client
  transactions.ts                   Supabase 账单读取、远端全量拉取、编辑、删除
  transactionRules.ts               CNY、默认分类、类型、日期等共享规则
  transactionDrafts.ts              AI 确认草稿和保存校验
  ai.ts                             OpenAI-compatible 请求和 prompt
  aiTransactions.ts                 AI 确认后批量入库
  validators.ts                     AI API 输入和返回清洗
  parseTransactionLimits.ts         AI 输入长度和候选数量限制
  csvImport.ts                      CSV 解析和校验
  stats.ts                          统计范围和本地缓存统计入口
  statsCalculator.ts                基于账单数组的纯统计计算
  localDb.ts                        IndexedDB 基础封装
  localTransactions.ts              本地账单查询、筛选、排序和汇总
  transactionSync.ts                Supabase 全量拉取并替换本地缓存
  manualDraft.ts                    本设备手动记账草稿
  networkStatus.ts                  在线/离线状态订阅
  allowedEmails.ts                  AI 邮箱白名单
  format.ts                         金额格式化
  date.ts                           本地日期 input helper
  pwaIcon.tsx                       PWA 图标生成

public/
  sw.js                             Service Worker 外壳缓存
  offline.html                      离线提示页

supabase/migrations/
  001_create_transactions.sql
  002_grant_transactions_permissions.sql

types/
  transaction.ts                    交易、AI 解析、统计类型定义
```

## 数据规则

核心表：`public.transactions`

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

规则：

- `user_id` 是当前 Supabase Auth 用户 id。
- `type` 只能是 `expense`、`income`、`transfer`。
- `amount` 入库必须大于 0。
- 支出和收入方向由 `type` 表示，不使用负数入库。
- 当前固定货币为 `CNY`。
- 默认分类为：`餐饮`、`交通`、`购物`、`住房`、`学习`、`医疗`、`娱乐`、`日用`、`旅行`、`订阅`、`人情`、`收入`、`转账`、`其他`。
- 非默认分类归一为 `其他`。
- `source` 只能是 `manual` 或 `ai`。
- `ai_confidence` 可以为空，不为空时必须在 0 到 1 之间。
- `transfer` 暂不计入收入、支出和结余。

## 安全边界

- 不提交 `.env.local`。
- 不提交任何 API key、Supabase key、OpenAI key、service_role key、数据库密码或其他密钥。
- 前端只使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 不使用 Supabase `service_role` key。
- 不绕过 Supabase RLS。
- 查询、更新、删除除了依赖 RLS，也显式约束当前用户。
- AI API 必须携带 Supabase access token。
- AI API 服务端只验证 token 和邮箱白名单，不读取历史账单。
- AI 只解析当前输入文本，不直接写数据库，不做统计。
- AI 解析结果必须经过服务端清洗、前端确认和用户保存。
- 统计由代码基于当前用户本地缓存数据计算，不调用 AI。
- IndexedDB 缓存按 `user_id` 隔离。
- Service Worker 不缓存 `/api/*`、Supabase 请求、登录响应、AI API 响应或任何包含用户数据的网络响应。
- 在线退出成功后清理当前用户本设备账单缓存和手动草稿。

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

- 部署平台：Vercel。
- 生产主入口：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)
- Vercel 连接 GitHub `main` 分支。
- 环境变量在 Vercel Project Settings 配置。
- 修改环境变量后需要 redeploy。
- 排查环境变量问题时，redeploy 建议不要勾选 `Use existing Build Cache`。
- Supabase Auth URL Configuration 需要包含生产地址和 Vercel preview redirect URLs。
- 如果 Vercel Domains 绑定或变更域名，也要同步更新 Supabase Auth Site URL / Redirect URLs。

## 当前限制

- 当前是 Web/PWA，不是原生 iOS / Android App。
- 当前 AI 后端在本仓库 Next API：`app/api/parse-transaction/route.ts`。
- 当前没有完整离线正式记账、离线新增/编辑/删除队列或冲突合并。
- 当前 Web 版使用 IndexedDB 本地缓存，没有 SQLite。
- 当前没有原生推送。
- 当前没有 Capacitor 封装。
- 当前没有自定义分类、账户、支付方式管理。
- 当前不支持多币种和汇率。
- CSV 导入只做追加新增，不做覆盖、合并或自动去重。
- 账单删除是直接删除，不支持恢复、按日期范围删除或删除全部账单。
- 手动草稿仅保存在本设备，不会自动上传，也不会进入统计。
- Service Worker 只缓存应用外壳和静态资源，不缓存 Supabase 或 API 用户数据。
- 当前没有单元测试或 E2E 测试脚本，提交前主要依赖 `npm run lint` 和 `npm run build`。
