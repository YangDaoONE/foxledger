# AGENTS.md

本文件面向后续 Codex / AI 开发助手。修改 FoxLedger Web/PWA 仓库前，必须先阅读本文件、`README.md` 和 `PROJECT_HANDOFF.md`。

本仓库只描述和维护 `D:\fox\foxledger` Web/PWA 代码、Supabase migrations 和 Supabase Edge Function。不要把 App 仓库进度、安装包计划或原生端路线写成本仓库已实现功能。

## 1. 项目角色

FoxLedger / 狐狐记账当前 Web/PWA 基线为 **v2.3 Vite PWA + Supabase Edge AI API 版**。

当前已完成：

- React + Vite + TypeScript 前端。
- TanStack Router 页面路由和底部导航。
- TanStack Query 查询、同步和刷新。
- Supabase Auth 邮箱密码登录、注册、会话恢复和退出。
- 当前用户 `transactions` 读写，继续依赖 Supabase RLS 并显式约束当前用户。
- Dexie / IndexedDB 本地缓存和同步元信息。
- 远端全量分页同步，完整校验后替换当前用户缓存。
- 离线只读查看已同步缓存。
- 手动新增、编辑、删除、当前已加载账单多选删除。
- 搜索、类型筛选、分类筛选、日期范围筛选、排序和加载更多。
- 账单搜索点击“搜索”或回车后才应用，不逐字刷新。
- AI 文本解析由 Supabase Edge Function `parse-transaction` 完成，候选确认后批量入库。
- CSV 导入。
- 日期范围统计和 drilldown 到账单页筛选。
- vite-plugin-pwa / Workbox 应用外壳缓存。

当前生产地址：

[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

最高优先级：

1. 数据安全。
2. Supabase RLS 和用户隔离。
3. 记账准确性。
4. 离线缓存边界清晰。
5. 代码简单可维护。
6. 移动端 PWA 可用性。

## 2. 开发原则

- 每次只做一个阶段。
- 小步提交。
- 不要主动实现用户没有要求的功能。
- 不要修改与当前任务无关的文件。
- 不要修改平级 App 仓库，除非用户明确要求。
- 不要提交 `.env`、`.env.local` 或任何真实密钥。
- 不要引入 Supabase `service_role` key。
- 不要绕过 Supabase RLS。
- 不要让 AI 直接写数据库。
- 不要把历史账单、统计数据或本地缓存发给 AI。
- AI 结果必须用户确认后才入库。
- 统计必须由代码基于当前用户数据计算，不能调用 AI。
- 不要修改 Supabase schema，除非用户明确要求并先确认方案。
- 文档必须反映当前真实代码状态。
- 修改完成后用中文说明改了什么、如何运行、如何测试、是否需要环境变量。

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
- 非默认分类归一为 `其他`。
- `source` 只能是 `manual` 或 `ai`。
- `ai_confidence` 可以为空，不为空时必须在 0 到 1 之间。
- `transfer` 暂不计入收入、支出和结余。
- 不要随意新增表或修改 schema。

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

PWA 前端共享交易规则在：

```text
src/features/transactions/transactionRules.ts
```

Edge Function 内也保留同一套默认分类和交易规则；如果未来调整分类，必须同步更新前端和 `supabase/functions/parse-transaction/index.ts`。

## 4. Supabase / Auth / RLS 规则

必须保持：

- Supabase RLS 必须开启。
- 用户只能读写自己的 `transactions`。
- 查询、更新、删除除了依赖 RLS，也应显式约束当前用户。
- 前端只能使用 publishable key。
- Edge Function 只能使用 publishable/anon key 校验用户 token，不使用 `service_role` key。
- 不要把 Supabase 密钥写入前端代码。
- 不要允许前端传入任意 `user_id` 决定操作对象。

当前 migration：

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

如果出现 `permission denied for table transactions`，优先检查 `002_grant_transactions_permissions.sql` 是否已经在 Supabase SQL Editor 执行。

## 5. 本地缓存规则

当前 PWA 使用 Dexie / IndexedDB，由 `src/lib/localDb.ts` 封装。

当前 DB：

```text
name: foxledger
version: 3
stores:
  transactions_cache
  sync_meta
```

`transactions_cache` 只缓存：

```text
cache_key
id
user_id
type
amount
currency
category
merchant
payment_method
date
note
source
created_at
updated_at
```

必须保持：

- 本地正式账单缓存必须按 `user_id` 隔离。
- 未登录时不要显示任何本地账单缓存。
- Supabase 全量同步成功后，替换当前用户本地缓存。
- 全量同步用于正确反映云端删除，不要擅自改成只增量同步。
- 全量同步必须分页、稳定排序，并设置最大页数或最大读取条数保护。
- 任一远端页失败，则统计和账单同步应整体报错，不替换上次缓存。
- 全部远端分页完整拉取并校验通过后，才在 Dexie transaction 中替换当前用户缓存。
- 不要把 `raw_text`、AI 原始响应、Supabase token、登录响应、`tag`、`account` 或 `ai_confidence` 写入本地缓存。
- 不要把 IndexedDB 历史账单传给 AI。
- 在线写操作成功后必须重新同步 Dexie，并刷新账单页和统计页。

缓存状态文案使用：

```text
已同步缓存
离线缓存
同步中
同步失败，显示上次缓存
```

## 6. AI 解析规则

当前 AI 业务 API：

```text
supabase/functions/parse-transaction/index.ts
```

PWA 前端调用：

```text
POST <SUPABASE_URL>/functions/v1/parse-transaction
Authorization: Bearer <supabase_access_token>
apikey: <supabase_publishable_key>
Content-Type: application/json
```

必须保持：

- Edge Function 必须要求登录。
- Edge Function 必须验证 Supabase access token。
- 邮箱白名单 `ALLOWED_EMAILS` 必须保留。
- Edge Function 不使用 `service_role` key。
- `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 只存在于 Supabase Edge Function secrets。
- 服务端只验证 token，不读取历史账单。
- AI 只能解析当前输入文本。
- 不把历史账单、统计数据、本地缓存、银行卡号、身份证号、完整地址等敏感信息给 AI。
- AI 返回结果必须先 `JSON.parse`。
- AI 返回结果必须服务端二次校验和清洗。
- AI 不允许直接写数据库。
- AI 不允许计算统计。
- 用户确认后才写入 Supabase。
- 离线时不允许 AI 解析或保存 AI 候选。

`supabase/config.toml` 中 `parse-transaction` 设置了 `verify_jwt = false`，用于让函数自己处理 CORS preflight 和中文错误响应；这不代表放弃登录校验，函数内部必须继续用 Supabase access token 验证用户。

## 7. CSV 导入规则

当前 CSV 导入是前端解析、预览、确认后写入 Supabase。

文件：

```text
src/features/import/ImportTransactions.tsx
src/features/import/csvImport.ts
```

规则：

- 必须已登录且在线才能导入。
- 导入数据只能写入当前用户。
- 只做追加新增，不做覆盖、合并、自动去重。
- 只强制要求 `date`、`amount`、`type` 三个表头。
- 列顺序不限，多余列忽略。
- 错误行不入库，合法行可以单独导入。
- `amount` 必须大于 0。
- `date` 必须是 `YYYY-MM-DD`。
- `type` 只能是 `expense`、`income`、`transfer`。
- 当前固定写入 `CNY`。
- 非默认分类归一为 `其他`。
- 不接 AI，不改数据库结构，不使用 `service_role` key。

## 8. 统计规则

文件：

```text
src/features/stats/statsApi.ts
src/features/stats/statsCalculator.ts
src/features/stats/statsRanges.ts
src/routes/StatsPage.tsx
```

当前支持范围：

- 本周。
- 本月。
- 上月。
- 今年。
- 自定义开始日期和结束日期。

规则：

- 统计基于当前用户 Dexie 本地缓存账单计算。
- `expense` 计入支出。
- `income` 计入收入。
- `balance = income - expense`。
- `transfer` 暂不计入收入、支出、结余。
- `amount` 按正数处理。
- 所有日期范围使用浏览器本地日期生成 `YYYY-MM-DD`，不要直接用 `toISOString()` 切日期。
- 自定义日期必须校验 `YYYY-MM-DD`、开始日期和结束日期不能为空、开始日期不能晚于结束日期。
- 统计不调用 AI。
- 统计 query key 独立于 transactions，使用 `["stats", userId, rangeKey...]`。
- 统计 drilldown 只切换到账单页并应用筛选，不新增数据库表。

## 9. UI/UX 规则

当前 PWA 是移动端优先应用，底部导航切换：

- 首页。
- 账单。
- 统计。
- 设置。

请保持：

- 优先移动端可用性。
- UI 参考 App v0.9 的信息架构、页面流程、基础控件和缓存状态文案。
- 不引入大型 UI 框架，除非用户明确要求。
- 当前使用 `lucide-react` 图标，新增图标优先继续用它。
- 表单简单、清晰、可用。
- 按钮有明确禁用态和加载态。
- 错误信息要能指导用户下一步。
- 移动端宽度和文本不要溢出。
- 不要把卡片嵌套成复杂层级。
- 离线状态必须清楚标记，不要让用户误以为离线草稿或离线缓存是正式新写入。

## 10. PWA / Service Worker 规则

当前 PWA 由 `vite-plugin-pwa` 生成 Service Worker。

必须保持：

- 可以缓存应用外壳和静态资源。
- 不缓存 Supabase 请求。
- 不缓存登录响应、AI API 响应或任何用户敏感数据响应。
- 非 GET 用户数据请求必须 network-only。
- 当前没有离线正式记账、离线同步队列或 push notification。

## 11. 部署规则

生产地址：

[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

规则：

- Vite PWA 可部署为静态前端。
- AI API 部署到 Supabase Edge Function `parse-transaction`。
- 线上 PWA 不需要旧 Next `/api/parse-transaction` rewrite。
- 修改 Supabase Edge Function secrets 后，需要重新部署或确认函数使用最新 secrets。
- 不要把 `.env.local` 提交到 GitHub。
- Supabase Auth URL Configuration 要包含生产地址和 preview redirect URLs。
- 如果域名变更，也要同步更新 Supabase Auth Site URL / Redirect URLs。
- 不要在仓库文档里写真实密钥。

PWA 前端环境变量名：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

兼容旧公开变量：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Edge Function secrets：

```text
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

`OPENAI_BASE_URL` 可以继续使用个人 VPS 的 OpenAI-compatible 转发地址。

## 12. 提交前检查

修改前：

```bash
git status
```

提交前至少执行：

```bash
npm run lint
npm run typecheck
npm run build
```

提交：

```bash
git add <changed-files>
git commit -m "<clear message>"
git push
```

如果检查失败，需要如实说明失败原因，不要隐瞒。
