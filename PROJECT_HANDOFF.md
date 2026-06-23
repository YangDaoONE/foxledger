# PROJECT_HANDOFF.md

这是 FoxLedger 项目的新对话交接文件。后续 ChatGPT/Codex 对话开始前，应先阅读本文件、`README.md` 和 `AGENTS.md`。

## 1. 一句话总结

FoxLedger / 狐狐记账是一个个人 AI 记账 Web/PWA，基于 Next.js、Supabase 和 OpenAI-compatible API。当前已经完成 v1.2：登录、手动记账、AI 批量文本账单解析、批量确认入库、账单管理、CSV 导入、日期范围统计、移动端子界面导航、PWA metadata 和 Vercel 部署均已打通。

## 2. 当前线上地址

Production URL:

[https://foxledger.vercel.app](https://foxledger.vercel.app/)

Vercel 使用 GitHub `main` 分支部署。

## 3. 当前技术栈

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

## 4. 当前完成状态

### v1.0 核心闭环

已完成：

- Next.js + TypeScript 项目初始化。
- 移动端优先单页布局。
- Supabase client 配置。
- Supabase Auth 邮箱 + 密码登录/注册。
- `public.transactions` 表、约束、索引、RLS policies 和 grants。
- 手动新增账单。
- 真实账单列表。
- 编辑和删除账单。
- 单条 AI 解析账单、确认后入库。
- AI API 邮箱白名单。
- 宽松版 CSV 导入。
- 本月收入、支出、结余统计。
- 分类支出排行。
- 每日支出趋势。
- 基础 PWA metadata、manifest 和动态图标。
- Vercel 生产部署。

### v1.1 AI 批量文本记账与首页体验优化

已完成：

- AI 解析从单条升级为批量候选。
- `/api/parse-transaction` 稳定返回 `{ transactions, truncated, max_transactions, max_input_chars }`。
- 单次输入长度限制为 `MAX_PARSE_INPUT_CHARS = 3000`。
- 单次候选数量限制为 `MAX_PARSED_TRANSACTIONS = 50`。
- AI prompt、服务端校验、前端提示共用同一组限制常量。
- 服务端对 AI 返回的 `transactions` 执行截断，超量时返回 `truncated = true`。
- 服务端逐条 JSON parse、sanitize、validate。
- 每条候选优先保存 AI 返回且能在完整输入中找到的 `raw_text` 原文片段；无法可靠切分时 fallback 完整输入。
- 日期由服务端从原文片段二次处理：完整年月日优先，支持 `今天` / `昨天` / `前天`、中文月日和 `5.30号` / `5/30` / `5-30` 等无年份日期，缺失日期使用服务端今天。
- 前端批量确认列表支持逐条编辑、删除、取消选择。
- 删除候选和取消选择是独立行为。
- 不明确候选可以在确认页补全金额、类型、分类和日期后保存。
- 批量保存使用一次 Supabase `insert` 写入多条记录。
- 批量保存成功后清空 AI 输入和候选列表。
- 底部导航改为真正的子界面切换：`首页` / `账单` / `统计` / `设置`。
- 首页只保留本月概览、手动记账、AI 批量记账和最近 5 笔账单。
- 账单子界面显示全部账单，并按年份、月份、日期分组。
- 设置子界面承载 CSV 导入。

### v1.2 日期范围统计增强

已完成：

- `lib/stats.ts` 支持按 `startDate` 和 `endDate` 计算统计。
- 保留 `getMonthlyStats()` 给首页本月概览使用。
- 统计页支持范围：
  - 本周。
  - 本月。
  - 上月。
  - 今年。
  - 自定义日期范围。
- 自定义范围校验开始日期和结束日期，开始日期不能晚于结束日期。
- 每个范围展示：
  - 总支出。
  - 总收入。
  - 结余。
  - 交易笔数。
  - 日均支出。
  - 最大单笔支出。
  - 分类支出排行。
  - 每日支出趋势。
- 金额规则：
  - `expense` 计入支出。
  - `income` 计入收入。
  - `balance = income - expense`。
  - `transfer` 暂不计入收入、支出、结余。
  - `amount` 按正数处理。
- 统计只读取当前登录用户自己的 `transactions`。
- 统计由代码和数据库查询计算，不调用 AI。
- 首页本月概览只由 `Dashboard` 调用 `getMonthlyStats()` 更新，统计页范围切换不会污染首页概览。
- 本阶段未新增表、未修改 schema、未使用 `service_role key`。

## 5. 关键文件地图

### 页面和布局

```text
app/page.tsx
app/layout.tsx
app/globals.css
app/manifest.ts
app/icons/
```

### 核心组件

```text
components/AuthGate.tsx
components/AuthForm.tsx
components/Dashboard.tsx
components/BottomNav.tsx
components/MonthlySummary.tsx
components/ManualTransactionForm.tsx
components/ChatInput.tsx
components/ConfirmTransactionBatch.tsx
components/TransactionList.tsx
components/TransactionCard.tsx
components/EditTransactionForm.tsx
components/StatsPanel.tsx
components/ImportTransactions.tsx
```

### 业务逻辑

```text
lib/supabase.ts
lib/transactions.ts
lib/stats.ts
lib/ai.ts
lib/aiTransactions.ts
lib/validators.ts
lib/transactionDrafts.ts
lib/parseTransactionLimits.ts
lib/csvImport.ts
lib/allowedEmails.ts
```

### API 和类型

```text
app/api/parse-transaction/route.ts
types/transaction.ts
```

### Supabase migration

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

## 6. 当前数据模型摘要

表：

```text
public.transactions
```

字段：

```text
id uuid primary key
user_id uuid references auth.users(id)
type text
amount numeric(12, 2)
currency text
category text
tag text nullable
merchant text nullable
payment_method text nullable
account text nullable
date date
note text nullable
raw_text text nullable
source text
ai_confidence numeric nullable
created_at timestamptz
updated_at timestamptz
```

约束：

- `amount > 0`
- `type in ('expense', 'income', 'transfer')`
- `source in ('manual', 'ai')`
- `ai_confidence` 为空或在 0 到 1 之间

RLS policies：

- select own transactions
- insert own transactions
- update own transactions
- delete own transactions

常用索引：

- `(user_id, date desc)`
- `(user_id, category)`
- `(user_id, created_at desc)`

## 7. 当前环境变量摘要

不要在文档、代码或提交中写真实值。

本地 `.env.local` 和 Vercel 需要：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

含义：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase project URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Supabase publishable key。
- `AI_PROVIDER`：当前为 `openai`。
- `OPENAI_API_KEY`：OpenAI-compatible provider API key。
- `OPENAI_BASE_URL`：OpenAI-compatible API base URL，示例格式 `https://example.com/v1`。
- `OPENAI_MODEL`：provider 支持的模型名。
- `ALLOWED_EMAILS`：允许调用 AI 解析的邮箱列表，英文逗号分隔。

## 8. 当前安全边界

- `.env.local` 已在 `.gitignore` 中。
- 不使用 Supabase `service_role key`。
- 所有账单数据访问依赖 Supabase Auth + RLS。
- 前端查询、更新、删除仍显式约束当前 `user_id`。
- AI 解析 API 需要 Supabase access token。
- AI 解析 API 需要 `ALLOWED_EMAILS` 命中。
- AI 只接收当前输入文本。
- AI 不读取历史账单。
- AI 不直接写数据库。
- AI 不计算统计。
- AI 候选必须经用户确认后才由前端 Supabase client 写入数据库。
- 统计由代码和数据库查询计算，不调用 AI。
- 统计查询只读取当前用户自己的 `transactions`。
- CSV 导入要求用户预览确认后入库。

## 9. 当前已知限制

- 注册入口仍然公开；白名单目前只限制 AI 解析 API。
- AI 批量解析不读取历史账单，不自动去重。
- AI 批量解析的 `raw_text` 片段依赖 AI 切分，服务端只接受能在完整输入中找到的片段，否则 fallback 完整输入。
- 搜索和通知入口仍是界面占位。
- 设置页当前只承载 CSV 导入，尚未做完整偏好设置。
- 统计已有日期范围切换，但还没有趋势图可视化、Top 商户统计和支付方式统计。
- 没有预算功能。
- 没有账户、支付方式、分类的独立管理。
- CSV 导入只支持英文表头，不支持中文表头和平台原始账单格式。
- CSV 导入不做自动去重。
- 没有数据导出功能。
- PWA 没有 service worker、离线记账、离线同步、push notification。
- 没有自动化测试覆盖。
- iOS/Android 原生封装尚未开始。

## 10. 下一阶段建议

下一阶段建议进入 **v1.3 分类、账户、支付方式管理**。

候选功能：

- 自定义分类。
- 自定义账户。
- 自定义支付方式。
- 常用商户和默认分类映射。
- 默认货币设置。

约束：

- 如果需要新增表或修改 schema，必须先提出 migration 方案、RLS 方案和回滚风险说明，用户确认后再实现。
- 继续保持用户只能操作自己的数据。
- 不使用 Supabase `service_role key`。
- 不绕过 RLS。

更后续版本：

- v2.0：PWA / App 化、安装引导、本地草稿、离线记账和恢复同步。
