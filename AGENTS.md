# AGENTS.md

本文件面向后续 Codex / AI 开发助手。开始修改 FoxLedger 前，必须先阅读本文件、README.md 和 PROJECT_HANDOFF.md。

## 1. 项目角色

FoxLedger / 狐狐记账是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA 雏形。

当前 v1 阶段已经完成：

- Supabase Auth 邮箱密码登录。
- `public.transactions` 表、约束、索引和 RLS。
- 手动记账。
- 首页本月概览、快速记账入口和最近账单。
- 真实账单列表。
- 账单编辑和单条删除。
- 账单搜索、筛选、排序、加载更多和当前已加载账单的多选删除。
- AI 单条/批量文本账单解析。
- AI 候选确认后入库。
- CSV 导入。
- 日期范围统计页。
- 基础 PWA metadata、manifest 和图标。
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
- 不要引入 Supabase `service_role` key。
- 不要绕过 Supabase RLS。
- 不要让 AI 直接写数据库。
- AI 只能解析当前输入文本，不能读取历史账单。
- 统计必须由代码和数据库查询计算，不能调用 AI。
- 不要把未实现功能写成已完成。
- 修改完成后用中文说明改了什么、改了哪些文件、如何运行、如何测试、是否需要环境变量。
- 明确修改完成后，按用户要求提交和推送。

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
- `type` 只能是 `expense`、`income`、`transfer`。
- `amount` 入库必须大于 0。
- 支出和收入方向由 `type` 表示，不用负数入库。
- 当前固定货币为 `CNY`。
- `category` 限制为默认分类，非默认分类归一为 `其他`。
- `source` 只能是 `manual` 或 `ai`。
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

共享交易规则优先使用：

```text
lib/transactionRules.ts
```

不要在新组件里重新复制默认分类、交易类型、CNY 常量或基础校验函数。

## 4. Supabase / Auth / RLS 规则

必须保持：

- Supabase RLS 已开启。
- 用户只能操作自己的 `transactions`。
- 查询、更新、删除除了依赖 RLS，也应显式约束当前用户。
- 前端只使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 不要使用 `service_role` key。
- 不要把 Supabase 密钥写入前端代码。

当前 migration：

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
-> ConfirmTransactionBatch
-> user confirms candidates
-> batch insert transactions
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
- API 返回格式保持批量格式，不要一会儿返回单条、一会儿返回数组。
- AI 返回每条候选的 `raw_text` 应是对应原文片段；无法切分才 fallback 为完整输入。
- 日期必须是 `YYYY-MM-DD`。
- 文本里有日期，用文本日期。
- 只有“今天/昨天/前天”，用服务端日期推算。
- 完全没有日期，才用服务端今天。
- 不要让 AI 猜跨年日期。
- 如果没有可靠金额，返回 `needs_clarification: true`，不能保存。
- AI 只能把分类归到默认分类；服务端仍要兜底归一非默认分类为 `其他`。
- AI 不允许直接写数据库。
- AI 不允许计算统计。

当前限制常量：

```text
lib/parseTransactionLimits.ts
```

- `MAX_PARSE_INPUT_CHARS = 3000`
- `MAX_PARSED_TRANSACTIONS = 50`

安全注意：

- 不要发送历史账单、统计数据、银行卡号、身份证号、完整地址等敏感信息给 AI。
- `OPENAI_API_KEY` 等只允许在服务端环境变量中。

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
- 只做追加新增，不做覆盖、合并、自动去重。
- 只强制要求 `date`、`amount`、`type` 三个表头。
- 列顺序不限，多余列忽略。
- 错误行不入库，合法行可以单独导入。
- `amount` 必须大于 0。
- `date` 必须是 `YYYY-MM-DD`。
- `type` 只能是 `expense`、`income`、`transfer`。
- 当前固定写入 `CNY`，不支持多币种。
- 非默认分类归一为 `其他`。
- `source` 为空或非法默认 `manual`。
- 不接 AI，不改数据库结构，不使用 `service_role` key。

## 7. 统计规则

文件：

```text
lib/stats.ts
components/StatsPanel.tsx
```

当前支持范围：

- 本周。
- 本月。
- 上月。
- 今年。
- 自定义开始日期和结束日期。

展示指标：

- 总支出。
- 总收入。
- 结余。
- 交易笔数。
- 日均支出。
- 最大单笔支出。
- 分类支出排行。
- 每日支出趋势。

规则：

- 只读取当前用户自己的 `transactions`。
- `expense` 计入支出。
- `income` 计入收入。
- `balance = income - expense`。
- `transfer` 暂不计入收入、支出、结余。
- `amount` 按正数处理。
- 统计不调用 AI。

## 8. UI/UX 规则

当前 UI 是移动端优先的单页应用，底部导航切换子界面：

- 首页。
- 账单。
- 统计。
- 设置。

请保持：

- 表单简单、清晰、可用。
- 按钮有明确禁用态和加载态。
- 错误信息要能指导用户下一步。
- 移动端宽度和文本不要溢出。
- 不引入大型 UI 框架，除非用户明确要求。
- 当前已使用 `lucide-react` 图标，新增图标优先继续用它。
- 不要把卡片嵌套成复杂层级。
- 新功能尽量复用现有样式类，例如 `section-block`、`manual-field`、`primary-button`、`secondary-button`、`form-message`。

## 9. PWA 规则

当前 PWA 只做基础 metadata、manifest 和图标路由：

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

适合优先讨论的方向：

1. V2 移动端和 PWA 体验增强。
   - 安装引导。
   - 更细的移动端布局和交互打磨。
   - 手动记账表单字段较多，移动端滑动距离长；优先考虑分步表单，或折叠商家、支付方式、备注等可选字段。
   - 首页当前仍有最近账单模块；下一阶段可考虑删除，保留本月概览、手动/AI 快速记账入口，把完整账单浏览集中到账单页。
   - 本地草稿。
   - 离线能力方案评估。注意不要默认缓存 Supabase 用户数据。

2. 统计页 drilldown 与交互增强。
   - 当前分类排行和每日趋势是静态条形展示；下一阶段可让统计项点击后跳转到账单页并自动应用筛选。
   - 推荐交互流：`StatsPanel` 点击统计项 -> `Dashboard` 保存 drilldown 条件 -> 切换 `activeView = "transactions"` -> `TransactionManager` 覆盖并应用筛选。
   - 分类排行点击可带入当前统计日期范围、分类和支出类型筛选。
   - 每日趋势点击可带入对应日期范围和支出类型筛选。
   - 统计仍必须由代码和数据库查询计算，不调用 AI。
   - 不要为此新增数据库表，除非用户另行确认。

3. 自定义配置能力。
   - 自定义分类。
   - 自定义账户。
   - 自定义支付方式。
   - 常用商户到分类的映射。
   - 如需新增表，必须先提出 migration、RLS 和回滚方案。

4. 账单管理增强。
   - 更强的删除确认体验。
   - 按日期范围删除或删除全部账单。
   - 导出数据。
   - 重复账单检测。

5. 质量保障。
   - 为 CSV parser、AI sanitizer、stats 计算补单元测试。
   - 为核心账单流程补最小 E2E 测试。

6. AI 解析增强。
   - 更稳的中文日期和金额解析。
   - 更好的不明确候选提示。
   - 继续保持 AI 不读历史账单、不写数据库、不做统计。
