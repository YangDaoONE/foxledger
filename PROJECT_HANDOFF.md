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
  SyncStatusBanner.tsx              在线/离线和同步状态提示
  ServiceWorkerRegistration.tsx     生产环境注册 Service Worker

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
  localDb.ts                        IndexedDB 基础封装
  localTransactions.ts              本地账单查询、筛选、排序和汇总
  transactionSync.ts                Supabase 全量拉取并替换本地缓存
  statsCalculator.ts                基于账单数组的纯统计计算
  manualDraft.ts                    本设备手动记账草稿
  networkStatus.ts                  在线/离线状态订阅

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
- `public/sw.js` 提供基础 Service Worker 外壳缓存。
- 当前没有离线记账、离线同步或推送。

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
- 已有基础 service worker 外壳缓存；没有离线记账、离线同步、push notification。
- 没有 Capacitor App 封装。
- 首页最近账单模块已在 v2.1b 删除；首页手动记账改为加号入口，点击后在首页状态内展开表单。
- 手动记账表单已在 v2.1b 将商家、支付方式、备注折叠到可选信息区。
- 统计页已在 v2.1b 支持从概览指标、分类排行和每日趋势点击跳转到账单页筛选；当前没有切换图表类型。
- 当前没有单元测试或 E2E 测试脚本。
- 文档提交前如果工作区存在用户或上一阶段留下的未提交业务代码，不能擅自回滚；先确认用户是否要提交。

## 10. v2.1 正式版推荐拆分

v2.1 正式版目标是把 FoxLedger 从“在线 PWA 雏形”推进到“可离线查看的 PWA”。本阶段仍不做离线正式记账、不做离线队列同步、不缓存 Supabase 登录响应或 API 响应。

推荐拆成 3 个小阶段，每个阶段独立提交。当前进展：阶段 1、阶段 2 和阶段 3 均已实施；阶段 3 仍需线上部署后做浏览器离线验证。

### 阶段 1：本地缓存与同步

目标：
- Supabase 拉取成功后，将已经同步的真实账单写入 IndexedDB。
- 下次启动先显示本地缓存，再后台拉取云端最新数据。
- 统计页和首页概览基于本地账单缓存计算。
- 云端同步成功后，覆盖本地缓存并重新计算统计。

边界：
- 不改 Supabase schema。
- 不新增数据库表。
- 不做离线新增、编辑、删除。
- 不做增量同步；先做按当前用户的全量拉取和本地替换，确保云端删除能反映到本地。
- 本地缓存必须按 Supabase `user_id` 隔离。

当前实施状态：
- 已新增 IndexedDB 本地账单缓存、同步元信息、全量远端同步和本地统计计算。
- 首页概览、账单页、统计页已改为基于本地缓存读取和计算。
- 云端保存、编辑、删除成功后会触发后台全量同步并刷新本地缓存视图。

### 阶段 2：离线 UI 与草稿

目标：
- 断网时只允许查看上次同步数据。
- 明确显示“当前为离线数据”和上次同步时间。
- 禁用正式写操作：手动保存、AI 解析/保存、CSV 导入、编辑、删除和批量删除。
- 手动记账入口在离线时提示“联网后可保存”。
- 可以保留简单手动表单草稿，草稿仅保存在本设备，不进入正式账单，不参与统计。

边界：
- 不自动上传草稿。
- 不把草稿显示成真实账单。
- 登录退出时谨慎处理本地缓存和草稿。

当前实施状态：
- 已新增在线/离线状态检测和同步状态提示条。
- 离线时手动保存、AI 解析/保存、CSV 导入、编辑、删除和批量删除禁用或隐藏。
- 手动记账已支持本设备草稿，草稿不进入正式账单、不参与统计。
- 在线退出成功后会清理当前用户本设备缓存和草稿；离线时提示退出需要联网。

### 阶段 3：Service Worker 外壳缓存

目标：
- 缓存应用外壳：页面壳、JS、CSS、manifest、图标和离线提示页。
- 断网刷新时，App 外壳仍能打开，并显示本地缓存账单或离线提示。

边界：
- 不缓存 `/api/*`。
- 不缓存 Supabase 请求、登录响应、AI API 响应或任何包含用户敏感数据的网络响应。
- 只缓存静态应用资源和离线提示页。
- 对 POST/PUT/PATCH/DELETE 请求使用 network-only，不做缓存。

当前实施状态：
- 已新增 `public/sw.js`，缓存应用外壳、Next 静态资源、manifest、图标和离线提示页。
- 已新增 `public/offline.html`，用于极端情况下无法打开已缓存 App shell 时展示离线提示。
- 已新增 `components/ServiceWorkerRegistration.tsx`，并在 `app/layout.tsx` 中生产环境注册 `/sw.js`。
- Service Worker 对 `/api/*`、Supabase 域名请求和非 GET 请求保持 network-only，不缓存登录响应、AI API 响应或 Supabase 用户数据。
- 阶段 3 仍不实现离线正式记账、离线写入队列、push notification 或 schema 变更。

## 11. v2.1 阶段 1 详细计划：本地缓存与同步

### 目标结果

完成后应满足：
- 登录后先从 IndexedDB 读取当前用户已同步账单。
- 本地缓存存在时，首页概览、账单页、统计页可以先显示缓存数据。
- 后台再从 Supabase 拉取当前用户完整账单列表。
- Supabase 拉取成功后，用云端结果替换当前用户本地缓存。
- 本地缓存刷新后，首页概览、账单页、统计页重新计算并更新。
- 统计计算使用本地缓存账单，不直接依赖 AI，也不读取其他用户数据。

### 建议新增文件

```text
lib/localDb.ts
lib/localTransactions.ts
lib/transactionSync.ts
lib/statsCalculator.ts
```

用途：
- `localDb.ts`：封装 IndexedDB 打开、升级、事务和基础读写。
- `localTransactions.ts`：从 IndexedDB 查询当前用户账单，支持筛选、排序、分页和汇总。
- `transactionSync.ts`：从 Supabase 全量拉取当前用户账单，并替换本地缓存。
- `statsCalculator.ts`：从 `lib/stats.ts` 抽出纯统计计算函数，让统计既可基于远端数据，也可基于本地缓存数据。

### IndexedDB 设计

DB 名称：

```text
foxledger
```

版本：

```text
1
```

Store 1：`transactions`

建议字段：

```text
cache_key        // `${user_id}:${id}`，作为 keyPath
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
cached_at
```

建议索引：
- `user_id`
- `user_id_date`
- `user_id_updated_at`

Store 2：`sync_meta`

建议字段：

```text
user_id          // keyPath
last_attempt_at
last_successful_sync_at
transaction_count
last_error
```

阶段 1 暂不需要 `manual_drafts` store；草稿放到阶段 2。

### 同步策略

使用全量同步覆盖，不做增量同步。

原因：
- 当前 `transactions` 表有 `updated_at`，但删除是真删除，没有 tombstone。
- 如果只拉 `updated_at > lastSync`，本地无法知道云端已经删除的账单。
- 全量拉取后替换当前用户缓存，简单且准确。

流程：

```text
AuthGate 获取 session
↓
Dashboard 接收当前 userId
↓
先 readCachedTransactions(userId)
↓
用本地缓存渲染首页概览、账单页和统计页
↓
后台 syncTransactionsFromRemote(userId)
↓
分页读取 Supabase 当前用户全部 transactions
↓
replaceCachedTransactions(userId, remoteRows)
↓
更新 sync_meta
↓
通知 Dashboard 提升 cacheVersion
↓
各页面重新从本地缓存读取并计算
```

### 需要调整的现有代码

`components/AuthGate.tsx`
- 将当前 `session.user.id` 和 `session.user.email` 传给 `children`，或引入轻量 `AuthContext`。
- 阶段 1 推荐用显式 props，避免引入复杂状态管理。

`app/page.tsx`
- 允许 `AuthGate` render prop，把用户信息传给 `Dashboard`。

`components/Dashboard.tsx`
- 接收 `userId`。
- 增加本地缓存状态，例如：
  - `cacheVersion`
  - `syncStatus`
  - `lastSuccessfulSyncAt`
- 启动时先读本地缓存，再触发后台同步。
- `handleTransactionSaved()`、AI 保存成功、CSV 导入成功、编辑/删除成功后，触发云端同步并刷新本地缓存。

`lib/transactions.ts`
- 保留现有 Supabase 读写函数。
- 增加一个专门的远端全量拉取函数，例如 `listAllRemoteTransactionsForCurrentUser()`。
- 继续显式 `.eq("user_id", userData.user.id)`，不绕过 RLS。

`lib/localTransactions.ts`
- 实现本地版 `listTransactionsPage` 等价能力：
  - search：商户、备注、分类。
  - type。
  - category。
  - startDate/endDate。
  - sort。
  - limit/offset。
  - summary：总支出、总收入、笔数。
- 返回结构尽量复用 `TransactionPageResult`。

`components/TransactionManager.tsx`
- 从 `listTransactionsPage()` 改为调用本地缓存查询函数。
- 仍保留在线编辑、删除逻辑；阶段 1 尚未禁用离线写操作，离线 UI 放到阶段 2。
- `refreshKey/cacheVersion` 变化时重新读本地缓存。

`lib/stats.ts` / `lib/statsCalculator.ts`
- 将统计计算抽为纯函数：

```text
calculateStatsForTransactions(transactions, range): MonthlyStats
```

- `getStatsForDateRange()` 改为从本地缓存读取当前用户范围内账单后计算。
- 首页 `getMonthlyStats()` 同样基于本地缓存。

`components/StatsPanel.tsx`
- 接收 `userId` 或通过上层传入本地统计函数需要的上下文。
- 继续保持现有日期范围 UI 和 drilldown 行为。

### 数据安全规则

- IndexedDB 中所有账单必须写入 `user_id`。
- 所有本地读取必须先按当前 `userId` 过滤。
- 未登录时不显示任何本地账单缓存。
- 不缓存 Supabase access token、refresh token、登录响应或 AI API 响应。
- 不把 IndexedDB 数据传给 AI。
- AI 仍只能解析当前输入文本，不能读取本地历史账单。

### 第一阶段不做的事

- 不实现 Service Worker。
- 不实现离线正式记账。
- 不实现离线新增/编辑/删除队列。
- 不实现草稿。
- 不实现离线 UI 禁用态。
- 不改 Supabase migration。
- 不新增环境变量。

### 验证清单

- 在线登录后，Supabase 账单能写入 IndexedDB。
- 刷新页面后，先显示 IndexedDB 缓存数据。
- 后台同步成功后，缓存被云端数据覆盖。
- 云端删除一笔账单后，下次全量同步能从 IndexedDB 移除该账单。
- 账单页筛选、排序、加载更多基于本地缓存仍正常。
- 首页本月概览基于本地缓存正确显示。
- 统计页各日期范围基于本地缓存正确计算。
- 统计 drilldown 到账单页筛选仍正常。
- `npm run lint` 通过。
- `npm run build` 通过。

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
