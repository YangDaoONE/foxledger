# FoxLedger Web/PWA

FoxLedger / 狐狐记账 Web/PWA 是移动端优先的个人记账应用。本仓库只维护 `D:\fox\foxledger` Web/PWA 前端、Supabase migrations 和 Supabase Edge Function，不包含原生 App 仓库内容。

当前基线：**v2.3.1 Vite PWA + Supabase Edge AI API 收口版**  
生产地址：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

## 当前状态

已完成：

- React + Vite + TypeScript 前端。
- TanStack Router 底部导航：首页、账单、统计、设置。
- 页面按路由懒加载，React、TanStack、Supabase 和本地存储依赖独立分包。
- TanStack Query 查询、刷新和同步状态管理。
- Supabase Auth 邮箱密码登录、注册、会话恢复和退出。
- Supabase Postgres `public.transactions` 当前用户读写，继续依赖 RLS 并显式约束当前用户。
- Dexie / IndexedDB 离线只读缓存，按 `user_id` 隔离。
- 远端全量分页同步，全部页面拉取和校验通过后才替换当前用户本地缓存。
- 首页本月概览、手动记账入口、AI 文本记账入口。
- 账单搜索、筛选、排序、加载更多、编辑、单条删除、当前已加载账单多选删除。
- 账单搜索只在点击“搜索”或按回车后应用，不逐字刷新。
- 日期范围统计、分类排行、每日趋势轻量条形展示、统计 drilldown 到账单页筛选。
- CSV 前端解析、预览、错误行提示和确认导入。
- AI 文本解析迁移到 Supabase Edge Function `parse-transaction`，候选必须用户确认后才写入 Supabase。
- vite-plugin-pwa / Workbox 应用外壳缓存。
- Vercel 已按 Vite 静态前端部署，线上不再依赖旧 Next `/api/parse-transaction`。

当前限制：

- 没有离线正式写入队列。
- 没有 AI 查账，AI 不读取历史账单、统计数据或本地缓存。
- 没有自定义分类、账户、支付方式管理。
- 没有多币种和汇率。
- CSV 导入只追加新增，不覆盖、不合并、不自动去重。
- 目前没有 E2E 测试脚本。

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

## 关键目录

```text
src/
  main.tsx                         Vite 入口
  app/
    AppShell.tsx                   登录后应用壳和底部导航容器
    queryKeys.ts                   TanStack Query 查询键工厂
    router.tsx                     TanStack Router 路由
  auth/                            Supabase session、登录守卫、登录/注册页
  components/                      底部导航和通用 UI 组件
  features/
    ai/                            Edge Function 调用、AI 候选确认和保存
    import/                        CSV 解析和导入 UI
    stats/                         统计范围、统计计算和本地缓存统计读取
    sync/                          同步 Provider 和缓存状态提示
    transactions/                  交易规则、Supabase 写操作、本地缓存读取、账单 UI
  lib/
    date.ts                        本地日期 helper
    env.ts                         前端环境变量读取
    localDb.ts                     Dexie schema 和缓存清理
    supabase.ts                    Supabase browser client
  routes/                          首页、账单、统计、设置
  styles/globals.css               全局样式

supabase/
  config.toml
  functions/parse-transaction/     AI 解析 Edge Function
  migrations/                      transactions 表和权限 migration
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

Supabase Edge Function secrets：

```text
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

说明：

- `OPENAI_BASE_URL` 可以继续使用个人 VPS 的 OpenAI-compatible 转发地址。
- `OPENAI_API_KEY` 只放在 Supabase Edge Function secrets，不进入 PWA 前端。
- 前端只调用 `<SUPABASE_URL>/functions/v1/parse-transaction`。
- 不要在代码、文档、提交记录或截图里写真实密钥。

## 数据和安全规则

核心远端表仍是 `public.transactions`，本阶段不改 Supabase schema。

必须保持：

- 不提交 `.env`、`.env.local` 或任何真实密钥。
- 不使用 Supabase `service_role` key。
- 不绕过 RLS。
- 前端只能使用 publishable key。
- 查询、更新、删除除了依赖 RLS，也要显式约束当前用户。
- AI 只解析当前输入文本，不读取历史账单、统计数据或本地缓存。
- AI 不直接写数据库，不计算统计。
- AI 结果必须用户确认后才入库。
- 离线时禁用正式写操作，包括新增、编辑、删除、多选删除、AI 保存候选和 CSV 导入。

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

## 本地开发

```bash
npm install
npm run dev
```

提交前检查：

```bash
npm run lint
npm run typecheck
npm run build
```

预览生产构建：

```bash
npm run preview
```

部署 Edge Function：

```bash
npm run functions:deploy
```

`supabase/config.toml` 中 `parse-transaction` 的 `verify_jwt = false` 是为了函数自己处理 CORS preflight 和中文错误响应；函数内部仍必须验证 `Authorization: Bearer <access_token>`。

## 最近验证结果

当前已验证：

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm run build`：通过；页面与公共依赖已分包，无 chunk size 提示。
- `npm audit --audit-level=moderate`：0 vulnerabilities。
- 本地生产预览：登录页和懒加载路由正常，浏览器控制台无错误或警告。
- 本地与线上账单同步状态正常，未再出现长时间停留在“同步中”的问题。
- 真实手机 PWA 安装、离线缓存和恢复联网同步验收通过。
- AI 端到端验收通过，包括登录与白名单校验、解析、异常提示、候选确认保存和保存后同步。

`parse-transaction` 已部署，生产站点 [https://ledger.foxyang.com/](https://ledger.foxyang.com/) 正在提供 Vite 静态产物。

文档更新后如只改 Markdown，可不重复部署；如果改代码，仍按提交前检查执行。

## 下一阶段重点

优先级从高到低：

1. 增加关键纯函数测试：日期范围、统计口径、账单排序筛选、CSV parser、AI 清洗规则。
2. 增强同步状态诊断：显示最近同步时间、失败原因和手动重试入口。
3. 评估前端交易规则和 Edge Function 交易规则的重复维护成本，只在明显收益时抽出共享规则。
