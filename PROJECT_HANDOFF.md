# PROJECT_HANDOFF.md

本文件用于把 FoxLedger v2.1 完成态交接给下一轮 ChatGPT / Codex 对话。新对话开始前，请先阅读 `AGENTS.md`、`README.md` 和本文件。

## 1. 一句话总结

FoxLedger / 狐狐记账是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA 雏形，当前 v2.1 已完成从登录、手动/AI/CSV 记账、账单管理、统计 drilldown，到本地缓存、离线只读查看和 Service Worker 外壳缓存的核心闭环。

## 2. 当前线上地址

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

部署平台：Vercel。

用户已反馈在 Vercel 侧配置了自有域名并可改善中国网络访问，但仓库文档不记录未提供的具体私有域名。后续若新增或变更域名，需要同步检查 Supabase Auth Site URL / Redirect URLs。

## 3. 当前技术栈

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- OpenAI-compatible Chat Completions API
- IndexedDB
- Service Worker
- Vercel
- lucide-react
- ESLint

## 4. 当前目录和关键文件

```text
app/
  api/parse-transaction/route.ts    AI 解析 API
  manifest.ts                       PWA manifest
  layout.tsx                        metadata + Service Worker 注册组件挂载
  page.tsx                          AuthGate + Dashboard 入口
  icons/*/route.tsx                 PWA 图标路由

components/
  AuthGate.tsx                      登录态守卫、当前用户上下文、退出时清理本地数据
  AuthForm.tsx                      登录/注册表单
  Dashboard.tsx                     主界面、底部导航视图切换、远端同步协调
  BottomNav.tsx                     首页/账单/统计/设置导航
  MonthlySummary.tsx                首页本月概览
  ManualTransactionForm.tsx         手动记账、可选信息折叠、本设备草稿
  ChatInput.tsx                     AI 文本输入
  ConfirmTransactionBatch.tsx       AI 批量候选确认与保存
  ImportTransactions.tsx            CSV 导入
  TransactionManager.tsx            账单搜索、筛选、排序、加载更多、多选删除
  TransactionCard.tsx               账单卡片
  EditTransactionForm.tsx           编辑账单
  StatsPanel.tsx                    日期范围统计页和 drilldown
  SyncStatusBanner.tsx              在线/离线和同步状态提示
  ServiceWorkerRegistration.tsx     生产环境注册 Service Worker
  TransactionList.tsx               旧最近账单列表组件，当前主界面未引用

lib/
  supabase.ts                       Supabase browser client
  transactions.ts                   Supabase 账单读取、远端全量拉取、编辑、删除
  transactionRules.ts               CNY、默认分类、类型、日期等共享规则
  transactionDrafts.ts              AI 确认草稿和保存校验
  ai.ts                             OpenAI-compatible 请求和 prompt
  aiTransactions.ts                 AI 确认后批量入库
  validators.ts                     AI API 输入和返回清洗
  parseTransactionLimits.ts         AI 输入长度和候选数量限制
  csvImport.ts                      CSV 解析和校验
  stats.ts                          统计范围和本地缓存统计入口
  statsCalculator.ts                基于账单数组的纯统计计算
  localDb.ts                        IndexedDB 基础封装
  localTransactions.ts              本地账单查询、筛选、排序和汇总
  transactionSync.ts                Supabase 全量拉取并替换本地缓存
  manualDraft.ts                    本设备手动记账草稿
  networkStatus.ts                  在线/离线状态订阅
  allowedEmails.ts                  AI 邮箱白名单
  format.ts                         金额格式化
  date.ts                           本地日期 input helper
  pwaIcon.tsx                       PWA 图标生成

public/
  sw.js                             Service Worker 外壳缓存
  offline.html                      离线提示页

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
- `npm run dev`、`npm run lint`、`npm run build`、`npm run start` 脚本。

### Supabase 连接

- `lib/supabase.ts` 使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 初始化客户端。
- 不使用 `service_role` key。

### Auth

- Supabase Auth 邮箱密码登录和注册。
- `AuthGate` 检查 session，未登录显示 `AuthForm`。
- 登录后通过 `AuthUserContext` 提供当前用户 `id` 和 `email`。
- 登录状态检查有超时提示。
- 在线退出成功后，清理当前用户本设备 IndexedDB 缓存和草稿。
- 离线时阻止退出并提示需要联网，避免无法确认云端会话状态。

### transactions 表和 RLS

- `001_create_transactions.sql` 创建 `public.transactions`。
- 字段覆盖类型、金额、货币、分类、商户、支付方式、账户、日期、备注、原文、来源、AI 置信度等。
- 约束：
  - `type in ('expense', 'income', 'transfer')`
  - `amount > 0`
  - `source in ('manual', 'ai')`
  - `ai_confidence` 为空或 0 到 1。
- RLS policy 覆盖 select、insert、update、delete。
- `002_grant_transactions_permissions.sql` 授权 authenticated 角色访问表。
- 查询、更新、删除代码里仍显式约束当前用户。

### 手动记账

- 首页不默认展示完整表单，而是展示加号样式的手动记账入口。
- 点击入口后在首页状态内展开 `ManualTransactionForm`。
- 必填字段：类型、金额、分类、日期。
- 可选字段：商家、支付方式、备注，放在可折叠区域。
- 保存前检查类型、金额、日期、分类。
- 固定写入 `CNY`。
- 分类使用 `lib/transactionRules.ts` 的默认分类。
- 在线保存成功后清空草稿，并触发远端同步刷新本地缓存。
- 离线提交不会写数据库，会提示“当前离线，账单未保存”，并保留为本设备草稿。

### 手动草稿

- `lib/localDb.ts` 的 `manual_drafts` store 保存手动表单草稿。
- `lib/manualDraft.ts` 封装读取、保存、清空和是否有内容判断。
- 草稿按当前 `user_id` 保存。
- 草稿仅保存在本设备，不是正式账单，不参与统计。
- 用户可在表单中清空草稿。

### AI 解析和确认入库

- API：`app/api/parse-transaction/route.ts`。
- 前端 `ChatInput` 请求必须携带 Supabase access token。
- 服务端使用 Supabase publishable key 验证 token，不使用 `service_role`。
- 服务端检查 `ALLOWED_EMAILS`。
- AI 只接收当前输入文本和服务端今天日期，不读取历史账单、本地缓存或统计数据。
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
- 服务端检测疑似银行卡号、身份证号等长敏感数字并拒绝解析。
- AI prompt 要求分类只能来自默认分类。
- 服务端仍兜底校验分类，非默认分类归一为 `其他`。
- 如果没有可靠金额，或金额不来自原文片段，候选标记 `needs_clarification: true`，不能直接保存。
- 用户可在确认页编辑候选、取消选择、删除候选、补全必要字段后保存。
- 批量保存使用一次 insert 多条。
- AI 不直接写数据库。
- 离线时不允许 AI 解析或保存 AI 候选。

### CSV 导入

- 文件：`components/ImportTransactions.tsx`、`lib/csvImport.ts`。
- 前端解析 CSV，预览后确认导入。
- 必须登录且在线才能导入。
- 只追加新增，不覆盖、不合并、不自动去重。
- 必需表头：`date`、`amount`、`type`。
- 支持可选表头：`category`、`note`、`currency`、`tag`、`merchant`、`payment_method`、`account`、`raw_text`、`source`。
- 合法行可以单独导入，错误行不入库。
- 当前固定写入 `CNY`。
- 非默认分类归一为 `其他`。

### 账单管理

- 当前主账单页由 `TransactionManager` 提供。
- 数据读取来自 IndexedDB 本地缓存：`listCachedTransactionsPage(userId, filters)`。
- 支持搜索商户、备注、分类。
- 支持类型筛选：全部、支出、收入、转账。
- 支持默认分类筛选。
- 支持开始日期、结束日期筛选，范围包含开始和结束当天。
- 支持日期倒序、日期正序、金额倒序、金额正序。
- 支持一键清空筛选。
- 支持加载更多，当前 page size 为 30。
- 显示筛选后的总支出、总收入和笔数。
- 支持按日期分组展示。
- 在线时刷新按钮会调用 `syncTransactionsFromRemote(userId)` 拉取远端并覆盖本地缓存。
- 离线时刷新按钮只重新读取本地缓存。
- 在线时支持编辑、单条删除和当前已加载账单的多选删除。
- 离线时账单页只读，隐藏或禁用写操作。

### 首页

- `Dashboard` 默认显示首页。
- 首页包含 `MonthlySummary`、手动记账入口/表单、`ChatInput`。
- 首页已删除最近账单模块。
- `components/TransactionList.tsx` 仍在仓库中，但当前 `Dashboard` 未引用，可作为后续清理候选。

### 统计页

- 文件：`lib/stats.ts`、`lib/statsCalculator.ts`、`components/StatsPanel.tsx`。
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
- 统计基于当前用户本地缓存账单计算。
- `expense` 计入支出。
- `income` 计入收入。
- `transfer` 暂不计入收入、支出、结余。
- `balance = income - expense`。
- `amount` 按正数处理。
- 统计不调用 AI。
- 统计概览卡片、分类排行、每日趋势支持点击 drilldown 到账单页。
- drilldown 会带入日期范围、类型、分类等筛选条件。
- 在线时统计页刷新按钮会触发远端同步。

### v2.1 本地缓存与同步

- IndexedDB DB 名称：`foxledger`。
- 当前 DB 版本：`2`。
- Store：
  - `transactions`
  - `sync_meta`
  - `manual_drafts`
- `transactions` store 使用 `cache_key = ${user_id}:${id}`。
- `transactions` store 索引：
  - `user_id`
  - `user_id_date`
  - `user_id_updated_at`
- `sync_meta` 以 `user_id` 为 keyPath。
- 同步策略是当前用户全量拉取并替换本地缓存。
- 全量同步原因：当前云端删除是真删除，没有 tombstone，仅用 `updated_at` 增量无法反映删除。
- `transactionSync.ts` 会检查远端拉取结果是否包含非当前用户账单，如果有会停止写入本地缓存。
- 云端保存、编辑、删除、CSV 导入、AI 保存成功后会触发同步刷新。

### v2.1 离线 UI

- `useNetworkStatus()` 监听浏览器 online/offline。
- `SyncStatusBanner` 显示在线、离线、同步失败和上次同步时间。
- 离线时只能查看上次同步数据。
- 离线时禁用正式写操作：
  - 手动保存。
  - AI 解析。
  - AI 候选保存。
  - CSV 导入。
  - 编辑账单。
  - 删除账单。
  - 批量删除。
- 手动记账按钮离线时提示“联网后可保存”。
- 草稿明确提示“仅保存在本设备，不是正式账单，不参与统计”。

### v2.1 Service Worker 外壳缓存

- `components/ServiceWorkerRegistration.tsx` 只在生产环境注册 `/sw.js`。
- `public/sw.js` 缓存：
  - `/`
  - `/offline.html`
  - `/manifest.webmanifest`
  - `/icons/icon-192`
  - `/icons/icon-512`
  - `/icons/apple-touch-icon`
  - `/_next/static/*`
- 导航请求使用 network-first，失败后 fallback 到缓存的 `/`，再 fallback 到 `/offline.html`。
- 静态资源使用 cache-first。
- 明确 network-only：
  - 非 GET 请求。
  - `/api/*`。
  - Supabase 域名请求。
- 不缓存 Supabase 登录响应、AI API 响应或任何用户数据响应。
- 当前没有离线正式记账、离线同步队列、push notification。

### PWA metadata / manifest

- `app/manifest.ts` 提供基础 manifest。
- `app/icons/*/route.tsx` 动态生成 192、512 和 apple touch icon。
- `app/layout.tsx` 提供 metadata、viewport、manifest 和 icon 配置。
- 图标由 `lib/pwaIcon.tsx` 使用 `ImageResponse` 动态生成。

### Vercel 部署

- 已部署到 Vercel。
- Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)
- Vercel 连接 GitHub `main` 分支。
- 环境变量在 Vercel Project Settings 配置。
- Supabase Auth URL Configuration 需要包含生产地址和 preview redirect URLs。
- 如果 Vercel Domains 绑定自有域名，也需要把该域名加入 Supabase Auth URL Configuration。

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

约束：

```text
type in ('expense', 'income', 'transfer')
amount > 0
source in ('manual', 'ai')
ai_confidence is null or between 0 and 1
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
- `OPENAI_API_KEY`：OpenAI-compatible provider API key，仅服务端使用。
- `OPENAI_BASE_URL`：OpenAI-compatible API base URL，可为空。
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
- IndexedDB 读取必须限制当前 `userId`。
- AI 只解析当前输入文本。
- AI 不读取历史账单。
- AI 不读取 IndexedDB 缓存。
- AI 不直接写数据库。
- AI 不做统计。
- 统计只由代码基于数据库查询结果或本地缓存数据计算。
- Service Worker 不缓存 Supabase 用户数据、登录响应或 API 响应。
- 手动草稿不是正式账单，不参与统计。
- 离线时不允许正式写操作。

## 9. 当前已知问题和限制

- 当前是个人使用的 Web App / PWA 雏形，不是完整商业产品。
- 没有自定义分类、账户、支付方式管理。
- 默认分类是固定集合，非默认分类归一为 `其他`。
- 固定货币 `CNY`，没有多币种和汇率。
- CSV 导入只做追加新增，不做覆盖、合并或自动去重。
- 账单删除支持单条删除和当前已加载账单的多选删除，不支持按日期范围删除或删除全部账单。
- 没有预算、AI 分析、自动建议或预测。
- 有本地缓存和离线只读查看，但没有离线正式记账、离线同步队列或冲突合并。
- 有基础 Service Worker 外壳缓存，但不缓存 Supabase/API 用户响应。
- 没有 push notification。
- 没有 Capacitor App 封装。
- `components/TransactionList.tsx` 是旧最近账单列表组件，当前主界面未引用，后续可清理。
- 当前没有单元测试或 E2E 测试脚本。
- 自有域名在 Vercel 平台侧管理，仓库中不记录具体私有域名。
- 文档提交前如果工作区存在用户或上一阶段留下的未提交业务代码，不能擅自回滚；先确认用户是否要提交。

## 10. 下一版本推荐开发路线

下一版本建议从 v2.2 开始。不要直接实现，除非用户明确确认阶段目标。

### v2.2 推荐方向 A：质量保障

目标：降低后续改动风险。

建议范围：

- 为 `lib/transactionRules.ts` 补日期、分类、类型校验测试。
- 为 `lib/validators.ts` 补 AI 输入和 sanitizer 测试。
- 为 `lib/csvImport.ts` 补 CSV parser 测试。
- 为 `lib/statsCalculator.ts` 补统计计算测试。
- 为 `lib/localTransactions.ts` 补本地筛选、排序、分页、汇总测试。
- 必要时补最小 E2E 或手动测试清单。

边界：

- 不改 schema。
- 不改业务交互。
- 不新增外部监控或付费平台。

### v2.2 推荐方向 B：PWA 安装与更新体验

目标：让 PWA 更像可安装应用。

建议范围：

- 安装引导。
- Service Worker 更新提示。
- 离线页和离线状态验证流程优化。
- 弱网/断网文案完善。

边界：

- 不缓存 Supabase/API 用户响应。
- 不做 push notification。
- 不做离线写入队列。

### v2.2 推荐方向 C：数据导出

目标：增强自用数据可控性。

建议范围：

- 导出当前用户账单为 CSV。
- 支持按当前筛选条件导出。
- 导出字段与 `public.transactions` 现有字段对应。

边界：

- 只读当前用户数据。
- 不绕过 RLS。
- 不做覆盖、恢复或导入合并。
- 不改数据库 schema。

### 更大版本候选

- 自定义分类、账户、支付方式、常用商户映射：需要先给 migration、RLS 和回滚方案。
- 离线正式记账：需要先设计本地队列、冲突策略、同步状态和失败恢复。
- 更强删除能力：按日期范围删除或删除全部账单需要更严谨确认流程。
- AI 解析增强：可以改善中文日期、金额、多笔拆分，但必须保持 AI 不读历史账单、不写数据库、不做统计。

## 11. 新对话启动 Prompt

可以在下一轮 ChatGPT / Codex 对话开头使用：

```text
请先阅读当前仓库中的 AGENTS.md、README.md 和 PROJECT_HANDOFF.md。

这是 FoxLedger / 狐狐记账，一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA 雏形。当前 v2.1 已完成 Auth、transactions 表/RLS、手动记账、AI 批量解析和确认入库、CSV 导入、账单搜索筛选排序、多选删除、统计页 drilldown、本地 IndexedDB 缓存、离线只读 UI、手动草稿、Service Worker 外壳缓存、Vercel 部署和 AI 邮箱白名单。

请严格遵守：
- 不提交 .env.local 或任何密钥。
- 不使用 Supabase service_role key。
- 不绕过 RLS。
- 不让 AI 直接写数据库。
- AI 只能解析当前输入文本，不能读取历史账单或 IndexedDB 缓存。
- 统计必须由代码基于数据库查询结果或本地缓存计算，不调用 AI。
- Service Worker 不缓存 Supabase/API 用户响应。
- 每次只做一个小阶段。
- 不主动实现超出本阶段的功能。
- 如果需要新增表或修改 schema，先给 migration、RLS 和回滚方案，等我确认后再实施。

接下来我要开启 v2.2 开发。请先根据当前代码和文档审计项目状态，并给出下一阶段计划，等我确认后再实施。
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
