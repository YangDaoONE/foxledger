# PROJECT_HANDOFF.md

本文件用于把 FoxLedger Web/PWA 当前状态交接给下一轮 ChatGPT / Codex 对话。新对话开始前，请先阅读 `AGENTS.md`、`README.md` 和本文件。

本文件只描述 `D:\fox\foxledger` Web/PWA 仓库。不要在这里记录 App 仓库的版本进度或安装包计划。

## 1. 一句话总结

FoxLedger / 狐狐记账是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA。当前 Web/PWA v2.1b 已完成登录、手动/AI/CSV 记账、账单管理、统计 drilldown、IndexedDB 本地缓存、离线只读查看、Service Worker 外壳缓存，以及移动端 UI/UX 收口。当前主入口是自有域名 `https://ledger.foxyang.com/`。

## 2. 当前线上地址

Production URL：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

部署平台：Vercel。

Vercel preview / 默认域名可以存在，但文档中的生产主入口以 `ledger.foxyang.com` 为准。变更域名时，需要同步检查 Supabase Auth Site URL / Redirect URLs。

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

## 5. 当前功能状态

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

- 首页不默认展示完整表单，而是展示手动记账入口。
- 点击入口后在首页状态内展开 `ManualTransactionForm`。
- 必填字段：类型、金额、分类、日期。
- 可选字段：商家、支付方式、备注，放在可折叠区域。
- 保存前检查类型、金额、日期、分类。
- 固定写入 `CNY`。
- 分类使用 `lib/transactionRules.ts` 的默认分类。
- 在线保存成功后清空草稿，并触发远端同步刷新本地缓存。
- 离线提交不会写数据库，会提示未保存，并保留为本设备草稿。

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
- 服务端检测疑似银行卡号、身份证号等长敏感数字并拒绝解析。
- 服务端校验分类、日期、金额来源和 `raw_text`。
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
- 合法行可以单独导入，错误行不入库。
- 当前固定写入 `CNY`。
- 非默认分类归一为 `其他`。

### 账单管理

- 当前主账单页由 `TransactionManager` 提供。
- 数据读取来自 IndexedDB 本地缓存：`listCachedTransactionsPage(userId, filters)`。
- 支持搜索商户、备注、分类。
- 支持类型、分类、开始日期、结束日期筛选。
- 支持日期倒序、日期正序、金额倒序、金额正序。
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
- 支持本周、本月、上月、今年、自定义日期范围。
- 展示总支出、总收入、结余、交易笔数、日均支出、最大单笔支出、分类支出排行和每日支出趋势。
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

### IndexedDB 本地缓存与同步

- IndexedDB DB 名称：`foxledger`。
- 当前 DB 版本：`2`。
- Store：
  - `transactions`
  - `sync_meta`
  - `manual_drafts`
- `transactions` store 使用 `cache_key = ${user_id}:${id}`。
- 同步策略是当前用户全量拉取并替换本地缓存。
- 全量同步原因：当前云端删除是真删除，没有 tombstone，仅用 `updated_at` 增量无法反映删除。
- `transactionSync.ts` 会检查远端拉取结果是否包含非当前用户账单，如果有会停止写入本地缓存。

### v2.1b UI/UX 收口

- 统一按钮、输入框、卡片、状态提示和底部导航触控尺寸。
- 底部导航固定在移动端底部，并处理 safe area。
- 同步状态文案改为缓存语义：已同步缓存、离线缓存、同步失败显示上次缓存、同步中。
- AI 输入增加字符计数和候选数量提示。
- 账单页增加已应用筛选标签。
- 账单卡片按 `expense`、`income`、`transfer` 显示不同视觉状态。
- 统计概览卡片按支出、收入、结余显示不同视觉状态。
- 仅调整 UI/UX，不改变 Supabase schema、AI API contract、统计口径、IndexedDB 同步策略或 Service Worker 安全边界。

### 离线 UI

- `useNetworkStatus()` 监听浏览器 online/offline。
- `SyncStatusBanner` 显示在线、离线、同步失败和上次同步时间。
- 离线时只能查看上次同步数据。
- 离线时禁用正式写操作：手动保存、AI 解析/保存、CSV 导入、编辑、删除和批量删除。
- 手动记账按钮离线时提示“联网后可保存”。
- 草稿明确提示“仅保存在本设备，不是正式账单，不参与统计”。

### Service Worker 外壳缓存

- `components/ServiceWorkerRegistration.tsx` 只在生产环境注册 `/sw.js`。
- `public/sw.js` 缓存应用外壳、manifest、图标、离线页和 `/_next/static/*`。
- 导航请求使用 network-first，失败后 fallback 到缓存的 `/`，再 fallback 到 `/offline.html`。
- 明确 network-only：
  - 非 GET 请求。
  - `/api/*`。
  - Supabase 域名请求。
- 不缓存 Supabase 登录响应、AI API 响应或任何用户数据响应。
- 当前没有离线正式记账、离线同步队列、push notification。

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

- 当前是 Web/PWA，不是原生 iOS / Android App。
- 没有自定义分类、账户、支付方式管理。
- 默认分类是固定集合，非默认分类归一为 `其他`。
- 固定货币 `CNY`，没有多币种和汇率。
- CSV 导入只做追加新增，不做覆盖、合并或自动去重。
- 账单删除支持单条删除和当前已加载账单多选删除，不支持恢复、按日期范围删除或删除全部账单。
- 有本地缓存和离线只读查看，但没有离线正式记账、离线同步队列或冲突合并。
- Web 版使用 IndexedDB。
- 有基础 Service Worker 外壳缓存，但不缓存 Supabase/API 用户响应。
- 没有原生推送、Capacitor 封装或后台定时同步。
- `components/TransactionList.tsx` 是旧最近账单列表组件，当前主界面未引用，后续可清理。
- 当前没有单元测试或 E2E 测试脚本。

## 10. 后续 Web/PWA 更新建议

用户已明确希望重新回到 PWA 进行更新。下一阶段建议优先从 Web/PWA 自身价值出发，不把 App 路线混入本仓库文档：

- 修正生产域名、PWA 安装提示和 iOS 添加到主屏幕体验。
- 梳理 Service Worker 缓存版本和更新提示。
- 优化弱网/离线提示与同步失败恢复。
- 修复 Web/PWA 移动端可用性问题。
- 补充轻量测试或关键纯函数测试。
- 清理未使用组件前先确认没有隐藏引用。

仍不建议在未确认边界前直接做：

- Supabase schema 变更。
- 离线正式写入队列。
- AI 读取历史账单或统计数据。
- 自定义分类/账户/支付方式等大功能。
- 大规模 UI 重写。

## 11. 新对话启动 Prompt

```text
请先阅读 Web/PWA 仓库文档：

D:\fox\foxledger
- README.md
- AGENTS.md
- PROJECT_HANDOFF.md

当前 FoxLedger Web/PWA 是 v2.1b UI/UX 收口版，生产地址是：
https://ledger.foxyang.com/

本仓库已完成：
- Supabase Auth
- 当前用户 transactions 读写和 RLS
- 手动记账和本设备草稿
- AI 文本账单解析 API 和候选确认入库
- CSV 导入
- 账单搜索、筛选、排序、编辑、删除、多选删除
- 日期范围统计和 drilldown
- IndexedDB 本地缓存和离线只读
- v2.1b 移动端 UI/UX 收口
- PWA manifest、动态图标和 Service Worker 外壳缓存

请严格遵守：
- 不提交 .env.local 或任何密钥
- 不使用 service_role key
- 不绕过 RLS
- 不把历史账单、统计数据、本地缓存发给 AI
- AI 结果必须用户确认后才入库
- 不改 Supabase schema，除非我明确要求
- 本次只处理 Web/PWA 仓库，不混入 App 仓库进度

下一阶段我想继续更新 PWA。请先根据当前代码和文档给出计划，不要直接实现。
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
