# FoxLedger

FoxLedger / 狐狐记账是一个自用 AI 记账 App。

当前阶段：第 15 阶段，Vercel 部署。

当前页面已接入 Supabase Auth。登录后可以通过手动记账表单新增一笔账单，并保存到 Supabase 的 `public.transactions` 表；首页最近账单会读取当前登录用户自己的真实账单，并支持编辑和删除自己已有的账单。AI 记账输入框已接入 `/api/parse-transaction`，可以把当前输入的一句话解析成可编辑确认卡片，用户确认后再保存到数据库。首页本月概览、分类支出排行和每日支出趋势已改为真实统计。当前已支持手动上传 CSV，预览确认后批量导入合法账单，并已添加基础 PWA manifest、App 图标和移动端安全区优化。项目已部署到 Vercel，线上 AI 解析链路已验证可用。

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

- AI 暂不支持多轮对话。
- 暂未支持跨月筛选、年度统计、预算、中文表头识别和微信 / 支付宝 / 银行卡自动导入。
- PWA 当前只支持基础安装信息和手机端显示优化，不支持离线记账、离线同步或 push notification。
- 当前已登录用户都可以调用 AI 解析；如果只想本人使用，后续需要增加账号白名单。

第 13 阶段 CSV 导入规则：

- 第一版只做用户手动上传 CSV、预览确认后追加写入当前登录用户自己的 `transactions`。
- CSV 必须包含 `date`、`amount`、`type` 三个表头。
- 推荐格式是 `date,amount,type,category,note`。
- 列顺序不限，多余列会忽略。
- `amount` 必须大于 0，`type` 只能是 `expense` / `income` / `transfer`，`date` 必须是 `YYYY-MM-DD`。
- `currency` 为空时默认 `CNY`，`category` 为空时默认 `其他`，`source` 为空或非法时默认 `manual`。
- 错误行不会入库；只要至少一行合法，就可以确认导入合法行。

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

第 12 阶段新增的关键文件：

```text
components/StatsPanel.tsx
lib/stats.ts
```

统计规则：

- 统计只读取当前登录用户自己的 `transactions`。
- 本月支出统计 `type = expense`。
- 本月收入统计 `type = income`。
- 本月结余 = 收入 - 支出。
- `transfer` 暂不计入收入、支出和结余。
- 统计不调用 AI。

第 13 阶段新增的关键文件：

```text
components/ImportTransactions.tsx
lib/csvImport.ts
```

CSV 导入不新增数据库结构，不使用 `service_role key`，也不接 AI。

第 14 阶段新增的关键文件：

```text
app/manifest.ts
app/icons/icon-192/route.tsx
app/icons/icon-512/route.tsx
app/icons/apple-touch-icon/route.tsx
lib/pwaIcon.tsx
```

PWA 优化规则：

- 使用 Next.js 原生 `manifest.ts` 和图标 route。
- 不引入额外 PWA 库。
- 不注册 service worker。
- 不缓存 Supabase 用户数据。
- 当前仍然是联网 App。

第 15 阶段 Vercel 部署信息：

- 生产地址：`https://foxledger.vercel.app`
- Vercel 使用 GitHub `main` 分支部署。
- 线上 AI 链路：Vercel API Route -> CPA 公网地址 -> Gemini。
- CPA 公网地址使用 `OPENAI_BASE_URL` 配置，当前应指向 `https://cpa-api.foxyang.com/v1`。
- CPA API Key 使用 `OPENAI_API_KEY` 配置，只能放在 Vercel 环境变量里，不能提交到 Git。
- 线上 AI 解析已验证可用。

Vercel 生产环境变量：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

部署规则：

- 修改 Vercel 环境变量后必须重新部署。
- 重新部署时建议不要勾选 `Use existing Build Cache`。
- 不要配置 Supabase `service_role key`。
- 不要把 `.env.local`、CPA API Key 或 OpenAI API Key 提交到 Git。

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
