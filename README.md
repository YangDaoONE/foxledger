# FoxLedger Web/PWA

FoxLedger / 狐狐记账是一个移动端优先的个人 AI 记账 PWA。本仓库只维护 Web/PWA 前端、Supabase schema migration 和 Supabase Edge Function AI 解析接口。

当前 Web/PWA 基线：**v2.3 Vite PWA + Supabase Edge AI API 版**。

生产地址：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

## 当前功能

- React + Vite + TypeScript 前端。
- TanStack Router 底部导航：首页、账单、统计、设置。
- TanStack Query 管理本地缓存读取、统计和同步刷新。
- Supabase Auth 邮箱密码登录、注册、会话恢复和退出登录。
- Supabase Postgres `public.transactions` 表读写，继续依赖 RLS 并显式约束当前用户。
- Dexie / IndexedDB 本地账单缓存和同步元信息。
- 远端账单全量分页同步到本地缓存，完整拉取和校验通过后才替换当前用户缓存。
- 离线只读查看已同步缓存，离线禁用正式写操作。
- 首页本月概览、手动记账入口和 AI 文本记账入口。
- 账单搜索、类型筛选、分类筛选、日期范围筛选、排序、加载更多。
- 账单搜索输入不会逐字刷新，点击“搜索”或按回车后才应用搜索条件。
- 账单编辑、单条删除和当前已加载账单多选删除。
- 日期范围统计页：本周、本月、上月、今年、自定义日期。
- 统计展示总支出、总收入、结余、交易笔数、日均支出、最大单笔支出、分类排行和每日趋势。
- 统计项 drilldown 到账单页并应用筛选，同时清空账单页旧分页和多选状态。
- CSV 前端解析、预览、错误行提示和确认导入。
- vite-plugin-pwa / Workbox 生成应用外壳缓存。
- AI 解析通过 Supabase Edge Function `parse-transaction` 完成，AI 结果仍需用户确认后才入库。

## 技术栈

- React
- Vite
- TypeScript
- TanStack Router
- TanStack Query
- Supabase JS
- Supabase Auth
- Supabase Postgres + RLS
- Supabase Edge Functions
- Dexie / IndexedDB
- vite-plugin-pwa / Workbox
- lucide-react
- ESLint

## 目录结构

```text
src/
  main.tsx                         Vite 前端入口
  app/
    AppShell.tsx                   登录后应用壳和底部导航容器
    router.tsx                     TanStack Router 路由树
  auth/
    AuthProvider.tsx               Supabase session 和当前用户上下文
    AuthGate.tsx                   登录态守卫
    AuthScreen.tsx                 登录/注册界面
  components/
    BottomNav.tsx                  首页/账单/统计/设置底部导航
    ui/                            AppButton、Chip、TextField、SectionBlock、StateBlock
  features/
    ai/                            Edge Function 调用、AI 候选确认和保存规则
    import/                        CSV 解析和导入 UI
    stats/                         统计范围、统计计算和本地缓存统计读取
    sync/                          同步状态、同步 Provider 和缓存状态提示
    transactions/                  交易规则、Supabase 写操作、本地缓存读取、账单 UI
  lib/
    date.ts                        App 本地日期 helper
    env.ts                         Vite 前端环境变量读取
    format.ts                      金额和时间格式化
    localDb.ts                     Dexie schema 和缓存清理
    networkStatus.ts               浏览器在线/离线状态
    queryClient.ts                 TanStack Query client
    supabase.ts                    Supabase browser client
  routes/
    HomePage.tsx
    TransactionsPage.tsx
    StatsPage.tsx
    SettingsPage.tsx
  styles/
    globals.css

supabase/
  config.toml
  functions/
    parse-transaction/index.ts     AI 解析 Edge Function
  migrations/
    001_create_transactions.sql
    002_grant_transactions_permissions.sql

public/
  icon.svg
  offline.html
```

## 环境变量

PWA 前端需要：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

兼容旧公开变量：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

说明：

- `VITE_SUPABASE_URL`：Supabase 项目 URL。
- `VITE_SUPABASE_PUBLISHABLE_KEY`：Supabase publishable key，仅用于前端客户端。
- PWA 前端不读取 `OPENAI_API_KEY`、`OPENAI_BASE_URL` 或 `ALLOWED_EMAILS`。
- PWA 前端直接调用 `${VITE_SUPABASE_URL}/functions/v1/parse-transaction`，并携带当前 Supabase access token。

Supabase Edge Function secrets 需要：

```text
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

说明：

- `AI_PROVIDER` 当前只支持 `openai`。
- `OPENAI_BASE_URL` 可以继续使用个人 VPS 的 OpenAI-compatible 转发地址。
- `OPENAI_API_KEY` 只放在 Supabase Edge Function secrets，不放在前端。
- `ALLOWED_EMAILS` 用英文逗号分隔，必须包含允许使用 AI 解析的登录邮箱。
- Supabase Edge Function 自动提供 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`；如果项目使用新的 publishable key，也可额外设置 `SUPABASE_PUBLISHABLE_KEY`。

不要在文档、代码或提交记录中写真实值。

## 数据和缓存规则

核心远端表仍是 `public.transactions`，本阶段不改 Supabase schema。

Dexie DB：

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

不缓存：`raw_text`、AI 原始响应、Supabase token、登录响应、`tag`、`account`、`ai_confidence`。

同步规则：

- 本地缓存按 `user_id` 隔离。
- 未登录时不显示任何本地缓存。
- 远端全量同步使用固定 page size、稳定排序和最大读取保护。
- 任一远端页失败，则本次同步失败，不替换本地缓存。
- 所有远端分页完整拉取并校验 `user_id` 后，才在 Dexie transaction 中替换当前用户缓存。
- 在线写操作成功后重新同步 Dexie，并刷新账单页和统计页。
- 离线时禁用新增、编辑、删除、多选删除、AI 解析、AI 候选保存和 CSV 导入。

## AI 边界

PWA 前端调用：

```text
POST <SUPABASE_URL>/functions/v1/parse-transaction
Authorization: Bearer <supabase_access_token>
apikey: <supabase_publishable_key>
Content-Type: application/json
```

Edge Function 文件：

```text
supabase/functions/parse-transaction/index.ts
```

必须保持：

- AI key、`OPENAI_BASE_URL`、Prompt 和 provider 配置只在 Supabase Edge Function secrets。
- Edge Function 不使用 `service_role` key。
- Edge Function 使用 Supabase publishable/anon key 验证 access token。
- PWA 不直接调用 OpenAI-compatible provider。
- PWA 不把历史账单、统计数据或本地缓存发给 AI。
- AI 只解析当前输入文本。
- AI 结果必须用户确认后才写入 Supabase。
- 离线时不允许 AI 解析或保存 AI 候选。
- Edge Function 不写数据库，不做统计。

## 本地开发

安装依赖：

```bash
npm install
```

启动 Vite：

```bash
npm run dev
```

基础检查：

```bash
npm run lint
npm run typecheck
npm run build
```

预览生产构建：

```bash
npm run preview
```

## Edge Function 部署

安装并登录 Supabase CLI：

```bash
npm install supabase --save-dev
npx supabase login
```

绑定项目：

```bash
npx supabase link --project-ref <your-project-ref>
```

设置 secrets：

```bash
npx supabase secrets set AI_PROVIDER=openai
npx supabase secrets set OPENAI_API_KEY=<your-api-key>
npx supabase secrets set OPENAI_BASE_URL=<your-openai-compatible-base-url>
npx supabase secrets set OPENAI_MODEL=<your-model>
npx supabase secrets set ALLOWED_EMAILS=<allowed-email-list>
```

部署：

```bash
npx supabase functions deploy parse-transaction
```

也可以使用仓库脚本：

```bash
npm run functions:deploy
```

`supabase/config.toml` 中 `parse-transaction` 设置了 `verify_jwt = false`，这是为了让函数自己处理 CORS preflight 和中文错误响应；函数内部仍会校验 `Authorization: Bearer <access_token>`，不使用 `service_role`。

## 部署

- 生产主入口仍以 [https://ledger.foxyang.com/](https://ledger.foxyang.com/) 为准。
- Vite PWA 可部署为静态前端。
- 线上 PWA 不需要旧 Next `/api/parse-transaction` rewrite。
- Service Worker 由 vite-plugin-pwa 生成，不缓存 Supabase 请求、登录响应、AI API 响应或用户数据响应。
- Supabase Auth URL Configuration 要包含生产地址和 preview redirect URLs。
- 如果域名变更，也要同步更新 Supabase Auth Site URL / Redirect URLs。

## 当前限制

- 没有离线正式写入队列。
- 没有 AI 查账。
- 没有 AI 读取历史账单。
- 没有自定义分类、账户或支付方式管理。
- 没有多币种和汇率。
- CSV 导入只追加新增，不覆盖、不合并、不自动去重。
- 当前没有 E2E 测试脚本，提交前主要依赖 `npm run lint`、`npm run typecheck` 和 `npm run build`。
