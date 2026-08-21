# FoxLedger Web/PWA

FoxLedger / 狐狐记账 Web/PWA 是移动端优先的个人记账应用。本仓库只维护 `D:\fox\foxledger` Web/PWA 前端、Supabase migrations 和 Supabase Edge Function，不包含原生 App 仓库内容。

当前生产版本：**V3.2 狐狐对话体验收口版**
生产地址：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

V3.0 已于 2026-08-13 完成 M0–M5 代码、本地生产构建、Vercel 生产部署和真机 PWA 更新验收，现已正式收口。

V3.1 已于 2026-08-17 完成 M0–M5 代码、自动化、受控真实只读问账、生产部署、服务器产物核对和真实手机安装态 PWA 更新验收，现已正式收口。

V3.2 M0–M2 已于 2026-08-18 完成代码、自动化验收、Edge Functions 和静态前端生产部署，服务器产物已核对；2026-08-21 用户确认真实手机安装态 PWA 更新与交互验收完成，V3.2 现已正式收口。

2026-08-19 完成全站视觉与响应式体验重整，提交 `8f31607` 已推送到 `origin/main` 并由 Vercel 发布到生产。主页、`/chat`、24 个非 Service Worker 文件、PWA 预缓存集合和 NetworkOnly 边界已与本地构建核对一致；本次未修改数据逻辑、Supabase、Edge Function 或安全边界。该版本的真实手机安装态验收已于 2026-08-21 完成。

V3.3 M0–M2 已于 2026-08-22 完成本地代码与自动化：聊天记账结果自动收起、问账回答先行，以及带完整 RLS/迁移/缓存/Edge 作用域的多账本。**当前处于生产分阶段发布中**：`005_add_ledgers.sql` 已执行并通过数据/RLS 契约检查，`fox-chat` version 5 已部署且未登录请求正确返回 401；Vercel 尚未发布本次前端，服务器产物与真实手机安装态 PWA 尚未验收，因此用户可见生产前端仍为 V3.2。

## 当前状态

已完成：

- React + Vite + TypeScript 前端。
- TanStack Router 五栏底部导航：首页、账单、狐狐、统计、设置。
- 页面按路由懒加载，React、TanStack、Supabase 和本地存储依赖独立分包。
- TanStack Query 查询、刷新和同步状态管理。
- Supabase Auth 邮箱密码登录、注册、会话恢复和退出。
- Supabase Postgres 当前用户读写继续依赖 RLS 并显式约束当前用户；V3.3 本地 migration 新增 `public.ledgers`，并让每条 transaction 必须归属当前用户的一个账本。
- Dexie v5 / IndexedDB 同时缓存账本与正式账单，按 `user_id + ledger_id` 隔离，并保留 AI 批次标识。
- 远端全量分页同步升级为账本与交易一致同步，全部页面拉取和交叉校验通过后才在同一个 Dexie transaction 中替换当前用户缓存。
- 首页本月概览、手动记账入口、“和狐狐记一笔”入口。
- 账单搜索、筛选、排序、加载更多、编辑、单条删除、当前已加载账单多选删除。
- 账单搜索只在点击“搜索”或按回车后应用，不逐字刷新。
- 日期范围统计、分类排行、每日趋势轻量条形展示、统计 drilldown 到账单页筛选。
- CSV 前端解析、预览、错误行提示和确认导入。
- 独立懒加载 `/chat` 狐狐页：消息、解析状态、候选摘要、详情、编辑、移除和确认。
- `needs_attention` 候选必须补全并完成核对，或移除后，整批才能确认。
- 用户确认时生成固定 `ai_batch_id` 和 transaction IDs；响应不确定时执行只读协调查询，避免重复记账。
- 保存后区分远端成功与本地缓存刷新失败；`sync_warning` 只重试同步，不重复写入。
- 从 Dexie 当前真实缓存重建最近 AI 批次，支持正式单笔编辑、二次确认删除和整批撤销。
- 当前聊天跨应用内路由保留，刷新、关闭、登录失效或退出后清空，不持久化聊天。
- 原创轻量狐狐提供 normal、listening、thinking、happy、confused 五种状态和 reduced-motion 适配。
- 生产 PWA 通过 Supabase Edge Function `fox-chat` 统一处理 AI 记账与安全问账；`parse-transaction` 保留为 V3.0 兼容回退能力。两者的记账候选都必须用户确认后才写入 Supabase。
- vite-plugin-pwa / Workbox 应用外壳缓存。
- Workbox 对 Supabase/API 敏感路径和非 GET 请求使用显式 `NetworkOnly`，只对同源静态图片使用运行时缓存。
- Vitest + React Testing Library 覆盖关键规则、缓存、同步、批次状态机和 Chat 交互。
- V3.1 M0 已增加前端与 Edge 共用的环境无关统计模块、严格 query plan / stats envelope / grounded answer 契约，以及统计 drilldown 回归测试。
- V3.1 M1 已抽取 Edge 公共认证、邮箱白名单、环境变量和 OpenAI client，并实现用户 JWT + publishable key + RLS 的完整只读分页、代码白名单筛选、商家聚合、比较统计和最多 500 条 AI 安全明细选择。
- V3.1 M2 已实现 `fox-chat` 第一阶段：一次 AI 严格路由记账、问账、澄清和不支持；记账复用 V3.0 服务端清洗，问账只返回 normalized plan，强制意图纠错只允许记账或问账。
- V3.1 M3 已接通并通过受控验收：RLS 完整查询、代码统计、最多 500 条五字段 AI 明细、第二次 grounded answer、服务端 metric ref 替换、内存连续追问、依据展开和账单筛选跳转；`fox-chat` 与 V3.1 前端均已部署。
- M3 只读层兼容历史分类：未知、空或带首尾空格的分类按现有交易规则归为 `其他`；日期、类型、金额、商家、用户归属和分页完整性仍严格校验。
- V3.1 M4 已完成本地实现：品牌、财务语义、间距、圆角和阴影 token 收口；登录、首页、账单、统计、设置及狐狐现有表现统一；同步状态显示缓存行数、最近成功时间、具体失败原因和手动重试；未修改同步算法、交易 API、统计口径、数据库 schema 或 AI 数据边界。
- V3.1 M5 已增加 15 条 Playwright 桌面/Pixel 7/Axe/PWA 流程，覆盖登录、核心导航、统计口径、问账请求白名单、依据、会话清理、离线只读、恢复同步、320px 五页溢出/焦点、退出清理、WCAG AA 和离线应用壳；验收发现并修复移动端从文本框点击发送时的布局跳动，以及设置页原生 CSV 控件撑宽页面的问题。
- V3.2 M0 已让保存后的聊天结果卡按 `saveRequest.batchId` 直接打开 Dexie 正式批次详情，并复用一套正式编辑、二次确认删除、整批撤销和写后同步管理；最近 AI 批次继续作为历史入口，离线可查看但不可写。
- V3.2 M1 已把狐狐页主文案收口为记账/问账产品入口，安全与数据用途移入默认折叠的“数据与隐私”，问账统计和依据架构保持不变。
- V3.2 M2 已让候选优先显示商家并使用中文交易类型；Composer 支持约 2–5 行自动增高、Enter 发送、Shift+Enter 换行和 IME 选词保护。
- V3.2 已部署修复让记账服务先建立整句日期作用域，再判定片段中的紧凑数字：`今天，7.6吃饭`按今天 ¥7.60，`7.6吃饭花了76`按 7 月 6 日 ¥76；`M/D`、`M-D` 和带日期标记的写法继续作为日期，带货币单位的小数作为金额，真正歧义时要求用户核对。
- V3.3 M0 本地实现让保存后的聊天记账结果在稳定保存后自动收起为一行，可随时展开并继续进入正式批次详情；错误、同步警告和用户交互保持展开。
- V3.3 M1 本地实现把问账结果收口为“直接回答 + 相关指标”，更多统计和依据按需展开；自然语言解释不可用时仍展示代码统计。
- V3.3 M2 本地实现真正多账本：全局轻量切换器控制首页、账单、统计和问账作用域；手动、CSV 与整批 AI 候选可选择非当前目标账本且不改变浏览范围；设置页支持创建、重命名和删除空账本。
- V3.3 Edge 本地协议要求 `ledger_id`，使用用户 JWT + RLS 验证账本所有权并逐页 `.eq("ledger_id")`；账本 UUID/名称不发送给模型，第二次 AI 明细白名单仍只有 `date/type/amount/category/merchant`。
- Vercel 已按 Vite 静态前端部署，线上不再依赖旧 Next `/api/parse-transaction`。

当前限制：

- 没有离线正式写入队列。
- 没有自定义分类、账户、支付方式管理。
- 没有多币种和汇率。
- CSV 导入只追加新增，不覆盖、不合并、不自动去重。

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
- Vitest
- React Testing Library

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
    chat/                          狐狐内存会话、候选/保存状态机、最近批次和保存后管理
    import/                        CSV 解析和导入 UI
    stats/                         统计范围、统计计算和本地缓存统计读取
    sync/                          同步 Provider 和缓存状态提示
    transactions/                  交易规则、Supabase 写操作、本地缓存读取、账单 UI
  lib/
    date.ts                        本地日期 helper
    env.ts                         前端环境变量读取
    localDb.ts                     Dexie schema 和缓存清理
    supabase.ts                    Supabase browser client
  routes/                          首页、账单、狐狐、统计、设置
  styles/globals.css               全局样式

supabase/
  config.toml
  functions/_shared/               V3.1 共享统计、严格契约、Edge 认证/AI client 和安全只读数据层
  functions/fox-chat/              V3.1 M2–M3 意图路由与只读问账（已部署验收）
  functions/parse-transaction/     AI 解析 Edge Function
  migrations/                      transactions 表和权限 migration
scripts/verify-v3-build.mjs        Chat chunk、角色资源和 Workbox 边界验证
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
- 当前生产前端调用 `<SUPABASE_URL>/functions/v1/fox-chat`；`parse-transaction` 继续保留为 V3.0 兼容回退能力。
- 不要在代码、文档、提交记录或截图里写真实密钥。

## 数据和安全规则

当前生产远端已包含 `public.ledgers`，并已为 `public.transactions` 增加必填 `ledger_id`；用户可见前端仍待发布 V3.3。V3.0 已增加最小字段：

```text
ai_batch_id uuid null
```

`ai_batch_id` 只用于 `source = 'ai'` 的同次确认批次，不新增 batch 或聊天表。

必须保持：

- 不提交 `.env`、`.env.local` 或任何真实密钥。
- 不使用 Supabase `service_role` key。
- 不绕过 RLS。
- 前端只能使用 publishable key。
- 查询、更新、删除除了依赖 RLS，也要显式约束当前用户。
- V3.3 transaction 写入的 `ledger_id` 必须属于同一当前用户；数据库复合外键与 RLS 同时保护，删除账本绝不级联删除交易。
- 记账 AI 只解析当前输入文本；问账第一阶段只接收当前问题和可选 normalized plan 上下文。
- 问账服务端只在当前用户 JWT + RLS 和已验证当前账本边界内读取与计划相关的云端账单；第二次 AI 只接收代码计算的完整相关统计及最多 500 条 `date/type/amount/category/merchant` 明细，不接收 Dexie、本地缓存、账本 UUID/名称或禁止字段。
- AI 不直接写数据库，也不生成正式统计；正式数字始终由代码计算并通过 metric ref 服务端替换。
- AI 结果必须用户确认后才入库。
- 新 V3.0 AI 账单不持久化 `raw_text`；它只在当前内存候选核对期间存在。
- 离线时禁用正式写操作，包括新增、编辑、删除、多选删除、AI 保存候选和 CSV 导入。

Dexie DB：

```text
name: foxledger
version: 5
stores:
  ledgers_cache
  transactions_cache
  sync_meta
```

`transactions_cache` 只缓存：

```text
cache_key
id
user_id
ledger_id
type
amount
currency
category
merchant
payment_method
date
note
source
ai_batch_id
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
npm run test
npm run build
npm run verify:v3
npm run test:e2e
npm audit --audit-level=moderate
```

预览生产构建：

```bash
npm run preview
```

部署 Edge Function：

```bash
npm run functions:deploy
```

`supabase/config.toml` 中 `parse-transaction` 与 `fox-chat` 的 `verify_jwt = false` 是为了函数自己处理 CORS preflight 和中文错误响应；两个函数内部仍必须验证 `Authorization: Bearer <access_token>`。

## 最近验证结果

当前已验证：

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm run test`：44 个测试文件、213 项测试通过。
- `npm run build`：通过；Chat 页面与公共依赖独立分包，无 chunk size 提示。
- `npm run verify:v3`：通过；PWA NetworkOnly/本地图片边界正常。
- `npm run test:e2e`：29 条系统 Chrome 桌面、Pixel 7、Axe 与 PWA 流程通过。
- `npm audit --audit-level=moderate`：0 vulnerabilities。
- 受控真实账号只读问账通过：服务端返回可信范围、代码统计和五字段依据，未产生写操作。
- V3.1 生产部署通过：主页与 `/chat` 返回 200，主 JS/CSS 哈希匹配本地构建；manifest、Service Worker、23 个唯一预缓存资源和 NetworkOnly 边界核对通过。
- V3.2 生产部署通过：提交 `ccc98fb` 已推送到 `origin/main`，`parse-transaction`、`fox-chat` 和 Vercel 静态前端已发布；主页与 `/chat` 返回 200，24 个非 Service Worker 文件与本地构建逐字节一致，Service Worker 预缓存集合一致且 NetworkOnly 边界保持，未登录 Edge 请求正确返回 401。
- 2026-08-19 视觉重整生产部署通过：提交 `8f31607` 已推送到 `origin/main`，Vercel 状态成功；主页与 `/chat` 返回 200，24 个非 Service Worker 文件与本地构建逐字节一致，Service Worker 预缓存集合及 5 条 NetworkOnly 边界一致。
- V3.0 历史发布验收已通过：提交 `94aeba1` 的服务器产物、账单同步、M0–M5 功能和真实手机 PWA 更新均已确认。

V3.2 已完成代码、自动化、生产部署、服务器产物核对和真实手机安装态 PWA 更新与交互验收，当前生产运行 V3.2，版本已正式收口。

V3.3 M0–M2 已完成本地实现与自动化门禁，生产 migration 与 Edge 已完成；静态前端发布、服务器产物核对和真机 PWA 验收仍待执行，不能把本地 `dist` 视为生产状态。

文档更新后如只改 Markdown，可不重复部署；如果改代码，仍按提交前检查执行。

## 后续边界

- V3.0 和 V3.1 已完成发布验收并正式收口。
- V3.1 M0–M5 已完成代码、自动化、人工、生产和真机验收，并保持小步提交。
- 生产 PWA 已接入 `fox-chat`、M4 全站视觉/同步诊断和 M5 验收修复。
- V3.2 M0–M2 与全站视觉重整已按实际代码完成实现、自动化验收、生产部署、服务器产物核对和真实手机安装态 PWA 更新与交互验收，V3.2 已正式收口。
- V3.3 M0–M2 已按 `docs/V3.3_PR.md` 完成本地实现和自动化，生产发布与真机验收仍待用户后续明确推进。
- V3.3 未生产收口前，不得把本地多账本 schema 或 Edge 协议写成线上已生效能力。
- 语音、OCR、图片记账和原生能力不在当前 Web/PWA 范围内。
