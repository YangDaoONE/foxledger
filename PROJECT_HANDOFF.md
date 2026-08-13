# PROJECT_HANDOFF.md

本文件用于把 FoxLedger Web/PWA 当前状态交接给下一轮 ChatGPT / Codex 对话。新对话开始前，必须先阅读 `AGENTS.md`、`README.md`、本文件和 `docs/V3.0_EXECUTABLE_DESIGN.md`。

本仓库只维护 `D:\fox\foxledger` Web/PWA、Supabase migrations 和 Supabase Edge Function，不包含平级 App 仓库进度。

## 1. 当前状态

当前代码基线为 **V3.0 狐狐对话记账版**：M0–M5 的代码和自动化检查已于 2026-08-13 完成，提交 `94aeba1` 已完成 Vercel 生产部署，生产首页、`/chat`、manifest、Service Worker 和带哈希静态资源检查通过；真机 PWA 获取新 Service Worker 后的最终更新验收待完成。

生产入口：[https://ledger.foxyang.com/](https://ledger.foxyang.com/)

生产部署必须继续以 GitHub/Vercel 状态和服务器实际产物为准，不能只凭本地 `dist` 推断。

## 2. V3.0 已实现代码

- `/chat` 独立懒加载路由，底部导航为首页、账单、狐狐、统计、设置。
- 首页“和狐狐记一笔”入口；旧 `AiParsePanel` 不再出现在主流程。
- 登录用户级 `ChatSessionProvider`：内部路由切换保留，刷新、关闭、登录失效、换用户或退出后清空。
- 用户消息、thinking、确定性错误、候选摘要、详情、编辑、移除和 `needs_attention` 阻断。
- AI 仍只解析当前输入，不读取历史账单、统计或 Dexie，不增加寒暄模型调用。
- 用户确认后才生成固定 batch UUID 和 transaction UUIDs，并写入 Supabase。
- 写入异常后按当前用户与 batch ID 做只读协调查询；完整集合视为成功，零条可用原 IDs 重试，非零不完整集合禁止自动补写。
- 新 V3.0 AI 账单不持久化 `raw_text`。
- 保存后 `saved` 与 `sync_warning` 分离；远端成功后不得回到 draft，同步重试不得重复插入。
- Dexie v4 缓存 `ai_batch_id`，从当前用户真实缓存重建最近 AI 批次。
- 最近批次支持正式单笔编辑、二次确认删除、删除后重算和整批撤销；离线只读。
- 原创内联 SVG 狐狐 normal、listening、thinking、happy、confused 五种状态及 reduced-motion。
- 移动端 `dvh`、Safe Area、软键盘 Composer 可见性、消息滚动保护、弹层焦点圈定与回归。
- Workbox 显式 NetworkOnly：所有非 GET，以及 Supabase auth/rest/functions/storage 路径；运行时 CacheFirst 只用于同源静态图片。
- Vitest、React Testing Library、fake-indexeddb 和 V3 构建产物验证脚本。

## 3. 数据库与缓存契约

远端仍只有核心表：

```text
public.transactions
```

V3.0 最小 schema 变更：

```text
ai_batch_id uuid null
check: ai_batch_id is null or source = 'ai'
partial index: user_id, ai_batch_id, created_at desc where ai_batch_id is not null
```

相关 migration：

```text
001_create_transactions.sql
002_grant_transactions_permissions.sql
003_add_ai_batch_id.sql
004_restrict_transactions_permissions.sql
```

目标 Supabase 项目已由用户完成 migration、RLS、policy 和权限只读验证。不要重复修改 schema，除非用户明确要求。

Dexie：

```text
name: foxledger
version: 4
stores:
  transactions_cache
  sync_meta
```

`transactions_cache` 增加 `ai_batch_id` 与 `[user_id+ai_batch_id]` 索引；仍不缓存 `raw_text`、AI 原始响应、token、登录响应、`tag`、`account` 或 `ai_confidence`。

## 4. 关键文件

```text
src/app/AppShell.tsx                         登录后 Sync + Chat Provider 生命周期
src/app/router.tsx                           含懒加载 /chat
src/app/queryKeys.ts                         transactions/stats/recent batch 查询键
src/features/chat/                           Chat 状态机、UI、最近批次和保存后管理
src/features/ai/aiBatchSave.ts               固定 batch/transaction IDs
src/features/transactions/transactionsApi.ts RLS 下显式用户约束、写入协调、编辑删除
src/features/transactions/transactionSync.ts 全量分页同步
src/features/sync/SyncProvider.tsx            同步状态、写后刷新和查询失效
src/lib/localDb.ts                            Dexie v4
src/routes/ChatPage.tsx                       狐狐页面编排
src/styles/globals.css                        Chat、移动端、Safe Area、reduced-motion
vite.config.ts                                PWA manifest 与 Workbox 缓存边界
scripts/verify-v3-build.mjs                   Chat chunk、角色资源、manifest、SW 验证
supabase/migrations/003_add_ai_batch_id.sql   V3.0 最小 schema
supabase/migrations/004_restrict_transactions_permissions.sql 权限收口
```

## 5. 安全边界

必须继续保持：

- 不提交 `.env`、`.env.local` 或真实密钥。
- 不使用 `service_role`，不绕过 RLS。
- 所有远端读取、更新、删除继续显式约束当前 `user_id`。
- AI 只接收当前输入文本，不接收历史账单、统计或本地缓存。
- AI 不直接写库、不修改账单、不做统计；用户确认后才由交易 API 写入。
- 当前聊天、draft 和 `raw_text` 不写 localStorage、sessionStorage、IndexedDB 或 Supabase。
- 新 AI 正式账单不提交 `raw_text`。
- 离线禁止解析、新增、编辑、删除、撤销和导入，只允许查看最后一次完整缓存。
- Service Worker 不缓存 Supabase、Auth、AI 或其他用户敏感响应。

## 6. 环境变量

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

Edge Function secrets：

```text
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

`parse-transaction.verify_jwt = false` 仅用于函数自行处理 CORS 和中文错误；函数内部仍必须验证 access token 与邮箱白名单。

## 7. 验证与发布

提交或发布前执行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run verify:v3
```

M0–M4 人工验收已经通过：候选闭环、真实批次保存、编辑、单删、部分删除后撤销剩余行、离线限制、跨路由保留和刷新恢复。

M5 生产发布后仍需完成以下人工确认：

- 真机 PWA 的软键盘、Safe Area、滚动和焦点。
- 已安装 PWA 获取新 Service Worker 后的更新与离线应用壳。
- 生产部署后的登录、白名单、解析、确认保存、最近批次和撤销回归。
- 生产网络请求中 Supabase/Auth/AI 响应未进入 Cache Storage。

部署回退必须保留 Dexie v4 schema；不能直接回退到只认识 v3 的旧构建。已经远端成功的账单不能因回退或同步错误重复写入。

## 8. 后续边界

`docs/V3.1_EXECUTABLE_DESIGN.md` 只是下一阶段设计，当前没有实现 AI 问账、查询计划、连续追问或全站体验统一。只有用户明确说“开始 V3.1”后才能实施，而且仍需按内部批次推进。

语音、OCR、图片、多模态和原生 App 能力不在当前 Web/PWA 范围。

## 9. 新对话启动 Prompt

```text
请先阅读 D:\fox\foxledger 的 README.md、AGENTS.md、PROJECT_HANDOFF.md、docs/V3.0_EXECUTABLE_DESIGN.md 和 docs/V3.1_EXECUTABLE_DESIGN.md。

当前仓库代码基线为 FoxLedger Web/PWA V3.0 狐狐对话记账版；M0–M5 代码、本地检查和 Vercel 生产部署已完成，真机 PWA 获取新 Service Worker 后的最终更新验收待完成。

严格保持：不提交密钥、不使用 service_role、不绕过 RLS、不把历史账单/统计/Dexie 发给 AI、用户确认后才写库、新 AI 不持久化 raw_text、只处理 Web/PWA 仓库。

不要提前实现 V3.1，也不要把尚未部署或尚未验收的功能写成生产现状。
```
