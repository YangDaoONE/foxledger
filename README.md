# FoxLedger

FoxLedger / 狐狐记账是一个自用 AI 记账 App。

当前阶段：第 8 阶段，删除账单。

当前页面已接入 Supabase Auth。登录后可以通过手动记账表单新增一笔账单，并保存到 Supabase 的 `public.transactions` 表；首页最近账单会读取当前登录用户自己的真实账单，并支持编辑和删除自己已有的账单。

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
- 暂未接入 AI 解析。

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

## Environment

本地需要创建 `.env.local`，并配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

不要提交 `.env.local`。

## Development

```bash
npm install
npm run dev
```

打开 `http://localhost:3000` 查看本地页面。
