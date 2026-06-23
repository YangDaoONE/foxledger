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

## 10. V1.3 计划：账单搜索、筛选与删除

目标：把底部导航中的“账单”子界面升级为真正可查、可筛选、可排序、可安全批量删除的账单页。首页最近账单继续保持简洁，不加入批量管理。

必须保持的安全边界：

- 必须保持 Supabase RLS。
- 只能读取和删除当前登录用户自己的账单。
- 不使用 Supabase `service_role key`。
- 不绕过 RLS。
- 不新增管理员删除接口。
- 不允许前端传入任意 `user_id` 决定删除对象。
- 所有删除操作除了依赖 RLS，也要显式约束当前登录用户。
- 未登录用户不能查询或删除账单。
- 保留现有单条编辑和单条删除功能。
- 删除操作只删除 `transactions` 数据，不删除 Auth 用户、账号、配置、环境变量或数据库表。

### V1.3 第一阶段：账单搜索、筛选、排序与加载更多

已完成：

- 新增账单页专用组件，首页继续使用最近 5 笔账单组件。
- 支持搜索商户、备注、分类，一个关键词同时匹配 `merchant` / `note` / `category`。
- 支持类型筛选：全部、支出、收入、转账。
- 支持分类筛选，分类选项合并默认分类和当前用户已有账单分类。
- 支持开始日期和结束日期筛选，日期范围包含开始和结束当天。
- 支持排序：日期倒序、日期正序、金额倒序、金额正序。
- 支持“加载更多”，移动端优先，不做传统分页。
- 支持一键清空筛选条件。
- 显示筛选结果下的总收入、总支出和交易笔数。
- 提供加载状态、查询失败状态、无账单状态和无匹配结果状态。
- 查询仍然显式约束当前登录用户，并依赖 Supabase RLS。

本阶段不做：

- 不做多选删除。
- 不做按日期范围删除。
- 不做删除全部账单。
- 不新增表，不修改 schema。
- 不改 AI 解析链路。

### V1.3 第二阶段：多选删除

已完成：

- 在账单页增加“管理”模式。
- 每条账单显示复选框。
- 显示已选择数量。
- 支持全选当前已加载、当前可见的账单。
- 支持取消全选和退出管理模式。
- 支持删除已选择账单。
- 筛选、排序、日期或加载批次变化时清空当前选择，避免误删不可见账单。
- 删除前显示正式确认 UI，不使用浏览器原生 `confirm()`。
- 删除按钮在未选择账单时禁用，删除过程中禁用以防重复提交。
- 删除失败时保留选择状态并显示错误信息。
- 删除成功后显示实际删除数量，并刷新账单页、首页最近账单、首页概览和统计数据。
- 批量删除函数内部获取当前用户，并显式使用 `.in("id", ids).eq("user_id", user.id)`。

### V1.3 第三阶段：按日期范围删除

计划：

- 在账单管理区域增加“按日期批量删除”。
- 只按日期范围删除，不受当前搜索词、分类筛选或类型筛选影响。
- 删除前先查询该日期范围内会影响多少条账单。
- 确认界面显示日期范围、账单数量和永久删除警告。
- 删除时显式约束当前用户和日期范围。

### V1.3 第四阶段：删除全部账单

计划：

- 在账单页底部增加独立“危险操作”区域。
- 删除当前登录用户的全部账单，不受当前搜索和筛选条件影响。
- 删除前查询当前用户账单总数。
- 强提醒说明将永久删除全部 N 条账单、当前版本无法恢复。
- 最终确认前要求输入确认文字：`删除全部`。
- 删除成功后清空账单列表、筛选条件、多选状态，并刷新首页和统计。
