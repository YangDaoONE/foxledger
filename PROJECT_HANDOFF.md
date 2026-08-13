# PROJECT_HANDOFF.md

本文件用于把 FoxLedger Web/PWA 当前状态交接给下一轮 ChatGPT / Codex 对话。新对话开始前，必须先阅读 `AGENTS.md`、`README.md`、本文件和 `docs/V3.0_EXECUTABLE_DESIGN.md`。

本仓库只维护 `D:\fox\foxledger` Web/PWA、Supabase migrations 和 Supabase Edge Function，不包含平级 App 仓库进度。

## 1. 当前状态

当前代码与生产验收基线为 **V3.0 狐狐对话记账版**：M0–M5 的代码、自动化检查、Vercel 生产部署、服务器产物核对和真机 PWA 更新验收均已于 2026-08-13 通过，V3.0 已正式收口。

V3.1 M0–M3 已完成验收并分别保存为提交 `2b1b165`、`c1ebd33`、`af0120a`、`5c73dd4`，以上已推送到 `origin/main`。`fox-chat` 已部署用于受控验收。当前工作区已完成 M4 本地实现和自动化检查，等待用户验收；V3.1 静态前端尚未发布，M5 未开始，生产站点前端仍以 V3.0 为准。

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

### 2.1 V3.1 M0 本地实现

- `supabase/functions/_shared/ledgerAnalytics.ts` 提供前端与未来 Edge 共用的环境无关正式统计，覆盖收支、结余、交易数、日均、最大支出、分类、每日趋势、商家和类型分组。
- `supabase/functions/_shared/ledgerContracts.ts` 提供严格 query plan、stats envelope 和 grounded answer 类型与运行时解析，拒绝未知字段、非法日期、未知分类、非有限数字和矛盾金额范围。
- 现有 `statsCalculator.ts` 变为薄包装，保留 V3.0 统计页 summary、百分比和 drilldown 行为。
- 新增共享统计、前端/Edge 正式数字一致性、契约和 drilldown 回归测试。
- 未新增 `fox-chat`、Supabase 查询、AI 调用、环境变量或 schema 变更；没有把历史账单、统计或 Dexie 发给 AI。

### 2.2 V3.1 M1 本地实现

- `edgeEnv.ts` 统一读取 Edge secrets；只接受 `SUPABASE_PUBLISHABLE_KEY` 或兼容 anon key，不读取 `service_role`。
- `auth.ts` 统一 bearer token、Supabase Auth 用户验证、`ALLOWED_EMAILS` 和携带当前用户 JWT 的 Supabase client。
- `aiClient.ts` 统一 OpenAI-compatible 配置、超时、JSON 请求和上游错误语义；现有 `parse-transaction` 已切换到公共认证与 AI client，解析提示和业务清洗规则保持不变。
- `ledgerRead.ts` 对每一页使用 `id,user_id,date,type,amount,category,merchant` 字段白名单、显式 `.eq("user_id", verifiedUserId)` 和 `date + id` 稳定排序。
- 全部分页与全部操作成功后才返回结果；任一页错误、重复行、跨用户行或日期/类型/金额/商家等关键字段非法都整体失败，不生成部分统计。历史未知、空或带首尾空格的分类按既有业务规则安全归一为 `其他`，避免无关旧分类阻断整个日期范围。
- query plan 筛选完全由代码执行；正式统计覆盖全部匹配行，AI 安全明细只有 `date/type/amount/category/merchant`，最多 500 条，并以确定性金额极值和时间代表性选择。
- M1 批次本身未新增 `fox-chat` 入口、AI 问账调用、数据库写操作、schema、环境变量或 service role；`fox-chat` 第一阶段已在后续独立 M2 批次实现。

### 2.3 V3.1 M2 本地实现

- 新增 `fox-chat` Edge Function 第一阶段，并在 `supabase/config.toml` 配置自处理 CORS/JWT；函数内部继续验证 bearer token 和 `ALLOWED_EMAILS`。
- `transactionSanitizer.ts` 抽取 V3.0 当前输入、敏感长数字、金额来源、日期、分类、50 条上限和 AI JSON 清洗；`parse-transaction` 与 `fox-chat` 共同复用，现有解析规则保持。
- `chatIntent.ts` 严格解析四类 discriminated union：`record_transaction`、`query_ledger`、`clarify`、`unsupported`；拒绝混合字段、未知 key 和任意模型文案。
- 问账只生成并通过代码校验 normalized query plan，不执行 M1 数据读取、不进行第二次 AI，也不生成自然回答。
- 请求只允许当前 `text`、可空 `previous_context` 和可选 `forced_intent`；M2 明确拒绝非空历史上下文，强制意图只允许“记账”或“问账”。
- `fox-chat` 没有数据库写路径、SQL、service role 或自由工具；M2 独立批次结束时 PWA 尚未调用它，后续 M3 已完成本地接入，但函数仍未部署。

### 2.4 V3.1 M3 本地实现

- `foxChatFlow.ts` 在 `query_ledger` 分支完整执行 M1 RLS 查询，然后才调用第二次 AI；任何分页或行失败都不生成部分统计。
- `groundedLedgerAnswer.ts` 构造完整统计包及最多 500 条 `date/type/amount/category/merchant` 明细；数据库字符串明确标记为不可信数据。
- 第二次 AI 只能返回严格 `answerTemplate/metricRefs/evidenceRefs/suggestion`；服务端验证所有引用存在、模板声明完全一致且没有未引用数字，再用代码格式化值替换占位符。第二次 AI 失败时只降级自然解释，完整统计卡仍可显示。
- 连续追问只保存并回传服务端校验过的 `{ intent, date_anchor, plan }`；不包含旧消息、旧回答、统计或明细，且只存在 React 内存，换用户、退出、关闭或刷新即清空。
- 本地 PWA 已切换至 `fox-chat`，支持四类意图、强制记账/问账纠错、问账统计卡、代码渲染依据及经过白名单映射的账单页筛选跳转。
- 设置页已公开问账数据用途；不读取或上传 Dexie，不新增写路径、数据库 schema、密钥或 service role。M3 已完成自动化和受控人工验收，`fox-chat` 已部署，V3.1 前端尚未发布。

### 2.5 V3.1 M4 本地实现

- `globals.css` 已收口品牌、财务语义、间距、圆角、边框、阴影和字号 token；品牌橙独立于支出红，收入、结余和转账继续使用各自语义色。
- 新增共享 `PageIntro`、`MetricCard`，扩展 `SectionBlock`；登录、首页、账单、统计、设置及狐狐现有界面统一为奶油底色、品牌橙和一致的卡片/按钮/输入/状态/弹层语言。
- 同步状态条继续保留四类核心状态，并增加当前缓存行数、最近成功时间、具体失败原因和失败时手动重试；设置页也展示最近同步时间。
- 增加可见 focus、`aria-live`、`aria-busy`、reduced-motion、Safe Area 和移动端状态条布局；PWA theme/background color 与新视觉 token 同步。
- 未修改同步算法、交易 API、统计口径、数据库 schema、RLS、AI 写入确认或数据发送边界；M4 已通过 33 个测试文件、156 项测试及 `lint`、`typecheck`、`build`、`verify:v3`，等待用户验收，尚未提交或发布。

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
src/features/stats/statsDrilldown.ts          统计页 drilldown 纯参数契约
src/features/ai/aiBatchSave.ts               固定 batch/transaction IDs
src/features/transactions/transactionsApi.ts RLS 下显式用户约束、写入协调、编辑删除
src/features/transactions/transactionSync.ts 全量分页同步
src/features/sync/SyncProvider.tsx            同步状态、写后刷新和查询失效
src/lib/localDb.ts                            Dexie v4
src/routes/ChatPage.tsx                       狐狐页面编排
src/styles/globals.css                        Chat、移动端、Safe Area、reduced-motion
vite.config.ts                                PWA manifest 与 Workbox 缓存边界
scripts/verify-v3-build.mjs                   Chat chunk、角色资源、manifest、SW 验证
supabase/functions/_shared/ledgerAnalytics.ts V3.1 共享正式统计规则
supabase/functions/_shared/ledgerContracts.ts V3.1 严格数据契约
supabase/functions/_shared/edgeEnv.ts          Edge secrets 读取
supabase/functions/_shared/auth.ts             JWT、白名单和用户级 Supabase client
supabase/functions/_shared/aiClient.ts         OpenAI-compatible 公共 client
supabase/functions/_shared/ledgerRead.ts       RLS 完整分页与安全统计封装
supabase/functions/_shared/transactionSanitizer.ts V3.0/V3.1 共用交易清洗
supabase/functions/_shared/chatIntent.ts       第一次 AI 严格意图与计划
supabase/functions/_shared/groundedLedgerAnswer.ts 第二次 AI 与 metric/evidence refs
supabase/functions/_shared/foxChatFlow.ts      只读问账完整编排
supabase/functions/fox-chat/index.ts           M2–M3 Edge 入口（已部署验收）
supabase/migrations/003_add_ai_batch_id.sql   V3.0 最小 schema
supabase/migrations/004_restrict_transactions_permissions.sql 权限收口
```

## 5. 安全边界

必须继续保持：

- 不提交 `.env`、`.env.local` 或真实密钥。
- 不使用 `service_role`，不绕过 RLS。
- 所有远端读取、更新、删除继续显式约束当前 `user_id`。
- 记账 AI 只接收当前输入文本；问账第一阶段只接收当前问题和经过校验的 normalized plan 上下文。
- 问账第二阶段只接收当前用户云端查询的完整代码统计与最多 500 条五字段相关明细；绝不接收 Dexie、旧消息、旧回答或禁止字段。
- AI 不直接写库、不修改账单、不生成正式统计；用户确认后才由交易 API 写入，问账 metric 值由服务端代码替换。
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

M5 已由用户完成以下人工确认：

- 真机 PWA 的软键盘、Safe Area、滚动和焦点。
- 已安装 PWA 获取新 Service Worker 后的更新与离线应用壳。
- 生产部署后的登录、白名单、解析、确认保存、最近批次和撤销回归。
- 生产网络请求中 Supabase/Auth/AI 响应未进入 Cache Storage。

V3.1 M0–M4 当前完整自动化结果：`lint`、`typecheck`、`build`、`verify:v3` 通过；33 个测试文件、156 项测试通过。M3 覆盖 grounded 数字、伪造引用拒绝、prompt injection 数据边界、跨 operation 合计 500 条上限、完整查询/第二次 AI 降级、读取失败无部分统计、历史分类安全归一、normalized context、依据卡和筛选跳转回归；M4 增加共享表现组件、财务语义色、同步四态/诊断/重试和设计契约回归。M0–M3 已完成人工验收，M4 等待用户验收。

部署回退必须保留 Dexie v4 schema；不能直接回退到只认识 v3 的旧构建。已经远端成功的账单不能因回退或同步错误重复写入。

## 8. 后续边界

V3.1 M0–M3 已完成验收并推送；M4 已完成本地实现和自动化检查，等待用户验收；`fox-chat` 已部署用于验收。只有用户明确说“开始 V3.1 M5”后才能进行浏览器、真机和发布验收。

语音、OCR、图片、多模态和原生 App 能力不在当前 Web/PWA 范围。

## 9. 新对话启动 Prompt

```text
请先阅读 D:\fox\foxledger 的 README.md、AGENTS.md、PROJECT_HANDOFF.md、docs/V3.0_EXECUTABLE_DESIGN.md 和 docs/V3.1_EXECUTABLE_DESIGN.md。

当前生产验收基线为 FoxLedger Web/PWA V3.0 狐狐对话记账版；V3.1 M0–M3 已完成验收并推送，M4 已完成本地实现和自动化检查、等待验收，`fox-chat` 已部署用于验收，V3.1 静态前端尚未发布，M5 未实施。

严格保持：不提交密钥、不使用 service_role、不绕过 RLS；记账只发送当前输入，问账只发送当前用户云端相关代码统计与最多 500 条五字段明细，绝不发送 Dexie 或禁止字段；用户确认后才写库，新 AI 不持久化 raw_text，只处理 Web/PWA 仓库。

不要提前实现 V3.1 M5，也不要把尚未部署或尚未验收的功能写成生产现状。
```
