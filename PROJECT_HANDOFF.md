# PROJECT_HANDOFF.md

本文件用于把 FoxLedger 当前 v1 阶段状态交接给下一轮 ChatGPT / Codex 对话。新对话开始前，请先阅读 `AGENTS.md`、`README.md` 和本文件。

## 1. 一句话总结

FoxLedger / 狐狐记账是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA 雏形，已经完成从登录、手动/AI/CSV 记账、账单查询管理到日期范围统计的 v1 核心闭环。

## 2. 当前线上地址

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

部署平台：Vercel。

## 3. 当前技术栈

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- OpenAI-compatible Chat Completions API
- Vercel
- lucide-react
- ESLint

## 4. 当前目录和关键文件

```text
app/
  api/parse-transaction/route.ts    AI 解析 API
  manifest.ts                       PWA manifest
  layout.tsx                        app metadata
  page.tsx                          AuthGate + Dashboard 入口
  icons/*/route.tsx                 PWA 图标路由

components/
  AuthGate.tsx                      登录态守卫
  AuthForm.tsx                      登录/注册表单
  Dashboard.tsx                     主界面和底部导航视图切换
  BottomNav.tsx                     首页/账单/统计/设置导航
  ManualTransactionForm.tsx         手动记账
  ChatInput.tsx                     AI 文本输入
  ConfirmTransactionBatch.tsx       AI 批量候选确认
  TransactionList.tsx               首页最近账单
  TransactionManager.tsx            账单搜索、筛选、排序、加载更多、多选删除
  TransactionCard.tsx               账单卡片
  EditTransactionForm.tsx           编辑账单
  ImportTransactions.tsx            CSV 导入
  StatsPanel.tsx                    日期范围统计页
  MonthlySummary.tsx                首页本月概览

lib/
  supabase.ts                       Supabase browser client
  transactions.ts                   账单读取、筛选、编辑、删除
  ai.ts                             OpenAI-compatible 请求和 prompt
  aiTransactions.ts                 AI 确认后批量入库
  validators.ts                     AI API 输入和返回清洗
  transactionRules.ts               CNY、默认分类、类型、日期等共享规则
  transactionDrafts.ts              AI 确认草稿和保存校验
  parseTransactionLimits.ts         AI 输入长度和候选数量限制
  csvImport.ts                      CSV 解析和校验
  stats.ts                          统计查询和计算
  allowedEmails.ts                  AI 邮箱白名单
  format.ts                         金额格式化
  date.ts                           本地日期 input helper
  pwaIcon.tsx                       PWA 图标生成

supabase/migrations/
  001_create_transactions.sql
  002_grant_transactions_permissions.sql

types/
  transaction.ts                    交易、AI 解析、统计类型定义
```

## 5. 当前完成阶段列表

### 初始化项目

- Next.js + TypeScript 项目结构。
- ESLint 配置。
- 基础全局样式。
- `npm run dev`、`npm run lint`、`npm run build` 脚本。

### Supabase 连接

- `lib/supabase.ts` 使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 初始化客户端。
- 不使用 `service_role` key。

### Auth

- Supabase Auth 邮箱密码登录。
- `AuthGate` 检查 session，未登录显示 `AuthForm`。
- 登录后显示当前用户邮箱和退出按钮。

### transactions 表和 RLS

- `001_create_transactions.sql` 创建 `public.transactions`。
- 表字段覆盖类型、金额、货币、分类、商户、支付方式、账户、日期、备注、原文、来源、AI 置信度等。
- 约束：
  - `type in ('expense', 'income', 'transfer')`
  - `amount > 0`
  - `source in ('manual', 'ai')`
  - `ai_confidence` 为空或 0 到 1。
- RLS policy 覆盖 select、insert、update、delete。
- `002_grant_transactions_permissions.sql` 授权 authenticated 角色访问表。

### 手动记账

- 首页提供手动记账表单。
- 保存前检查类型、金额、日期、分类。
- 固定写入 `CNY`。
- 分类使用默认分类。
- 保存后刷新首页概览、最近账单、账单页和统计页。

### 最近账单

- 首页显示最近 5 笔真实账单。
- 支持编辑和单条删除。
- 首页本月概览只调用 `getMonthlyStats()`，不受统计页范围切换污染。

### 编辑和删除

- `EditTransactionForm` 支持修改类型、金额、分类、日期、商户、支付方式、备注。
- 更新和删除均显式约束当前用户。
- 单条删除使用二次点击确认。
- 账单页支持管理模式下多选当前已加载账单并批量删除。
- 按日期范围删除、删除全部账单未实现；用户已决定 v1.3 保持当前删除能力。

### AI 解析和确认入库

- API：`app/api/parse-transaction/route.ts`。
- 前端请求携带 Supabase access token。
- 服务端验证 token，并检查 `ALLOWED_EMAILS`。
- AI 只接收当前输入文本和服务端今天日期，不读取历史账单。
- AI 返回必须是 JSON。
- API 稳定返回批量结构：

```text
{
  transactions: ParsedTransaction[],
  truncated: boolean,
  max_transactions: number,
  max_input_chars: number
}
```

- 输入长度限制：`MAX_PARSE_INPUT_CHARS = 3000`。
- 候选数量限制：`MAX_PARSED_TRANSACTIONS = 50`。
- 服务端不只依赖 AI 遵守数量限制，会 slice 到最大候选数量。
- AI prompt 要求分类只能来自默认分类。
- 服务端仍兜底校验分类，非默认分类归一为 `其他`。
- 如果没有可靠金额，候选标记 `needs_clarification: true`，不能直接保存。
- 用户可在确认页补全金额、日期、分类等字段后保存。
- 批量保存使用一次 insert 多条。
- AI 不直接写数据库。

### CSV 导入

- 文件：`components/ImportTransactions.tsx`、`lib/csvImport.ts`。
- 前端解析 CSV，预览后确认导入。
- 必须登录才能导入。
- 只追加新增，不覆盖、不合并、不自动去重。
- 必需表头：`date`、`amount`、`type`。
- 合法行可以单独导入，错误行不入库。
- 当前固定写入 `CNY`。
- 非默认分类归一为 `其他`。

### 统计页

- 文件：`lib/stats.ts`、`components/StatsPanel.tsx`。
- 支持：
  - 本周
  - 本月
  - 上月
  - 今年
  - 自定义日期范围
- 展示：
  - 总支出
  - 总收入
  - 结余
  - 交易笔数
  - 日均支出
  - 最大单笔支出
  - 分类支出排行
  - 每日支出趋势
- 规则：
  - `expense` 计入支出。
  - `income` 计入收入。
  - `transfer` 暂不计入收入、支出、结余。
  - `balance = income - expense`。
  - `amount` 按正数处理。
- 统计由代码和数据库查询计算，不调用 AI。
- 统计查询按页读取，避免单次 Supabase 返回上限导致汇总不完整。

### 账单搜索、筛选和排序

- 文件：`components/TransactionManager.tsx`、`lib/transactions.ts`。
- 支持搜索商户、备注、分类。
- 支持类型筛选：全部、支出、收入、转账。
- 支持默认分类筛选。
- 支持开始日期、结束日期筛选，范围包含开始和结束当天。
- 支持日期倒序、日期正序、金额倒序、金额正序。
- 支持一键清空筛选。
- 支持加载更多。
- 显示筛选后的总支出、总收入和笔数。
- 汇总查询按页读取，避免数据量大时被单次返回上限截断。

### PWA metadata / manifest

- `app/manifest.ts` 提供基础 manifest。
- `app/icons/*/route.tsx` 动态生成图标。
- `app/layout.tsx` 提供 metadata。
- 当前没有 service worker、离线记账、离线同步或推送。

### Vercel 部署

- 已部署到 Vercel。
- Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)
- 环境变量在 Vercel Project Settings 配置。
- Supabase Auth URL Configuration 需要包含生产地址和 preview redirect URLs。

## 6. 当前数据模型摘要

表：`public.transactions`

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
type text not null
amount numeric(12, 2) not null
currency text not null default 'CNY'
category text not null default '其他'
tag text
merchant text
payment_method text
account text
date date not null default current_date
note text
raw_text text
source text not null default 'manual'
ai_confidence numeric(4, 3)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

索引：

- `(user_id, date desc)`
- `(user_id, category)`
- `(user_id, created_at desc)`

trigger：

- `set_transactions_updated_at` 在 update 前更新 `updated_at`。

## 7. 当前环境变量摘要

不要在文档或代码中写真实值。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Supabase publishable key。
- `AI_PROVIDER`：当前只支持 `openai`。
- `OPENAI_API_KEY`：OpenAI-compatible provider API key。
- `OPENAI_BASE_URL`：OpenAI-compatible API base URL。
- `OPENAI_MODEL`：账单解析模型。
- `ALLOWED_EMAILS`：允许调用 AI 解析 API 的邮箱白名单，逗号分隔。

## 8. 当前安全边界

必须继续保持：

- 不提交 `.env.local`。
- 不提交任何密钥。
- 不使用 Supabase `service_role` key。
- 不绕过 RLS。
- 不新增管理员删除接口。
- 不允许前端传入任意 `user_id` 决定操作对象。
- 查询、更新、删除必须限制当前登录用户。
- AI 只解析当前输入文本。
- AI 不读取历史账单。
- AI 不直接写数据库。
- AI 不做统计。
- 统计只由代码和数据库查询计算。
- 不缓存 Supabase 用户数据到 service worker。

## 9. 当前已知问题和限制

- 当前是个人使用的 Web/PWA 雏形，不是完整商业产品。
- 没有自定义分类、账户、支付方式管理。
- 默认分类是固定集合，非默认分类归一为 `其他`。
- 固定货币 `CNY`，没有多币种和汇率。
- CSV 导入只做追加新增，不做覆盖、合并或自动去重。
- 账单删除当前支持单条删除和当前已加载账单的多选删除；不支持按日期范围删除或删除全部账单。
- 没有预算、AI 分析、自动建议或预测。
- 没有 service worker、离线记账、离线同步、push notification。
- 没有 Capacitor App 封装。
- 首页仍显示最近账单模块；下一阶段用户倾向删除该模块，以减少首页长度和重复信息。
- 手动记账表单字段较多，移动端滑动距离偏长；下一阶段可考虑分步或折叠可选字段。
- 统计页的分类排行和趋势目前是静态条形展示，没有点击查看对应账单或切换图表类型。
- 当前没有单元测试或 E2E 测试脚本。
- 文档提交前如果工作区存在用户或上一阶段留下的未提交业务代码，不能擅自回滚；先确认用户是否要提交。

## 10. 下一版本推荐开发路线

建议下一轮先做规划，不要直接开始实现。

### 方向 A：V2 移动端 / PWA 体验

- PWA 安装引导。
- 移动端导航和页面密度优化。
- 首页瘦身：删除首页最近账单模块，保留本月概览、手动记账和 AI 快速记账入口；完整账单浏览继续放到账单页。
- 手动记账表单移动端优化：将字段拆成分步流程，或默认折叠商家、支付方式、备注等可选字段，减少一次性纵向滚动。
- 本地草稿。
- 是否引入 service worker 的安全方案评估。
- 如需离线记账，必须明确哪些数据可以本地保存、如何加密或清理、如何避免缓存 Supabase 用户数据。

### 方向 B：统计页 drilldown 与交互增强

- 当前 `StatsPanel` 的分类排行和每日趋势只是静态条形展示。
- 下一阶段目标：统计页点击某个统计项后，自动切到账单页并应用对应筛选，让用户查看组成该统计项的账单。
- 推荐数据流：

```text
StatsPanel 点击统计项
↓
Dashboard 保存 drilldown 条件
↓
切换 activeView = "transactions"
↓
TransactionManager 覆盖并应用筛选
```

- 建议筛选映射：
  - 点击分类排行：带入当前统计范围的 `startDate`、`endDate`、对应 `category`，并筛选 `expense`。
  - 点击每日趋势：带入对应单日作为 `startDate` 和 `endDate`，并筛选 `expense`。
  - 点击总支出/总收入/交易笔数等概览指标时，可以按当前统计日期范围和对应类型跳到账单页。
- 代码设计建议：
  - 在 `Dashboard` 中新增一个轻量 drilldown state。
  - `StatsPanel` 通过回调向 `Dashboard` 传出筛选条件，不直接操作账单页内部状态。
  - `TransactionManager` 接收可选初始/覆盖筛选条件，并在条件变化时清空选择状态、应用筛选。
  - 继续复用当前账单页筛选模型，避免新建第二套查询逻辑。
- 安全和边界：
  - 统计仍必须由代码和数据库查询计算，不调用 AI。
  - 只读取当前用户自己的 `transactions`。
  - 不新增数据库表，不修改 schema，除非用户另行确认。
  - 不实现预算、预测、AI 建议或自动分析。

### 方向 C：自定义配置

- 自定义分类。
- 自定义账户。
- 自定义支付方式。
- 常用商户和默认分类映射。
- 默认货币设置。
- 这条路线大概率需要新增表或修改 schema，必须先设计 migration、RLS policy 和回滚方案。

### 方向 D：账单管理增强

- 按日期范围删除。
- 删除全部账单。
- 更强的确认弹窗。
- 导出 CSV。
- 重复账单检测。

### 方向 E：质量保障

- 给 `lib/csvImport.ts` 增加单元测试。
- 给 `lib/validators.ts` 的 AI sanitizer 增加单元测试。
- 给 `lib/stats.ts` 增加统计规则测试。
- 给登录、记账、AI 确认、CSV 导入、账单筛选增加最小 E2E 测试。

### 方向 F：AI 解析增强

- 改进中文日期、金额、收入/支出方向识别。
- 更好的不明确候选提示。
- 保持 AI 不读历史账单、不写数据库、不做统计。

## 11. 新对话启动 Prompt

下面这段可以直接复制给下一轮 ChatGPT / Codex：

```text
请先阅读当前仓库中的 AGENTS.md、README.md 和 PROJECT_HANDOFF.md。

这是 FoxLedger / 狐狐记账，一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA 雏形。v1 已完成 Auth、transactions 表/RLS、手动记账、最近账单、编辑删除、AI 批量解析、AI 确认入库、CSV 导入、日期范围统计、账单搜索筛选排序、多选删除、基础 PWA metadata、Vercel 部署和 AI 邮箱白名单。

请严格遵守：
- 不提交 .env.local 或任何密钥。
- 不使用 Supabase service_role key。
- 不绕过 RLS。
- 不让 AI 直接写数据库。
- AI 只能解析当前输入文本，不能读取历史账单。
- 统计必须由代码/数据库计算，不调用 AI。
- 每次只做一个小阶段。
- 不主动实现超出本阶段的功能。
- 如果需要新增表或修改 schema，先给 migration、RLS 和回滚方案，等我确认后再实施。

接下来我要开启 v2 开发。优先考虑：删除首页最近账单模块、优化移动端手动记账表单、实现统计页点击 drilldown 到账单页筛选。请先根据当前代码和文档审计项目状态，并给出下一阶段计划，等我确认后再实施。
```

## 12. 开发前检查清单

每次开始前：

```bash
git status
```

提交前至少执行：

```bash
npm run lint
npm run build
```

必要时：

```bash
npm audit --audit-level=moderate
```

不要自动回滚用户未提交改动。若工作区存在与当前任务无关的未提交业务代码，只提交本次任务明确要求的文件。
