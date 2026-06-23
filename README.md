# FoxLedger / 狐狐记账

FoxLedger 是一个个人自用的 AI 记账 Web/PWA，基于 Next.js、Supabase 和 OpenAI-compatible API。当前版本为 **v1.1 功能完成版**，已经完成从“一句话 AI 记账”到“批量文本账单录入工具”的升级。

生产地址：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

项目定位：个人长期自用记账工具，不是商业化 SaaS，也不是多人共享账本。最高优先级是数据安全、RLS 用户隔离、记账准确性、代码简单可维护和手机端可用性。

## 当前功能

### 账号与安全

- Supabase Auth 邮箱 + 密码登录和注册。
- 前端只使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- `public.transactions` 表启用 RLS。
- 用户只能读取、创建、修改、删除自己的账单。
- 项目不使用 Supabase `service_role key`。
- `.env.local` 不提交到 Git。

### 记账

- 手动新增账单，写入 `public.transactions`。
- AI 批量解析文本账单：
  - 单次输入最多 `3000` 字。
  - 单次最多返回 `50` 条候选账单。
  - API 始终返回批量结构，即使只有一笔账单也返回数组。
  - AI 只能解析用户本次输入文本，不读取历史账单或统计数据。
  - AI 不直接写数据库。
  - 服务端会对 AI JSON 做二次校验、清洗和候选数量截断。
  - 每条候选优先保存对应 `raw_text` 原文片段，无法可靠切分时才 fallback 为完整输入。
  - 日期由服务端二次处理：完整日期优先，`今天` / `昨天` / `前天` 按服务端日期推算，缺失日期使用服务端今天。
  - 所有候选必须经过前端确认后才能入库。
- 批量确认 UI：
  - 每条候选可编辑类型、金额、分类、日期、商家、支付方式和备注。
  - 每条候选可删除或取消选择，二者是独立行为。
  - 不明确候选可以在确认页补全必要字段后保存。
  - 确认保存时使用一次 Supabase `insert` 写入多条记录。

### 账单管理

- 首页显示最近 5 笔账单。
- 账单子界面显示全部账单。
- 全部账单按年份、月份、日期分组。
- 支持编辑账单。
- 支持删除账单，删除前二次确认。
- 更新和删除都同时约束 `id` 和当前 `user_id`。

### 统计

- 本月总支出。
- 本月总收入。
- 本月结余。
- 分类支出排行。
- 每日支出趋势。
- 统计由代码和数据库查询计算，不调用 AI。

### 导入与界面

- 设置子界面提供宽松版 CSV 导入。
- CSV 导入为前端解析、预览、确认后追加写入。
- 错误行不入库，合法行可以单独导入。
- 移动端优先单页布局。
- 底部导航切换 `首页` / `账单` / `统计` / `设置` 四个子界面。
- 基础 PWA metadata、manifest 和动态图标。
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

## 主要目录

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
  BottomNav.tsx
  ChatInput.tsx
  ConfirmTransaction.tsx
  ConfirmTransactionBatch.tsx
  Dashboard.tsx
  EditTransactionForm.tsx
  ImportTransactions.tsx
  ManualTransactionForm.tsx
  MonthlySummary.tsx
  StatsPanel.tsx
  TransactionCard.tsx
  TransactionList.tsx
lib/
  ai.ts
  aiTransactions.ts
  allowedEmails.ts
  csvImport.ts
  parseTransactionLimits.ts
  stats.ts
  supabase.ts
  transactionDrafts.ts
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
- 支出和收入方向由 `type` 表示，不使用负数入库。
- `currency` 固定为 `CNY`。
- `category` 默认 `其他`。
- `source` 只能是 `manual` / `ai`。
- `ai_confidence` 可以为空，不为空时必须在 0 到 1 之间。
- `updated_at` 由 trigger 自动更新。

## AI 解析链路

```text
frontend ChatInput
-> /api/parse-transaction
-> validate Supabase access token
-> assert ALLOWED_EMAILS
-> OpenAI-compatible API
-> server-side JSON parse, sanitize, validate, truncate
-> ConfirmTransactionBatch
-> user confirms
-> Supabase insert
```

安全边界：

- `/api/parse-transaction` 必须登录后调用。
- 前端请求必须携带 `Authorization: Bearer <supabase_access_token>`。
- 服务端只验证 token 和白名单，不读取历史账单。
- `ALLOWED_EMAILS` 未命中返回 `403`。
- AI 返回内容必须先 `JSON.parse`。
- AI 返回结果必须服务端二次校验和清洗。
- AI 不允许直接写数据库。
- AI 不允许计算统计。

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
- `ALLOWED_EMAILS`：允许调用 AI 解析 API 的邮箱，多个邮箱用英文逗号分隔。

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

## 部署

当前部署平台：Vercel

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

部署方式：

- Vercel 连接 GitHub 仓库。
- `main` 分支 push 后触发部署。
- 环境变量在 Vercel Project Settings 配置。
- 修改 Vercel 环境变量后需要重新部署。
- 重新部署排查环境变量问题时，建议不勾选 `Use existing Build Cache`。

## 当前限制

- 注册入口仍然公开；白名单目前只限制 AI 解析 API。
- AI 批量解析不读取历史账单，不自动去重。
- 搜索和通知入口仍是界面占位。
- 设置页当前只承载 CSV 导入，尚未做完整偏好设置。
- 统计只支持本月，不支持跨月、年度或自定义日期范围。
- CSV 导入只支持英文表头，不支持中文表头自动识别。
- CSV 导入不自动去重、不覆盖已有账单。
- 暂不支持微信、支付宝、银行卡原始账单自动导入。
- 暂不支持预算、账户管理、支付方式管理。
- PWA 只有基础 manifest 和图标，没有 service worker、离线记账或 push notification。
- 项目还没有自动化测试覆盖。

## Roadmap

下一阶段建议从 v1.2 统计增强开始：

- 本周 / 本月 / 上月 / 自定义日期范围。
- 年度统计。
- 分类支出趋势。
- Top 商户统计。
- 支付方式统计。
- 收入、支出、结余趋势图。

后续版本候选：

- v1.3：分类、账户、支付方式管理。
- v2.0：PWA / App 化、安装引导、本地草稿、离线记账和恢复同步。
