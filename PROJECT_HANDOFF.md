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
- AI 批量解析已支持最多 50 条候选，但不读取历史账单、不自动去重。
- 首页已拆为底部导航子界面，但搜索、通知入口仍是界面占位。
- 设置页当前只承载 CSV 导入等低频功能，尚未做完整偏好设置。
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

## 9. 下一版本开发路线

## V1.1 AI 批量文本记账

- 将现有“一句话 AI 记账”升级为“一段文本解析多条候选账单”。
- 用户可以输入一天、几天或一周的账单文本。
- AI 只能解析用户本次输入文本，不能读取历史账单或统计数据。
- AI 返回 transactions 数组。
- 服务端必须逐条 JSON parse、sanitize、validate。
- 前端显示批量确认列表。
- 每条候选交易可以编辑、删除、取消选择。
- 用户确认后才批量写入 Supabase。
- 暂不读取历史账单，暂不做自动去重，暂不修改数据库 schema。

### V1.1 第一阶段：AI 批量解析文本账单

已完成：

- `app/api/parse-transaction` 现在稳定返回批量结构 `{ transactions, truncated, max_transactions, max_input_chars }`，即使只有一笔账单也返回数组。
- 单次输入长度限制统一为 `MAX_PARSE_INPUT_CHARS = 3000`，候选数量限制统一为 `MAX_PARSED_TRANSACTIONS = 50`。
- AI prompt、服务端校验和前端提示共用同一组限制常量。
- 服务端会对 AI 返回的 `transactions` 执行 `slice(0, MAX_PARSED_TRANSACTIONS)`，超量时返回 `truncated = true`。
- 每条候选优先保存 AI 返回且能在完整输入中找到的 `raw_text` 原文片段；无法可靠切分时 fallback 为完整输入。
- 日期由服务端从原文片段二次处理：完整年月日优先，`今天` / `昨天` / `前天` 按服务端日期推算，中文月日使用服务端当前年份，缺失日期使用服务端今天。
- 前端新增批量确认列表，每条候选可编辑、删除、取消选择；删除和取消选择是独立行为。
- 批量保存使用一次 Supabase `insert` 写入多条记录，仍然只使用当前登录用户和 RLS，不使用 `service_role key`。
- 批量保存成功后清空 AI 输入和候选列表，避免重复保存。

本阶段未做：

- 不做历史账单读取。
- 不做自动去重。
- 不修改数据库 schema 或 RLS policy。
- 不做首页整体 UI/UX 重排。

### V1.1 第二阶段：首页与导航体验优化

已完成：

- 底部导航改为真正的子界面切换：`首页` / `账单` / `统计` / `设置`。
- 首页只保留本月概览、手动记账、AI 批量记账和最近 5 笔账单。
- 账单子界面显示全部账单，并按年份、月份和日期分组。
- 账单编辑、删除能力继续复用原有组件，查询仍然约束当前用户并依赖 Supabase RLS。
- 统计子界面保持原有本月统计，不新增统计维度，不调用 AI。
- 设置子界面先放入 CSV 导入，暂不做分类、账户、支付方式管理。
- 不明确的 AI 候选可以在确认页补全金额、类型、分类和日期后保存。
- 批量 AI 保存继续使用一次 Supabase `insert` 多条记录，不使用 `service_role key`。

本阶段未做：

- 不做搜索和通知功能。
- 不做完整设置页。
- 不做自动化测试补充。
- 不修改数据库 schema 或 RLS policy。
