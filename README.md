# FoxLedger / 狐狐记账

FoxLedger 是一个自用 AI 记账 Web App / PWA 雏形，目标是用尽量简单、可维护的技术栈完成个人记账闭环：登录、记账、AI 辅助解析、账单管理、统计和批量导入。

当前生产地址：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

当前定位：第一版核心功能已经打通，适合作为个人长期自用项目继续迭代，不是商业化 SaaS，也不是多人共享账本。

## 功能列表

已完成：

- 邮箱 + 密码登录和注册，基于 Supabase Auth。
- 手动新增账单，写入 Supabase `public.transactions`。
- 最近账单读取真实数据。
- 编辑账单，只允许更新 `type`、`amount`、`category`、`date`、`merchant`、`payment_method`、`note`。
- 删除账单，删除前二次确认。
- AI 一句话记账解析，调用 OpenAI-compatible API。
- AI 解析结果确认卡片，用户确认后才入库。
- AI 解析 API 账号白名单，使用 `ALLOWED_EMAILS` 限制可调用邮箱。
- 本月收入、支出、结余统计。
- 分类支出排行。
- 每日支出趋势。
- 宽松版 CSV 导入，预览确认后追加导入合法账单。
- 基础 PWA metadata、manifest 和 App 图标。
- Vercel 生产部署。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- OpenAI-compatible API provider
- Vercel
- lucide-react
- ESLint

## 目录结构

当前主要目录：

```text
app/
  api/parse-transaction/route.ts
  icons/
  layout.tsx
  manifest.ts
  page.tsx
components/
  AuthGate.tsx
  AuthForm.tsx
  ChatInput.tsx
  ConfirmTransaction.tsx
  Dashboard.tsx
  EditTransactionForm.tsx
  ImportTransactions.tsx
  ManualTransactionForm.tsx
  StatsPanel.tsx
  TransactionList.tsx
lib/
  ai.ts
  aiTransactions.ts
  allowedEmails.ts
  csvImport.ts
  stats.ts
  supabase.ts
  transactions.ts
  validators.ts
supabase/migrations/
  001_create_transactions.sql
  002_grant_transactions_permissions.sql
types/
  transaction.ts
```

## 数据模型

核心表：

```text
public.transactions
```

字段：

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

关键约束：

- `user_id` references `auth.users(id)`。
- `type` 只能是 `expense` / `income` / `transfer`。
- `amount` 使用 `numeric(12, 2)`，必须大于 0。
- `currency` 默认 `CNY`。
- `category` 默认 `其他`。
- `source` 只能是 `manual` / `ai`。
- `ai_confidence` 可以为空，不为空时必须在 0 到 1 之间。
- `updated_at` 由 trigger 自动更新。

## 数据安全与权限

- Supabase RLS 已开启。
- 用户只能读取、创建、修改、删除自己的 `transactions`。
- 前端只使用 Supabase publishable key。
- 项目不使用 Supabase `service_role key`。
- `.env.local` 不提交到 Git。
- AI API key 只放在服务端环境变量中。
- AI 解析 API 必须携带 Supabase access token。
- AI 解析 API 会验证 `ALLOWED_EMAILS` 白名单。
- AI 只接收当前输入文本，不读取历史账单。
- 统计由代码和数据库查询计算，不调用 AI。

## 环境变量

本地 `.env.local` 和 Vercel Project Settings 需要配置以下变量。不要提交真实值。

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

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase project URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Supabase publishable key。
- `AI_PROVIDER`：当前应为 `openai`。
- `OPENAI_API_KEY`：OpenAI-compatible provider API key。
- `OPENAI_BASE_URL`：OpenAI-compatible API base URL，格式类似 `https://example.com/v1`。
- `OPENAI_MODEL`：当前 provider 支持的模型名。
- `ALLOWED_EMAILS`：允许调用 AI 解析的邮箱，多个邮箱用英文逗号分隔。

## 本地开发

安装依赖：

```bash
npm install
```

创建 `.env.local` 并填入环境变量。

启动开发服务器：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

检查代码：

```bash
npm run lint
npm run build
```

安全检查：

```bash
npm audit --audit-level=moderate
```

## Supabase 设置

需要在 Supabase SQL Editor 执行：

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

`001_create_transactions.sql` 创建 `transactions` 表、约束、RLS policies、`updated_at` trigger 和常用索引。

`002_grant_transactions_permissions.sql` 授权 authenticated role 访问 `transactions` 表。

Supabase Auth URL Configuration 建议包含：

```text
Site URL:
https://foxledger.vercel.app

Additional Redirect URLs:
http://localhost:3000/**
https://*.vercel.app/**
```

如果使用具体 Vercel preview 域名，也可以加入对应 preview URL。

## 部署

当前部署平台：Vercel

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

部署方式：

- Vercel 连接 GitHub 仓库。
- `main` 分支 push 后触发部署。
- 环境变量在 Vercel Project Settings 配置。
- 修改 Vercel 环境变量后需要重新部署。
- 重新部署排查环境变量问题时，建议不勾选 `Use existing Build Cache`。

当前线上 AI 链路：

```text
FoxLedger frontend
-> /api/parse-transaction
-> OpenAI-compatible API configured by OPENAI_BASE_URL
-> model configured by OPENAI_MODEL
```

## 当前限制

- 当前是单页 Web/PWA 雏形，不是完整原生 App。
- 注册入口尚未做整站账号白名单限制。
- AI 白名单只限制 AI 解析 API，不限制手动记账等普通功能。
- 统计只覆盖本月，不支持跨月、年度或自定义日期范围。
- CSV 导入只支持英文表头，不支持中文表头自动识别。
- CSV 导入不自动去重、不覆盖已有账单。
- 暂不支持微信、支付宝、银行卡原始账单自动导入。
- 暂不支持预算、账户管理、支付方式管理。
- PWA 只包含基础 manifest 和图标，没有 service worker、离线记账或 push notification。
- 搜索、通知、设置入口目前是界面占位或基础导航，不是完整功能。
- 项目还没有自动化测试覆盖。

## Roadmap

下一版本可以考虑：

- UI/UX 优化，减少首页信息密度，改善移动端交互。
- 更完整的统计，包括跨月筛选、年度统计和自定义日期范围。
- 预算功能。
- 多账户、支付方式和分类管理增强。
- 数据导出。
- PWA 安装体验优化。
- 错误提示和空状态优化。
- AI 解析兼容性和失败重试优化。
- 整站账号白名单或关闭公开注册。
- 测试覆盖，包括 CSV parser、AI validator 和 transactions 数据操作。

