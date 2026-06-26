# APP_MIGRATION_PLAN.md

本文件专门记录 FoxLedger 从 Web/PWA v2.1 收口版迁移到 iOS + Android App v0.x 测试版的技术路线和边界。当前仓库尚未创建 App 项目，本文件中的 App 内容都是计划，不是已实现功能。

## 1. 当前决策

```text
Web/PWA v2.1：稳定维护版
App v0.x：未来测试版，完整迁移 Web/PWA v2.1 功能并做移动端优化
App v1.0：在迁移稳定后再做新功能
```

Web/PWA 继续保留，作为可用线上版本和后端 API 过渡载体。App v0.x 不应一开始就重写后端、改 schema 或新增复杂功能。

## 2. 推荐目录策略

建议新建平级仓库，而不是把 Expo 项目放进当前 Next.js 仓库：

```text
D:\fox\
  foxledger\        # 当前 Web/PWA v2.1，已存在
  foxledger-app\    # 未来 Expo React Native App v0.x，尚未创建
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

目标：

- 邮箱密码登录/注册。
- 登录态恢复。
- 退出登录。
- 当前用户上下文。
- 验证 Supabase RLS：只能访问自己的账单。

### v0.2 账单列表

目标：

- 读取当前用户 `transactions`。
- 用 FlashList 展示账单。
- 支持加载态、错误态、空状态。
- 支持基础分页或加载更多。
- 初步按日期分组。

### v0.3 手动记账与编辑删除

目标：

- 新增手动账单。
- 编辑账单。
- 单条删除。
- 当前已加载账单多选删除。
- 类型、金额、日期、分类校验与 Web 一致。

### v0.4 搜索筛选排序

目标：

- 搜索商户、备注、分类。
- 类型筛选。
- 分类筛选。
- 日期范围筛选。
- 日期/金额排序。
- 筛选结果汇总。

### v0.5 AI 解析迁移

目标：

- App 调用现有 Web/Next API：

```text
POST /api/parse-transaction
Authorization: Bearer <supabase_access_token>
```

- 复刻 AI 候选确认流程。
- 支持候选编辑、选择、删除。
- 用户确认后写入 Supabase。

边界：

- App 不接触 AI provider key。
- AI 不读取历史账单。
- AI 不直接写数据库。

### v0.6 CSV 导入

目标：

- 选择 CSV 文件。
- 复用 CSV 解析规则。
- 展示合法行预览和错误行。
- 确认后写入当前用户账单。

边界：

- 只追加。
- 不覆盖、不合并、不自动去重。

### v0.7 统计页与 drilldown

目标：

- 本周、本月、上月、今年、自定义范围。
- 总支出、总收入、结余、笔数、日均支出、最大单笔支出。
- 分类排行。
- 每日趋势。
- 点击统计项跳到账单页并应用筛选。

边界：

- 统计由代码计算。
- 不调用 AI。

### v0.8 本地缓存与离线只读

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
- 基础可爱风设计系统。
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

## 10. 第一阶段建议启动 Prompt

```text
请先阅读 D:\fox\foxledger 中的 AGENTS.md、README.md、PROJECT_HANDOFF.md 和 APP_MIGRATION_PLAN.md。

当前 Web/PWA v2.1 已收口，接下来要新建平级 Expo React Native App 项目 foxledger-app，目标是 App v0.x 测试版。第一阶段只做技术骨架，不迁移全部业务、不改 Supabase schema、不提交任何密钥。

请先给出 App v0.0 技术骨架计划，等我确认后再实施。
```
