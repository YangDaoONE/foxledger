# AGENTS.md

本文件面向后续 Codex / AI 开发助手。开始修改 FoxLedger 前，必须先阅读本文件、README.md、PROJECT_HANDOFF.md 和 APP_MIGRATION_PLAN.md。

## 1. 项目角色

FoxLedger / 狐狐记账是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA。

当前 Web/PWA 基线为 v2.1 正式版，已经完成：

- Supabase Auth 邮箱密码登录和注册。
- `public.transactions` 表、约束、索引、RLS policy 和 authenticated 权限授权。
- 手动记账。
- 首页本月概览。
- 首页手动记账加号入口，点击后在首页展开表单。
- 手动记账可选信息折叠区。
- 本设备手动记账草稿。
- 账单搜索、筛选、排序、加载更多。
- 账单编辑、单条删除和当前已加载账单多选删除。
- AI 单条/批量文本账单解析。
- AI 候选确认后入库。
- CSV 导入。
- 日期范围统计页。
- 统计项 drilldown 到账单页筛选。
- IndexedDB 本地账单缓存和同步元信息。
- 断网只读 UI 和上次同步提示。
- 基础 PWA metadata、manifest、动态图标路由。
- Service Worker 应用外壳缓存和离线提示页。
- Vercel 部署。
- AI API 邮箱白名单。

后续方向：

- Web/PWA v2.1 进入稳定维护，不再承接大规模 App 级功能扩张。
- iOS + Android App v0.x 已在平级仓库 `D:\fox\foxledger-app` 启动，当前完成到 v0.5 AI 解析迁移。
- 当前 Web 仓库仍是 Web/PWA v2.1 稳定维护线；除 `APP_MIGRATION_PLAN.md` 和交接说明外，不要把 App 功能写成 Web 已实现功能。

最高优先级：

1. 数据安全。
2. Supabase RLS 和用户隔离。
3. 记账准确性。
4. 离线缓存边界清晰。
5. 代码简单可维护。
6. 移动端可用性。

## 2. 开发原则

- 每次只做一个阶段。
- 小步提交。
- 不要主动实现用户没有要求的功能。
- 不要做超出当前阶段范围的功能。
- 不要主动进行技术栈迁移。
- 不要大规模重构项目结构。
- 不要修改与当前任务无关的文件。
- 不要删除已有 Web/PWA 功能，除非用户明确要求。
- 不要把尚未实现的功能写成已完成。
- 文档必须反映当前真实代码状态。
- 不要提交 `.env.local`。
- 不要提交任何 API key、Supabase key、OpenAI key、service_role key、CPA key、数据库密码或其他密钥。
- 不要引入 Supabase `service_role` key。
- 不要绕过 Supabase RLS。
- 不要让 AI 直接写数据库。
- AI 只能解析当前输入文本，不能读取历史账单、本地缓存或统计数据，除非用户未来明确重新设计隐私边界。
- 统计必须由代码基于数据库查询结果或本地缓存数据计算，不能调用 AI。
- 如果需要新增表或修改 schema，先给 migration、RLS 和回滚方案，等用户确认后再实施。
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

共享交易规则优先使用：

```text
lib/transactionRules.ts
```

不要在新组件里重新复制默认分类、交易类型、CNY 常量或基础校验函数。

## 4. Supabase / Auth / RLS 规则

必须保持：

- Supabase RLS 必须开启。
- 用户只能读写自己的 `transactions`。
- 查询、更新、删除除了依赖 RLS，也应显式约束当前用户。
- 任何新增数据访问都必须考虑当前用户隔离。
- 前端只能使用 publishable key：`NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 不要使用 `service_role` key。
- 不要把 Supabase 密钥写入前端代码。
- 不要允许前端传入任意 `user_id` 决定操作对象。

当前 migration：

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

如果出现 `permission denied for table transactions`，优先检查 `002_grant_transactions_permissions.sql` 是否已经在 Supabase SQL Editor 执行。

## 5. 本地缓存规则

Web/PWA 当前使用 IndexedDB，由 `lib/localDb.ts` 封装。

当前 DB：

```text
name: foxledger
version: 2
stores:
  transactions
  sync_meta
  manual_drafts
```

必须保持：

- 本地正式账单缓存必须按 `user_id` 隔离。
- 读取本地账单时必须传入当前登录用户 `userId`。
- Supabase 全量同步成功后，替换当前用户本地缓存。
- 全量同步用于正确反映云端删除，不要擅自改成只增量同步。
- 手动草稿只保存在 `manual_drafts`，不是正式账单，不参与统计。
- 在线退出成功后清理当前用户本设备缓存和草稿。
- 未登录时不要显示任何本地账单缓存。
- 不要把 Supabase access token、refresh token、登录响应、AI API 响应写入 IndexedDB。
- 不要把 IndexedDB 历史账单传给 AI。

未来 App 版如果使用 SQLite，必须保留同样的用户隔离和同步边界。

## 6. AI 解析规则

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
- AI API 必须验证 Supabase access token。
- 当前邮箱白名单机制 `ALLOWED_EMAILS` 必须保留。
- 前端请求必须携带 `Authorization: Bearer <supabase_access_token>`。
- 服务端只验证 token，不读取历史账单。
- 未登录返回 `401`。
- 已登录但邮箱不在白名单返回 `403`。
- 输入错误返回 `400`。
- AI 或服务端错误返回 `500`。
- AI 返回结果必须先 `JSON.parse`。
- AI 返回结果必须服务端二次校验和清洗。
- API 返回格式保持批量格式。
- AI 返回每条候选的 `raw_text` 应是对应原文片段，无法切分才 fallback 为完整输入。
- 日期必须是 `YYYY-MM-DD`。
- 文本里有日期，用文本日期。
- 只有“今天/昨天/前天”，用服务端日期推算。
- 完全没有日期，才用服务端今天。
- 不要让 AI 猜跨年日期。
- 如果没有可靠金额，返回 `needs_clarification: true`，不能保存。
- AI 只能把分类归到默认分类，服务端仍要兜底归一非默认分类为 `其他`。
- AI 不允许直接写数据库。
- AI 不允许计算统计。
- 用户确认后才写入 Supabase。
- 离线时不允许 AI 解析或保存 AI 候选。

当前限制常量：

```text
lib/parseTransactionLimits.ts
```

- `MAX_PARSE_INPUT_CHARS = 3000`
- `MAX_PARSED_TRANSACTIONS = 50`

安全注意：

- 不要发送历史账单、统计数据、IndexedDB 缓存、银行卡号、身份证号、完整地址等敏感信息给 AI。
- `OPENAI_API_KEY` 等只允许在服务端环境变量中。
- App v0.x 初期可调用现有 Web/Next AI API；不要把 AI key 放进 App。

## 7. CSV 导入规则

当前 CSV 导入是前端解析、预览、确认后写入 Supabase。

文件：

```text
components/ImportTransactions.tsx
lib/csvImport.ts
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
- 当前固定写入 `CNY`，不支持多币种。
- 非默认分类归一为 `其他`。
- `source` 为空或非法默认 `manual`。
- 不接 AI，不改数据库结构，不使用 `service_role` key。

## 8. 统计规则

文件：

```text
lib/stats.ts
lib/statsCalculator.ts
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

- 统计只读取当前用户自己的 transactions 或当前用户本地缓存。
- 统计基于当前用户本地缓存账单计算，本地缓存来自 Supabase 当前用户全量同步结果。
- `expense` 计入支出。
- `income` 计入收入。
- `balance = income - expense`。
- `transfer` 暂不计入收入、支出、结余。
- `amount` 按正数处理。
- 统计不调用 AI。
- 统计 drilldown 只切换到账单页并应用筛选，不新增数据库表。

## 9. UI/UX 规则

当前 Web/PWA 是移动端优先的单页应用，底部导航切换子界面：

- 首页。
- 账单。
- 统计。
- 设置。

请保持：

- Web/PWA 主线优先做 bug 修复、规则收口、安全和数据准确性维护。
- 不建议继续在 Web 主线做大规模可爱风 UI 重构或复杂对话式 AI 记账。
- 可爱风、对话式 AI 记账、原生 App 级交互更适合放到未来 App v0.x / v1.0 中设计。
- 表单简单、清晰、可用。
- 按钮有明确禁用态和加载态。
- 错误信息要能指导用户下一步。
- 移动端宽度和文本不要溢出。
- 不引入大型 UI 框架，除非用户明确要求。
- 当前已使用 `lucide-react` 图标，新增图标优先继续用它。
- 不要把卡片嵌套成复杂层级。
- 新功能尽量复用现有样式类，例如 `section-block`、`manual-field`、`primary-button`、`secondary-button`、`form-message`。
- 首页不要重新加入最近账单模块，除非用户明确要求。
- 离线状态必须清楚标记，不要让用户误以为离线草稿是正式账单。

## 10. PWA / Service Worker 规则

当前 PWA 文件：

```text
app/manifest.ts
app/icons/icon-192/route.tsx
app/icons/icon-512/route.tsx
app/icons/apple-touch-icon/route.tsx
lib/pwaIcon.tsx
components/ServiceWorkerRegistration.tsx
public/sw.js
public/offline.html
```

必须保持：

- Service Worker 只在生产环境注册。
- 可以缓存应用外壳、`/_next/static/*`、manifest、图标和离线提示页。
- 不缓存 `/api/*`。
- 不缓存 Supabase 请求。
- 不缓存登录响应、AI API 响应或任何用户敏感数据响应。
- 非 GET 请求必须 network-only。
- 当前没有离线正式记账、离线同步队列、push notification。

## 11. 部署规则

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
- 如果 Vercel 绑定了自有域名，也要把自有域名加入 Supabase Auth Site URL / Redirect URLs。
- 不要在仓库文档里写真实密钥或不必要的私有域名配置细节。

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

## 12. App 迁移原则

当前决策：

```text
Web/PWA v2.1 保持稳定维护。
平级仓库 foxledger-app 开发 iOS + Android App v0.x 测试版。
App 当前完成到 v0.5 AI 解析迁移。
App v0.x 先迁移 Web/PWA v2.1 核心能力并优化体验。
App v1.0 之后再做大功能创新。
```

建议目录：

```text
D:\fox\
  foxledger\        # 当前 Web/PWA v2.1
  foxledger-app\    # Expo React Native App v0.x，当前至 v0.5
```

建议 App 技术栈：

```text
Expo React Native + TypeScript
Expo Router
Supabase JS
TanStack Query
SQLite
FlashList
现有 Next.js AI API 过渡
```

原则：

- 不要在当前 Web 仓库里创建 Expo 项目，除非用户明确要求。
- 不要把 App 计划写成已完成。
- App v0.x 初期复用同一个 Supabase Auth、`transactions` 表和 RLS。
- App v0.x 初期可以调用现有 Web/Next AI API。
- App 端不能保存或暴露 AI key。
- App 端所有 Supabase 访问仍必须遵守 RLS 和当前用户隔离。
- 可迁移模块优先是类型、交易规则、CSV parser、AI sanitizer/contract、统计计算。
- Web/Next 专属模块包括 React DOM 组件、CSS、IndexedDB 适配、Service Worker 和 Next Route Handler。
- 不要在 App v0.x 阶段引入 schema 变更、离线正式记账、AI 对话式查账或自定义分类，除非用户另行确认。

详细迁移方案见 `APP_MIGRATION_PLAN.md`。

## 13. 提交前检查

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
