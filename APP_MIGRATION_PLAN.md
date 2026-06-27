# APP_MIGRATION_PLAN.md

本文件专门记录 FoxLedger 从 Web/PWA v2.1 收口版迁移到 iOS + Android App v0.x 测试版的技术路线、边界和当前进度。App 项目已在平级目录 `D:\fox\foxledger-app` 创建；除明确标注已完成的阶段外，后续 App 内容仍是计划，不是已实现功能。

## 1. 当前决策

```text
Web/PWA v2.1：稳定维护版
App v0.x：测试版，完整迁移 Web/PWA v2.1 功能并做移动端优化
App v1.0：在迁移稳定后再做新功能
```

Web/PWA 继续保留，作为可用线上版本和后端 API 过渡载体。App v0.x 不应一开始就重写后端、改 schema 或新增复杂功能。

当前 App 仓库 `D:\fox\foxledger-app` 已完成至 v0.7。v0.5 已接入现有 Web/Next AI API，实现文本输入、AI 解析、候选确认和用户保存到 Supabase 的最小闭环；v0.6 已迁移统计页和 drilldown 到账单筛选；v0.7 已完成基础 UI 组件和核心页面移动端体验收口；CSV、SQLite、离线统计、离线写入、AI 查账和 Edge Function 迁移尚未完成。

## 2. 推荐目录策略

建议新建平级仓库，而不是把 Expo 项目放进当前 Next.js 仓库：

```text
D:\fox\
  foxledger\        # 当前 Web/PWA v2.1，已存在
  foxledger-app\    # Expo React Native App v0.x，已创建至 v0.7
```

原因：

- 避免 Expo 依赖、Metro 配置、原生构建产物污染当前 Web/PWA 稳定仓库。
- App v0.x 可以独立试错 UI、路由、本地存储和构建方案。
- 等 App v0.x 跑通后，再决定是否升级为 monorepo。

暂不建议一开始就做：

```text
apps/web
apps/mobile
packages/shared
```

monorepo 可以作为后续选择，不是 App v0.x 第一阶段目标。

## 3. 推荐 App 技术栈

```text
Expo React Native + TypeScript
Expo Router
Supabase JS
TanStack Query
SQLite
FlashList
lucide-react-native 或同类图标库
现有 Next.js /api/parse-transaction 作为 AI API 过渡
```

选择理由：

- 当前 Web 项目已经使用 React + TypeScript，迁移思维和部分纯 TS 规则成本较低。
- Supabase Auth、Postgres 和 RLS 可以继续复用。
- TanStack Query 适合管理远端状态、刷新、重试和同步状态。
- SQLite 比 IndexedDB 更适合 App 本地结构化缓存。
- FlashList 更适合上千到上万条账单列表。
- AI key 必须留在服务端，App 不直接调用 AI provider。

## 4. 可复用模块

适合迁移或复制到 App 项目的模块：

```text
types/transaction.ts
lib/transactionRules.ts
lib/transactionDrafts.ts
lib/validators.ts
lib/csvImport.ts
lib/statsCalculator.ts
lib/parseTransactionLimits.ts
```

复用原则：

- 优先复用纯 TypeScript 业务规则。
- 不要直接复用依赖 DOM、Next.js、IndexedDB、Service Worker 的代码。
- 如果复制代码，必须保持数据规则一致：`amount > 0`、`type` 表示方向、固定 `CNY`、非默认分类归一到 `其他`、`transfer` 不计入收支。

## 5. Web/Next 专属模块

以下内容未来 App 需要重写或替换：

```text
app/*
components/*
app/globals.css
public/sw.js
public/offline.html
lib/localDb.ts
lib/localTransactions.ts
lib/manualDraft.ts
components/ServiceWorkerRegistration.tsx
```

说明：

- React DOM 组件不能直接迁移到 React Native。
- CSS 布局不能直接复用。
- Web IndexedDB 需要替换为 SQLite。
- Service Worker 是 Web/PWA 专属。
- Next Route Handler 初期可作为 AI API 过渡后端，但 App 不应依赖 Next 页面结构。

## 6. 后端与数据库策略

App v0.x 初期继续复用：

```text
Supabase Auth
public.transactions
Supabase RLS
当前 Vercel / Next AI API
```

必须保持：

- 不改 Supabase schema。
- 不新增 `service_role` key。
- 不绕过 RLS。
- App 只使用 publishable key。
- 用户只能读写自己的账单。
- App 不保存或暴露 `OPENAI_API_KEY`。
- AI API 必须验证 Supabase access token。
- AI 解析结果必须用户确认后才写入 Supabase。

后期可评估：

```text
Supabase Edge Functions 替代 Next AI API
自定义分类/账户/支付方式相关新表
离线正式写入队列和同步日志
```

这些都不属于 v0.x 第一阶段。

## 7. App v0.x 阶段规划

### v0.0 技术骨架

状态：已完成。

目标：

- 新建 Expo React Native + TypeScript 项目。
- 配置 Expo Router。
- 配置基础目录结构。
- 配置 Supabase client，但不提交真实环境变量。
- 搭建底部 Tab：首页、账单、统计、设置。

不做：

- 不迁移全部业务。
- 不改 Supabase schema。
- 不接 AI provider key。

### v0.1 Auth

状态：已完成。

目标：

- 邮箱密码登录/注册。
- 登录态恢复。
- 退出登录。
- 当前用户上下文。
- 验证 Supabase RLS：只能访问自己的账单。

### v0.2 账单列表

状态：已完成。

目标：

- 读取当前用户 `transactions`。
- 使用 TanStack Query `useInfiniteQuery` 做分页读取，Hook 内部从 Auth 上下文获取当前 `user.id`，不允许外部传入任意 `user_id`。
- Supabase 查询继续显式 `.eq("user_id", user.id)`，同时依赖 RLS。
- select 字段收窄到列表 UI 需要字段，v0.2 不读取 `raw_text`。
- 排序使用 `date desc`、`created_at desc`、`id desc`。
- v0.2 先用 FlatList 展示账单，FlashList 后续在长列表阶段再引入。
- 支持加载态、错误态、空状态。
- 支持基础分页或加载更多。
- 初步按日期分组。
- 退出登录或切换账号时清理 transactions query cache，避免短暂显示上一个账号数据。

### v0.3 手动记账与编辑删除

状态：已完成。

目标：

- 新增手动账单。
- 编辑账单。
- 单条删除。
- 当前已加载账单多选删除。
- 类型、金额、日期、分类校验与 Web 一致。
- 新增时固定写入 `currency = CNY`、`source = manual` 和当前 `user.id`。
- Hook 内部从 Auth 上下文读取当前 `user.id`，UI 不允许传入任意 `user_id`。
- 更新和删除继续显式 `.eq("user_id", user.id)`，同时依赖 RLS。
- 不读取或写入 `raw_text`，不接 AI provider key。
- 不做离线新增、编辑、删除队列。

### v0.4 搜索筛选排序

状态：已完成。

目标：

- 搜索商户、备注、分类。
- 搜索关键词查询前统一 `trim`，空字符串视为无搜索条件。
- 类型筛选。
- 分类筛选。
- 日期范围筛选。
- 日期/金额排序。
- 筛选结果汇总。
- 查询继续显式 `.eq("user_id", user.id)`，同时依赖 RLS。
- select 字段继续收窄，v0.4 不读取 `raw_text`。
- 使用 TanStack Query queryKey 纳入筛选和排序条件，筛选变化后重置分页。
- 继续使用 FlatList，不引入 FlashList。

### v0.5 AI 解析迁移

状态：已完成。

目标：

- App 调用现有 Web/Next API：

```text
POST /api/parse-transaction
Authorization: Bearer <supabase_access_token>
```

- 复刻 AI 候选确认流程。
- 支持候选编辑、选择、删除。
- 用户确认后写入 Supabase。
- AI API base URL 使用 `EXPO_PUBLIC_AI_API_BASE_URL` 配置，App 不硬编码多处 URL。
- App 调用 AI API 时从当前 Supabase session 获取 `access_token`。
- AI API 返回 `401` 时 refresh session 后重试一次，再失败则提示重新登录。
- Web/Next API 的 AI JSON 解析先严格 `JSON.parse`，失败后只兼容提取 fenced JSON 或第一个完整 JSON object，随后仍走服务端清洗。
- 候选保存前再次经过本地交易规则校验和归一。
- `insert` payload 白名单构造，`user_id` 固定当前用户，`currency = CNY`，`source = ai`。
- `needs_clarification` 或字段非法的候选必须先编辑修正后才能保存。
- `raw_text` 优先保存候选片段，没有则 fallback 为完整输入文本。
- 保存成功后清空 AI 输入和候选列表，并刷新 transactions query。

边界：

- App 不接触 AI provider key。
- AI 不读取历史账单。
- AI 不直接写数据库。
- 不发送统计数据或本地缓存给 AI。
- 不改 Supabase schema，不迁移 AI 后端。
- App 当前还未做 CSV、SQLite、离线统计、离线写入、AI 查账、Edge Function 迁移。

### v0.6 统计页与 drilldown

状态：已完成。

目标：

- 本周、本月、上月、今年、自定义范围。
- 总支出、总收入、结余、笔数、日均支出、最大单笔支出。
- 分类排行。
- 每日趋势。
- 点击统计项跳到账单页并应用筛选。
- 统计 query key 独立为 `['stats', userId, rangeKey]`，交易写入变更后同时刷新 transactions 和 stats。
- 日期范围使用 App 本地日期生成 `YYYY-MM-DD`，自定义日期使用和账单页一致的日历选择控件，并校验非空、格式和开始日期不晚于结束日期。
- 统计读取只选必要字段，固定分页大小、稳定排序，并设置最大读取保护。
- drilldown 到账单页时重置账单页多选状态和旧分页状态。

边界：

- 统计由代码计算。
- 不调用 AI。
- 不做离线统计。

### v0.7 可爱风基础设计系统

状态：已完成。

目标：

- 统一 App 基础颜色、间距、字体层级、按钮、输入框、列表项、空状态和错误态。
- 保持移动端可用性，不改变 Supabase schema。
- 为后续 SQLite 和测试版收口提供稳定视觉基础。
- 新增通用按钮、Chip、输入框、Section、状态块组件。
- 收口 Auth、首页 AI/RLS 面板、账单页、手动表单、统计页和设置页核心控件。

边界：

- 不做大规模业务扩张。
- 不接入 AI 查账。

### v0.8 SQLite 本地缓存与离线只读评估

目标：

- 使用 SQLite 缓存当前用户已同步账单。
- 启动先显示本地缓存。
- 后台同步 Supabase。
- 同步成功后覆盖本地缓存。
- 离线只允许查看。
- 显示“当前为离线数据”和上次同步时间。
- 手动草稿仅保存在本设备。

边界：

- 不做离线正式记账。
- 不做离线写入队列。
- 不做冲突合并。

### v0.9 测试版收口

目标：

- 性能优化。
- 长列表优化。
- 弱网体验。
- 错误提示。
- Android APK 内测包。
- iOS 如需要，走 TestFlight 或开发安装。

## 8. App v0.x 不做的事

- 不做 AI 对话式查账主功能。
- 不做离线正式记账。
- 不做离线新增/编辑/删除队列。
- 不做同步冲突合并。
- 不做自定义分类 schema。
- 不做复杂预算、预测或自动建议。
- 不迁移 AI 后端到 Edge Function，除非用户单独确认。
- 不把 App 计划写成已完成。

## 9. App v1.0 之后候选方向

- 完整可爱风 UI 和动效。
- AI 对话式记账。
- AI 问账单，但必须走后端安全查询工具，不能把所有历史账单直接发给 AI。
- 更复杂统计图表。
- 离线新增/编辑/删除队列。
- 自定义分类、账户、支付方式。
- 导出、备份和重复账单检测。

## 10. 下一轮建议启动 Prompt

```text
请先阅读以下文档：

App 仓库：
D:\fox\foxledger-app
- README.md
- AGENTS.md
- PROJECT_HANDOFF.md

Web 仓库：
D:\fox\foxledger
- APP_MIGRATION_PLAN.md
- PROJECT_HANDOFF.md
- AGENTS.md

当前 FoxLedger App 已完成 v0.7：
- Expo React Native + TypeScript 技术骨架
- Supabase Auth
- 当前用户账单读取
- 手动新增、编辑、删除、多选删除
- 搜索筛选排序
- 调用现有 Web/Next AI API 进行文本账单解析
- AI 候选确认后批量写入 Supabase
- 日期范围统计页、分类排行、每日趋势
- 统计项 drilldown 到账单页筛选
- 基础 UI 组件和核心页面体验收口

请严格遵守：
- 不提交 .env 或任何密钥
- 不使用 service_role key
- 不绕过 RLS
- 不把 AI key 放入 App
- 不把历史账单、统计数据、本地缓存发给 AI
- AI 结果必须用户确认后才入库
- 不改 Supabase schema，除非我明确要求
- npm audit 中 Expo 依赖链 uuid moderate 告警暂不强制修复

下一阶段我想做 App v0.8。请先根据当前代码和文档，给出最合适的 v0.8 计划，不要直接实现。
```
