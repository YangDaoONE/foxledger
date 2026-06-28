# PROJECT_HANDOFF.md

本文件用于把 FoxLedger Web/PWA 当前状态交接给下一轮 ChatGPT / Codex 对话。新对话开始前，请先阅读 `AGENTS.md`、`README.md` 和本文件。

本文件只描述 `D:\fox\foxledger` Web/PWA 仓库。不要在这里记录 App 仓库的版本进度或安装包计划。

## 1. 一句话总结

FoxLedger Web/PWA 当前为 **v2.3 Vite PWA + Supabase Edge AI API 版**：前端已从 Next.js App Router 重构为 React + Vite + TypeScript，并接入 TanStack Router、TanStack Query、Dexie/IndexedDB 和 vite-plugin-pwa；AI 业务 API 已从旧 Next route 迁移到 Supabase Edge Function `parse-transaction`。本阶段未修改 Supabase schema、RLS、AI Prompt 业务边界或 App 仓库。

生产主入口：

[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

## 2. 当前技术栈

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

## 3. 当前目录和关键文件

```text
src/main.tsx                                  Vite 前端入口
src/app/router.tsx                            TanStack Router 路由树
src/app/AppShell.tsx                          登录后应用壳
src/auth/*                                    Supabase session、登录守卫、登录/注册页
src/components/BottomNav.tsx                  底部导航
src/components/ui/*                           通用按钮、Chip、输入框、Section、状态块
src/features/transactions/*                   交易规则、缓存读取、远端写操作、账单 UI
src/features/sync/*                           同步 Provider 和缓存状态提示
src/features/stats/*                          统计范围和统计计算
src/features/ai/*                             Edge Function 调用、候选确认、保存规则
src/features/import/*                         CSV 解析和导入
src/lib/localDb.ts                            Dexie schema
src/lib/supabase.ts                           Supabase browser client
src/routes/*                                  首页、账单、统计、设置
src/styles/globals.css                        PWA 全局样式

supabase/config.toml                          Supabase CLI / Function 配置
supabase/functions/parse-transaction/index.ts AI 解析 Edge Function
supabase/migrations/*                         transactions 表和权限 migration
```

## 4. 当前功能状态

### Auth

- Supabase Auth 邮箱密码登录和注册。
- `AuthProvider` 恢复 session 并监听 auth state。
- 未登录只显示登录/注册页，不显示任何本地缓存。
- 退出登录成功后清理当前用户 Dexie 缓存和 TanStack Query cache。
- 离线时阻止退出登录。

### 本地缓存和同步

- 当前 PWA 使用 Dexie DB `foxledger` version 3。
- Store：`transactions_cache`、`sync_meta`。
- `transactions_cache` 仅缓存展示和统计必要字段，不缓存 `raw_text`、AI 原始响应、token、登录响应、`tag`、`account`、`ai_confidence`。
- 远端全量同步 page size 500，最大 20 页，最多 10000 行。
- 远端分页按 `date asc`、`created_at asc`、`id asc` 稳定排序。
- 任一远端页失败或数据校验失败，本次同步失败，不替换上次缓存。
- 全部远端数据校验 `user_id` 后，才在 Dexie transaction 中替换当前用户缓存。
- `SyncProvider` 负责恢复联网自动同步、同步状态和写成功后的刷新。
- 自动同步已加用户级 guard，避免 query invalidate 后反复触发导致“同步中”卡住。
- 状态文案为“已同步缓存 / 离线缓存 / 同步中 / 同步失败，显示上次缓存”。

### 账单

- 账单页读取当前用户 Dexie 缓存。
- 支持搜索商家/备注/分类。
- 搜索输入只更新草稿，点击“搜索”或按回车后才应用筛选，避免逐字刷新。
- 支持类型、分类、开始日期、结束日期筛选。
- 支持日期倒序/正序、金额倒序/正序。
- 支持加载更多，当前 page size 30。
- 支持编辑、单条删除和当前已加载账单多选删除。
- 离线时隐藏或禁用写操作。
- 从统计页 drilldown 到账单页时，会通过 URL search 应用筛选并重置分页、多选和管理态。

### 首页

- 显示本月支出、收入、结余。
- 手动记账入口在首页展开表单。
- 手动记账写入 Supabase 后重新同步 Dexie，并刷新 transactions/stats/monthlySummary。
- AI 文本记账入口在首页。

### AI

- PWA 前端通过 `src/features/ai/parseTransactionApi.ts` 调用 Supabase Edge Function。
- 请求地址：`${SUPABASE_URL}/functions/v1/parse-transaction`。
- 请求携带当前 Supabase access token 和 publishable key。
- Edge Function 使用 Supabase publishable/anon key 验证 access token，不使用 `service_role`。
- Edge Function 读取 `ALLOWED_EMAILS` 做邮箱白名单。
- Edge Function 调用 `OPENAI_BASE_URL`，可继续使用个人 VPS 的 OpenAI-compatible 转发地址。
- AI 请求只发送当前输入文本，不发送历史账单、统计或本地缓存。
- AI 候选支持编辑、选择/取消选择、删除和确认保存。
- AI 候选保存前再次经过本地交易规则校验和归一。
- 用户确认后才写入 Supabase。
- 离线时禁用 AI 解析和 AI 候选保存。

### CSV

- 设置页包含 CSV 导入。
- 前端解析 CSV，预览合法行和错误行。
- 必须在线才能确认导入。
- 只做追加新增，不覆盖、不合并、不自动去重。
- 导入成功后重新同步 Dexie 并刷新账单和统计。

### 统计

- 统计基于当前用户 Dexie 缓存计算，不调用 AI。
- 支持本周、本月、上月、今年和自定义日期范围。
- 自定义日期使用 `type=date` 输入并校验非空、`YYYY-MM-DD` 和开始日期不晚于结束日期。
- 展示总支出、总收入、结余、交易笔数、日均支出、最大支出、分类排行、每日趋势。
- 每日趋势使用轻量条形展示，不引入大型图表库。
- 统计项可 drilldown 到账单页。

### PWA

- `vite-plugin-pwa` 生成 `dist/sw.js` 和 manifest。
- 旧手写 `public/sw.js` 已删除。
- Workbox 不缓存 Supabase 请求、登录响应、AI API 响应或用户数据响应。

## 5. 环境变量

PWA 前端：

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
- `OPENAI_API_KEY` 不进入 PWA 前端。
- Edge Function 自动有 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`；如需使用 Supabase publishable key，也可额外设置 `SUPABASE_PUBLISHABLE_KEY`。
- 不要提交真实值。

## 6. 安全边界

必须继续保持：

- 不提交 `.env`、`.env.local` 或任何真实密钥。
- 不使用 Supabase `service_role` key。
- 不绕过 Supabase RLS。
- 不改 Supabase schema，除非用户明确要求。
- 不允许前端传入任意 `user_id` 决定操作对象。
- IndexedDB 读取必须限制当前 `userId`。
- 未登录时不显示任何缓存。
- AI 只解析当前输入文本。
- AI 不读取历史账单、统计数据或本地缓存。
- AI 不直接写数据库。
- AI 不做统计。
- Service Worker 不缓存 Supabase 用户数据、登录响应或 API 响应。
- 离线时不允许正式写操作。

## 7. Edge Function 部署

本仓库已包含：

```text
supabase/config.toml
supabase/functions/parse-transaction/index.ts
```

部署步骤：

```bash
npm install supabase --save-dev
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set AI_PROVIDER=openai
npx supabase secrets set OPENAI_API_KEY=<your-api-key>
npx supabase secrets set OPENAI_BASE_URL=<your-openai-compatible-base-url>
npx supabase secrets set OPENAI_MODEL=<your-model>
npx supabase secrets set ALLOWED_EMAILS=<allowed-email-list>
npx supabase functions deploy parse-transaction
```

部署函数也可以使用仓库脚本：

```bash
npm run functions:deploy
```

`supabase/config.toml` 里 `parse-transaction` 的 `verify_jwt = false` 是为了 CORS preflight 和自定义中文错误响应；函数内部仍校验 Supabase access token。

## 8. 当前限制

- 没有离线写入队列。
- 没有 AI 查账。
- 没有自定义分类、账户或支付方式管理。
- 没有多币种和汇率。
- CSV 导入不去重。
- 没有 E2E 测试。
- Vite build 当前有单 chunk 超过 500kB 的提示，不影响构建；后续可做路由级代码分割。

## 9. 本地运行和检查

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

预览生产构建：

```bash
npm run preview
```

## 10. 下一阶段建议

优先建议：

- 实际部署并验收 Supabase Edge Function AI 解析。
- 增加最小 E2E 或关键纯函数测试。
- 对 Vite bundle 做路由级代码分割。
- 在真实移动端验收 PWA 安装、离线缓存和恢复联网同步。

## 11. 新对话启动 Prompt

```text
请先阅读 Web/PWA 仓库文档：

D:\fox\foxledger
- README.md
- AGENTS.md
- PROJECT_HANDOFF.md

当前 FoxLedger Web/PWA 是 v2.3 Vite PWA + Supabase Edge AI API 版：
- React + Vite + TypeScript
- TanStack Router
- TanStack Query
- Supabase Auth + Supabase Postgres + RLS
- Supabase Edge Function parse-transaction
- Dexie / IndexedDB 离线只读缓存
- 手动记账、账单管理、统计、CSV 导入
- AI 解析只接收当前输入文本，用户确认后才入库
- vite-plugin-pwa / Workbox 应用外壳缓存

请严格遵守：
- 不提交 .env 或任何密钥
- 不使用 service_role key
- 不绕过 RLS
- 不改 Supabase schema，除非我明确要求
- 不把历史账单、统计数据、本地缓存发给 AI
- AI 结果必须用户确认后才入库
- 本次只处理 Web/PWA 仓库，不修改 App 仓库

下一阶段请先根据当前代码和文档给出计划，不要直接实现。
```
