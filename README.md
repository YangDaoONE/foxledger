# FoxLedger

FoxLedger / 狐狐记账是一个自用 AI 记账 App。

当前阶段：第 5 阶段，手动记账。

当前页面已接入 Supabase Auth。登录后可以通过手动记账表单新增一笔账单，并保存到 Supabase 的 `public.transactions` 表。

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

- 首页最近账单仍然使用 Mock 数据，暂未读取真实账单列表。
- 暂未支持编辑账单。
- 暂未支持删除账单。
- 暂未接入 AI 解析。

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
