# FoxLedger

FoxLedger / 狐狐记账是一个自用 AI 记账 App。

当前阶段：第 11 阶段，AI 确认后入库。

当前页面已接入 Supabase Auth。登录后可以通过手动记账表单新增一笔账单，并保存到 Supabase 的 `public.transactions` 表；首页最近账单会读取当前登录用户自己的真实账单，并支持编辑和删除自己已有的账单。AI 记账输入框已接入 `/api/parse-transaction`，可以把当前输入的一句话解析成可编辑确认卡片，用户确认后再保存到数据库。

已完成的数据库 migration：

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

这些 SQL 用于创建 `public.transactions` 表、字段约束、RLS policies、`updated_at` trigger、常用索引，并授予已登录用户访问 `transactions` 表所需的权限。

如果保存账单时出现 `permission denied for table transactions`，请在 Supabase SQL Editor 执行：

```text
supabase/migrations/002_grant_transactions_permissions.sql
```

当前限制：

- 本月概览和分类支出仍然使用 Mock 数据，真实统计留到后续统计阶段。
- AI 暂不支持多轮对话。

第 6 阶段新增的关键文件：

```text
components/Dashboard.tsx
components/TransactionList.tsx
lib/transactions.ts
```

第 7 阶段新增的关键文件：

```text
components/EditTransactionForm.tsx
```

编辑账单只允许更新以下字段：

```text
type
amount
category
date
merchant
payment_method
note
```

不会更新 `id`、`user_id`、`currency`、`source`、`raw_text`、`ai_confidence`、`created_at`、`updated_at`。

第 8 阶段删除账单规则：

- 删除前必须已登录。
- 删除查询同时使用 `id` 和当前登录用户的 `user_id`。
- 删除后会重新读取真实账单列表。
- 不做批量删除、软删除，也不修改数据库结构。

第 9 阶段新增的关键文件：

```text
app/api/parse-transaction/route.ts
lib/ai.ts
lib/validators.ts
```

AI 解析 API 规则：

- 请求必须携带 `Authorization: Bearer <supabase_access_token>`。
- 服务端只验证 Supabase token，不读取历史账单。
- 只把当前输入文本发送给 AI。
- AI 返回结果必须经过服务端 JSON 解析、校验和清洗。

第 10 阶段新增的关键文件：

```text
components/ConfirmTransaction.tsx
```

AI 确认卡片规则：

- 前端只发送 `{ text }` 到解析 API。
- 确认卡片可以编辑 `type`、`amount`、`category`、`date`、`merchant`、`payment_method`、`note`。
- `currency`、`raw_text`、`source`、`ai_confidence` 只读展示。
- 用户点击确认保存后才写入 `transactions` 表。

第 11 阶段新增的关键文件：

```text
lib/aiTransactions.ts
```

AI 确认后入库规则：

- 保存前重新获取当前登录用户。
- insert payload 显式构造，不直接展开确认卡片对象。
- `amount` 入库前统一转为正数，方向由 `type` 表示。
- `currency` 强制为 `CNY`，`source` 强制为 `ai`。
- 保存成功后刷新真实账单列表。

## Environment

本地需要创建 `.env.local`，并配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-compatible-api-key
OPENAI_BASE_URL=https://your-openai-compatible-base-url/v1
OPENAI_MODEL=your-model-name
```

不要提交 `.env.local`。

## Development

```bash
npm install
npm run dev
```

打开 `http://localhost:3000` 查看本地页面。
