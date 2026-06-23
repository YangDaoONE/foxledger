# PROJECT_HANDOFF.md

这是 FoxLedger 项目的新对话交接文件。后续 ChatGPT/Codex 对话开始前，应先阅读本文件、`README.md` 和 `AGENTS.md`。

## 1. 一句话总结

FoxLedger / 狐狐记账是一个已完成第一版核心闭环的个人 AI 记账 Web/PWA，基于 Next.js、Supabase 和 OpenAI-compatible API，实现登录、记账、AI 解析、确认入库、账单管理、CSV 导入、统计、PWA metadata 和 Vercel 部署。

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

## 4. 当前完成阶段列表

已完成：

1. 初始化项目
   - Next.js + TypeScript 项目已创建。
   - 配置 ESLint、基本 scripts、GitHub remote。

2. Mock UI 页面
   - 建立移动端优先的单页布局。
   - 首页包含概览、手动记账、AI 记账、导入、账单列表和统计区块。

3. Supabase 连接
   - `lib/supabase.ts` 使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 创建客户端。

4. Supabase Auth
   - `components/AuthGate.tsx` 负责 session 检查和退出。
   - `components/AuthForm.tsx` 支持邮箱 + 密码登录/注册。

5. `transactions` 表和 RLS
   - `supabase/migrations/001_create_transactions.sql` 创建表、约束、RLS、policies、trigger 和索引。
   - `supabase/migrations/002_grant_transactions_permissions.sql` 授权 authenticated role。

6. 手动记账
   - `components/ManualTransactionForm.tsx` 支持新增手动账单。
   - 写入 `source = manual`，`currency = CNY`。

7. 最近账单
   - `lib/transactions.ts` 中 `listRecentTransactions()` 读取当前用户账单。
   - `components/TransactionList.tsx` 显示真实账单列表。

8. 编辑/删除
   - `components/EditTransactionForm.tsx` 编辑账单。
   - `deleteTransaction(transactionId)` 删除账单。
   - 更新和删除都同时约束 `id` 和 `user_id`。

9. AI 解析
   - `app/api/parse-transaction/route.ts` 是服务端 API。
   - 验证 Supabase access token。
   - 使用 `ALLOWED_EMAILS` 限制 AI API 调用账号。
   - 调用 `lib/ai.ts` 中 OpenAI-compatible chat completions。
   - `lib/validators.ts` 做请求校验、AI JSON 解析和清洗。

10. AI 确认入库
    - `components/ConfirmTransaction.tsx` 展示和编辑 AI 解析结果。
    - `lib/aiTransactions.ts` 显式构造 insert payload。
    - 用户确认后才写入数据库。

11. CSV 导入
    - `components/ImportTransactions.tsx` 上传、预览、确认导入。
    - `lib/csvImport.ts` 解析 CSV、校验行、生成合法行和错误行。
    - 只做追加导入，不去重、不覆盖。

12. 统计页
    - `lib/stats.ts` 计算本月收入、支出、结余、分类支出排行、每日支出趋势。
    - `components/StatsPanel.tsx` 显示统计结果。
    - 统计不调用 AI。

13. PWA metadata/manifest
    - `app/manifest.ts` 定义 PWA manifest。
    - `app/icons/*/route.tsx` 动态生成图标。
    - `app/layout.tsx` 配置 metadata、manifest、apple touch icon、theme color。

14. Vercel 部署
    - 生产站点为 `https://foxledger.vercel.app`。
    - 线上 AI 链路已验证可用。

15. AI 账号白名单安全加固
    - `lib/allowedEmails.ts` 读取 `ALLOWED_EMAILS`。
    - `/api/parse-transaction` 中非白名单账号返回 `403`。

## 5. 当前数据模型摘要

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
- `ai_confidence` 为空或 0 到 1

RLS policies：

- select own transactions
- insert own transactions
- update own transactions
- delete own transactions

常用索引：

- `(user_id, date desc)`
- `(user_id, category)`
- `(user_id, created_at desc)`

## 6. 当前环境变量摘要

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
- `OPENAI_API_KEY`：OpenAI-compatible provider 或 CPA API key。
- `OPENAI_BASE_URL`：OpenAI-compatible API base URL，示例格式 `https://example.com/v1`。
- `OPENAI_MODEL`：provider 支持的模型名。
- `ALLOWED_EMAILS`：允许调用 AI 解析的邮箱列表，英文逗号分隔。

当前生产环境使用 CPA 公网地址作为 OpenAI-compatible API，不要把 key 写入 Git。

## 7. 当前安全边界

- `.env.local` 已在 `.gitignore` 中。
- 不使用 Supabase `service_role key`。
- 所有账单数据访问依赖 Supabase Auth + RLS。
- AI 解析 API 需要 Supabase access token。
- AI 解析 API 需要 `ALLOWED_EMAILS` 命中。
- AI 只接收当前输入文本。
- AI 不直接写数据库。
- AI 确认卡片由用户确认后，前端 Supabase client 写入数据库。
- 统计由代码和数据库查询计算，不调用 AI。
- CSV 导入要求用户确认后入库。

## 8. 当前已知问题 / 限制

- 注册入口仍然公开；白名单目前只限制 AI 解析 API。
- 首页功能较多，移动端信息密度偏高。
- 搜索、通知、设置入口尚未实现完整功能。
- 统计只支持本月。
- 没有跨月筛选、年度统计、自定义日期范围。
- 没有预算功能。
- 没有账户、支付方式、分类的独立管理。
- CSV 导入只支持英文表头，不支持中文表头和平台原始账单格式。
- CSV 导入不做自动去重。
- 没有数据导出功能。
- PWA 没有 service worker、离线记账、离线同步、push notification。
- 没有自动化测试覆盖。
- iOS/Android 原生封装尚未开始。

## 9. 下一版本推荐开发路线

建议按小阶段推进，不要一次性做大版本。

优先级建议：

1. UI/UX 优化
   - 拆分首页模块或改善折叠/导航。
   - 优化空状态、错误提示、加载状态。

2. 整站账号限制
   - 关闭公开注册，或加整站白名单。
   - 保持 AI 白名单逻辑。

3. 统计增强
   - 月份切换。
   - 年度统计。
   - 自定义日期范围。

4. 基础配置管理
   - 分类管理。
   - 支付方式管理。
   - 账户字段启用。

5. 预算功能
   - 月预算。
   - 分类预算。

6. 数据能力
   - 数据导出。
   - CSV 导入模板。
   - 导入重复检查。

7. 测试覆盖
   - `lib/validators.ts`
   - `lib/csvImport.ts`
   - `lib/transactions.ts`
   - `lib/stats.ts`

8. PWA / App
   - PWA 安装体验优化。
   - 再考虑 Capacitor Android。
   - iOS 需要 Mac 和 Apple Developer 相关条件。

## 10. 新对话启动 Prompt

可以在新 ChatGPT/Codex 对话中使用以下提示：

```text
请先阅读当前仓库中的 AGENTS.md、README.md 和 PROJECT_HANDOFF.md。

这是 FoxLedger / 狐狐记账，一个基于 Next.js + Supabase 的个人 AI 记账 Web/PWA。第一版核心闭环已经完成，包括 Auth、transactions 表/RLS、手动记账、真实账单列表、编辑删除、AI 解析、AI 确认入库、CSV 导入、本月统计、PWA metadata、Vercel 部署和 AI 邮箱白名单。

请严格遵守：
- 不提交 .env.local 或任何密钥。
- 不使用 Supabase service_role key。
- 不绕过 RLS。
- 不让 AI 直接写数据库。
- 统计必须由代码/数据库计算，不调用 AI。
- 每次只做一个小阶段。
- 不主动实现超出本阶段的功能。

接下来我要做的是：[在这里填写具体任务]。

请先根据当前代码给出计划，等我确认后再实施。
```

