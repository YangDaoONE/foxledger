# AGENTS.md

本文件面向后续 Codex / AI 开发助手。请先阅读本文件，再修改 FoxLedger 项目。

## 1. 项目角色

FoxLedger / 狐狐记账是一个基于 Next.js + Supabase 的个人 AI 记账应用。

当前项目已经完成第一版 Web/PWA 核心闭环：

- Supabase Auth 邮箱密码登录。
- `public.transactions` 表和 RLS。
- 手动记账。
- 真实账单列表。
- 编辑和删除账单。
- AI 一句话解析账单。
- AI 确认后入库。
- 宽松版 CSV 导入。
- 本月统计。
- 基础 PWA metadata。
- Vercel 部署。
- AI API 邮箱白名单。

最高优先级：

1. 数据安全。
2. Supabase RLS 和用户隔离。
3. 记账准确性。
4. 代码简单可维护。
5. 手机端可用性。

## 2. 开发原则

- 每次只做一个小阶段。
- 不要主动实现用户没有要求的功能。
- 不要大规模重构项目结构。
- 不要修改与当前任务无关的文件。
- 不要删除已有功能。
- 不要提交 `.env.local`。
- 不要提交任何 API key、Supabase key、数据库密码或其他密钥。
- 不要引入 Supabase `service_role key`。
- 不要绕过 Supabase RLS。
- 不要让 AI 直接写数据库。
- AI 只能解析当前输入文本，不能读取历史账单。
- 统计必须由代码和数据库查询计算，不能调用 AI。
- 修改完成后需要用中文说明改了什么、改了哪些文件、如何运行、如何测试、是否需要环境变量。
- 每次完成明确修改后，尽量 commit 并 push 到 GitHub。

代码命名规则：

- 解释和总结使用中文。
- 代码变量名、数据库字段、文件名和技术名词使用英文。

## 3. 数据规则

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

规则：

- `user_id` 是当前 Supabase Auth 用户 id。
- `type` 只能是 `expense` / `income` / `transfer`。
- `amount` 入库必须大于 0。
- 支出和收入方向由 `type` 表示，不用负数入库。
- `currency` 第一版固定为 `CNY`。
- `category` 默认 `其他`。
- `source` 只能是 `manual` / `ai`。
- `ai_confidence` 可以为空，不为空时必须在 0 到 1 之间。
- 不要新增表或改 schema，除非用户明确要求。

默认分类：

```text
餐饮
交通
购物
住房
学习
医疗
娱乐
日用
旅行
订阅
人情
收入
转账
其他
```

## 4. Supabase / Auth / RLS 规则

必须保持：

- Supabase RLS 已开启。
- 用户只能操作自己的 `transactions`。
- 查询、更新、删除应同时约束当前用户。
- 前端只使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 不要使用 `service_role key`。
- 不要把 Supabase 密钥写入前端代码。

现有 migration：

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

如果出现 `permission denied for table transactions`，优先检查 `002_grant_transactions_permissions.sql` 是否已经在 Supabase SQL Editor 执行。

## 5. AI 解析规则

AI API：

```text
app/api/parse-transaction/route.ts
```

当前链路：

```text
frontend ChatInput
-> /api/parse-transaction
-> validate Supabase access token
-> assert ALLOWED_EMAILS
-> OpenAI-compatible API
-> server-side JSON parse and sanitize
-> ConfirmTransaction card
-> user confirms
-> insert transaction
```

必须保持：

- `/api/parse-transaction` 必须要求登录。
- 前端请求必须携带 `Authorization: Bearer <supabase_access_token>`。
- 服务端只验证 token，不读取历史账单。
- 服务端必须检查 `ALLOWED_EMAILS`。
- 未登录返回 `401`。
- 已登录但邮箱不在白名单返回 `403`。
- 输入错误返回 `400`。
- AI 或服务端错误返回 `500`。
- AI 返回结果必须先 `JSON.parse`。
- AI 返回结果必须服务端二次校验和清洗。
- `raw_text` 必须等于用户原始输入。
- 日期必须是 `YYYY-MM-DD`。
- 日期不确定时使用服务端今天日期。
- 如果没有可靠金额，返回 `needs_clarification: true`，不能保存。
- AI 不允许直接写数据库。
- AI 不允许计算统计。

安全注意：

- 不要发送历史账单、统计数据、银行卡号、身份证号、完整地址等敏感信息给 AI。
- `OPENAI_API_KEY`、CPA API Key 等只允许在服务端环境变量中。

## 6. CSV 导入规则

当前 CSV 导入是前端解析、预览、确认后写入 Supabase。

文件：

```text
components/ImportTransactions.tsx
lib/csvImport.ts
```

规则：

- 必须已登录才能导入。
- 导入数据只能写入当前用户。
- 第一版只做追加新增，不做覆盖、合并、自动去重。
- 第一版只强制要求 `date`、`amount`、`type` 三个表头。
- 列顺序不限，多余列忽略。
- 错误行不入库，合法行可以单独导入。
- `amount` 必须大于 0。
- `date` 必须是 `YYYY-MM-DD`。
- `type` 只能是 `expense` / `income` / `transfer`。
- `currency` 为空默认 `CNY`。
- `category` 为空默认 `其他`。
- `source` 为空或非法默认 `manual`。
- 不接 AI，不改数据库结构，不使用 `service_role key`。

## 7. 统计规则

文件：

```text
lib/stats.ts
components/StatsPanel.tsx
```

当前统计：

- 本月总支出。
- 本月总收入。
- 本月结余。
- 分类支出排行。
- 每日支出趋势。

规则：

- 只读取当前用户自己的 `transactions`。
- `expense` 计入支出。
- `income` 计入收入。
- `balance = income - expense`。
- `transfer` 暂不计入收入、支出、结余。
- 统计不调用 AI。

## 8. UI/UX 规则

当前 UI 是移动端优先的单页布局。

请保持：

- 表单简单、清晰、可用。
- 按钮有明确禁用态和加载态。
- 错误信息要能指导用户下一步。
- 移动端宽度和文本不要溢出。
- 不引入大型 UI 框架，除非用户明确要求。
- 当前已使用 `lucide-react` 图标，新增图标优先继续用它。
- 不要把卡片嵌套成复杂层级。
- 新功能尽量复用现有样式类，例如 `section-block`、`manual-field`、`primary-button`、`form-message`。

## 9. PWA 规则

当前 PWA 只做基础 metadata：

```text
app/manifest.ts
app/icons/icon-192/route.tsx
app/icons/icon-512/route.tsx
app/icons/apple-touch-icon/route.tsx
lib/pwaIcon.tsx
```

当前没有：

- service worker。
- 离线记账。
- 离线同步。
- push notification。

不要在没有明确需求时加入离线缓存，尤其不要缓存 Supabase 用户数据。

## 10. 部署规则

生产地址：

[https://foxledger.vercel.app](https://foxledger.vercel.app/)

部署平台：

```text
Vercel
```

规则：

- Vercel 连接 GitHub `main` 分支。
- 环境变量在 Vercel Project Settings 配置。
- 修改环境变量后需要 redeploy。
- 排查环境变量问题时，redeploy 建议不要勾选 `Use existing Build Cache`。
- 不要把 `.env.local` 提交到 GitHub。
- Supabase Auth URL Configuration 要包含生产地址和 preview redirect URLs。

Vercel 环境变量名：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

不要在文档或代码中写真实值。

## 11. 提交前检查

修改前：

```bash
git status
```

提交前至少执行：

```bash
npm run lint
npm run build
```

必要时执行：

```bash
npm audit --audit-level=moderate
```

提交：

```bash
git add <changed-files>
git commit -m "<clear message>"
git push
```

如果只是文档修改但 lint/build 失败，需要如实说明失败原因，不要隐瞒。

## 12. 下一版本开发建议

不要直接开始实现，除非用户明确要求。

适合下一版本优先做：

1. UI/UX 优化，减少首页拥挤感。
2. 关闭公开注册或增加整站账号白名单。
3. 统计页增强：跨月、年度、自定义日期范围。
4. 预算功能。
5. 分类、账户、支付方式管理。
6. 数据导出。
7. CSV 导入增强：中文表头、模板下载、重复检查。
8. PWA 安装体验优化。
9. 错误提示和空状态优化。
10. 测试覆盖：validators、CSV parser、transactions 操作。
11. Capacitor 封装 App。

