# PROJECT_HANDOFF.md

本文件用于把 FoxLedger Web/PWA 当前状态交接给下一轮 ChatGPT / Codex 对话。新对话开始前，请先阅读 `AGENTS.md`、`README.md` 和本文件。

本文件只描述 `D:\fox\foxledger` Web/PWA 仓库。不要在这里记录 App 仓库版本进度或安装包计划。

## 1. 一句话状态

FoxLedger Web/PWA 当前是 **v2.3.1 Vite PWA + Supabase Edge AI API 收口版**：前端已从旧 Next.js 迁移为 React + Vite + TypeScript，并接入 TanStack Router、TanStack Query、Dexie/IndexedDB 和 vite-plugin-pwa；AI 业务 API 已迁移到 Supabase Edge Function `parse-transaction`。本阶段没有修改 Supabase schema、RLS、AI 安全边界或 App 仓库。

生产入口：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

## 2. 本阶段已完成

- 完成 Web/PWA 技术栈重构：React + Vite + TypeScript。
- 完成 TanStack Router 底部导航：首页、账单、统计、设置。
- 完成 TanStack Query 查询、刷新、同步状态串联。
- 完成 Supabase Auth 登录、注册、session 恢复、退出。
- 完成 Dexie / IndexedDB 离线只读缓存，按 `user_id` 隔离。
- 完成远端账单全量分页同步：page size 500，最多 20 页 / 10000 行，稳定排序，完整校验后替换本地缓存。
- 完成首页本月概览、手动记账、AI 文本记账入口。
- 完成账单搜索、筛选、排序、加载更多、编辑、删除、多选删除。
- 修正账单搜索为点击“搜索”或回车后才应用，避免逐字刷新。
- 修正金额排序为全账单排序，不再只是日内排序。
- 完成统计页：本周、本月、上月、今年、自定义日期、分类排行、每日趋势、drilldown 到账单页。
- 完成 CSV 前端解析、预览、确认导入。
- 迁移 AI 解析到 Supabase Edge Function `parse-transaction`，旧 Next API 不再作为线上依赖。
- 修正 Vercel 配置为 Vite 静态部署，线上已不再寻找 Next.js。
- 修正 Edge Function token 校验、CORS、白名单、AI 超时和候选金额归一。
- 修正 `TransactionForm` 在编辑不同账单时表单初值不刷新的问题。
- 修正 `getCachedSyncMeta` 返回 `null`，避免 TanStack Query 收到 `undefined`。
- 将同步 guard 调整为组件级 ref，避免模块级状态长期压制自动同步。
- 文档已重写为 Web/PWA 专属状态，不混入 App 仓库。

## 3. 当前关键文件

```text
src/main.tsx                                  Vite 前端入口
src/app/router.tsx                            TanStack Router 路由
src/app/AppShell.tsx                          登录后应用壳
src/auth/*                                    Supabase session、登录守卫、登录/注册页
src/components/BottomNav.tsx                  底部导航
src/components/ui/*                           通用 UI 组件
src/features/transactions/*                   交易规则、缓存读取、远端写操作、账单 UI
src/features/sync/*                           同步 Provider 和缓存状态提示
src/features/stats/*                          统计范围和统计计算
src/features/ai/*                             Edge Function 调用、候选确认、保存规则
src/features/import/*                         CSV 解析和导入
src/lib/localDb.ts                            Dexie schema
src/lib/supabase.ts                           Supabase browser client
src/routes/*                                  首页、账单、统计、设置
src/styles/globals.css                        全局样式

supabase/config.toml                          Supabase CLI / Function 配置
supabase/functions/parse-transaction/index.ts AI 解析 Edge Function
supabase/migrations/*                         transactions 表和权限 migration
vercel.json                                   Vite 静态部署配置
```

## 4. 安全边界

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
- AI 候选必须用户确认后才写入 Supabase。
- Service Worker 不缓存 Supabase 用户数据、登录响应或 AI API 响应。
- 离线时不允许正式写操作。

## 5. 环境变量和部署

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
- Edge Function 使用 Supabase publishable/anon key 校验 access token，不使用 `service_role`。
- `supabase/config.toml` 里 `parse-transaction.verify_jwt = false` 是为了 CORS preflight 和自定义中文错误，函数内部仍校验 token。
- Vercel 只托管 Vite 静态前端；AI API 在 Supabase Edge Function。

部署函数：

```bash
npm run functions:deploy
```

## 6. 最近验证结果

最近一轮已验证：

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，仅有 Vite chunk size 提示。
- `npm audit --audit-level=moderate`：0 vulnerabilities。
- `npm run functions:deploy`：Supabase Edge Function `parse-transaction` 部署成功。
- 生产站点 [https://ledger.foxyang.com/](https://ledger.foxyang.com/) 已确认 serving Vite 静态产物。

仍需人工复测：

- 本地 `http://127.0.0.1:5173/` 是否还会长时间显示“同步中 · 正在刷新本地缓存”。
- 真实手机 PWA 安装、离线缓存、恢复联网同步、Service Worker 更新。
- AI 端到端解析和候选保存。

## 7. 已知风险和待办

P0：

- 复测并彻底定位本地同步状态异常。如果仍出现持续“同步中”，优先检查浏览器 Network、IndexedDB `sync_meta`、`SyncProvider` 状态切换和重复 invalidation。
- 做线上和本地 AI 端到端验收，包括允许邮箱、非白名单、未登录、AI 超时、候选确认保存。
- 做真实手机 PWA 验收，确认离线只读和恢复联网同步文案清晰。

P1：

- 增加关键纯函数测试：日期范围、统计口径、账单排序筛选、CSV parser、AI 清洗规则。
- 对 Vite bundle 做路由级代码分割，处理 build chunk size 提示。
- 增强同步状态诊断：最近同步时间、失败原因、手动重试入口。

P2：

- 评估前端交易规则和 Edge Function 交易规则是否值得抽共享模块；如果会增加部署复杂度，就继续保持简单重复并同步维护。
- 继续移动端 UI/UX 细节优化，不引入大型 UI 框架。

## 8. 新对话启动 Prompt

```text
请先阅读 Web/PWA 仓库文档：
D:\fox\foxledger
- README.md
- AGENTS.md
- PROJECT_HANDOFF.md

当前 FoxLedger Web/PWA 是 v2.3.1 Vite PWA + Supabase Edge AI API 收口版：
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
