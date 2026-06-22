# FoxLedger

FoxLedger / 狐狐记账是一个自用 AI 记账 App。

当前阶段：第 4 阶段，`transactions` 表和 RLS 安全策略。

当前页面已接入 Supabase Auth。登录后显示第 2 阶段的 Mock UI，账单仍然使用本地假数据。

第 4 阶段新增了数据库 migration：

```text
supabase/migrations/001_create_transactions.sql
```

该 SQL 用于创建 `public.transactions` 表、字段约束、RLS policies、`updated_at` trigger 和常用索引。当前暂未做前端写入账单功能。

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
