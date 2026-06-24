# FoxLedger / 狐狐记账

FoxLedger 是一个基于 Next.js + Supabase 的个人 AI 记账 Web App / PWA 雏形。它面向个人日常记账场景，重点解决“快速记录、确认入库、查看真实账单和统计”的闭环问题。

当前 v1 阶段已经完成从登录、记账、AI 解析、CSV 导入到账单查询和统计的基础闭环。项目仍保持自用工具定位，优先级是数据安全、用户隔离、记账准确性和手机端可用性。

生产地址：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

## 功能列表

- Supabase 邮箱密码登录和会话保护。
- `transactions` 表、RLS 策略和 authenticated 权限授权。
- 手动新增账单。
- 首页本月概览、快速记账入口和最近 5 笔账单。
- 账单编辑和单条删除。
- 账单页搜索、筛选、排序、加载更多和当前已加载账单的多选删除。
- AI 文本账单解析，支持单条和批量候选。
- AI 解析结果必须经用户确认后批量写入数据库。
- AI 候选支持编辑、取消选择和删除候选。
- CSV 导入、预览、错误行提示和确认导入。
- 统计页支持本周、本月、上月、今年和自定义日期范围。
- 统计展示总支出、总收入、结余、交易笔数、日均支出、最大单笔支出、分类支出排行和每日支出趋势。
- 基础 PWA metadata、manifest 和图标路由。
- Vercel 部署。
- AI API 邮箱白名单。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- OpenAI-compatible Chat Completions API
- Vercel
- lucide-react
- ESLint

## 数据安全与权限

- 项目不使用 Supabase `service_role` key。
- 前端只使用 Supabase publishable key。
- `.env.local` 不提交到 Git。
- 业务数据存储在 `public.transactions`。
- `transactions.user_id` 绑定 Supabase Auth 用户 id。
- RLS 已开启，用户只能 select/insert/update/delete 自己的账单。
- 前端查询、更新、删除也显式加 `user_id` 条件。
- AI API 只解析当前输入文本，不读取历史账单，不直接写数据库。
- AI 解析结果必须经过服务端校验、前端确认和用户保存。
- 统计只由代码和数据库查询计算，不调用 AI。

## 数据规则

核心表：`public.transactions`

字段摘要：

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

主要规则：

- `type` 只能是 `expense`、`income`、`transfer`。
- `amount` 入库为正数。
- 支出和收入方向由 `type` 表示，不使用负数入库。
- 当前固定货币为 `CNY`。
- 默认分类为：`餐饮`、`交通`、`购物`、`住房`、`学习`、`医疗`、`娱乐`、`日用`、`旅行`、`订阅`、`人情`、`收入`、`转账`、`其他`。
- 当前版本不做自定义分类管理。AI 和 CSV 的非默认分类会归一到 `其他`。
- `source` 只能是 `manual` 或 `ai`。
- `ai_confidence` 可以为空，不为空时在 0 到 1 之间。

## 环境变量

本地 `.env.local` 和 Vercel Project Settings 需要配置以下变量。不要提交真实值。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
AI_PROVIDER
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
ALLOWED_EMAILS
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Supabase publishable key。
- `AI_PROVIDER`：当前代码仅支持 `openai`。
- `OPENAI_API_KEY`：OpenAI-compatible provider API key，仅服务端使用。
- `OPENAI_BASE_URL`：OpenAI-compatible API base URL，可为空使用默认 OpenAI URL。
- `OPENAI_MODEL`：解析账单使用的模型名。
- `ALLOWED_EMAILS`：允许使用 AI 解析接口的邮箱白名单，逗号分隔。

## 本地开发

安装依赖：

```bash
npm install
```

配置本地环境变量：

手动创建 `.env.local` 并填入上面的变量名和本地值。不要提交 `.env.local`。

启动开发服务：

```bash
npm run dev
```

基础检查：

```bash
npm run lint
npm run build
```

## Supabase 初始化

当前 migration 文件：

```text
supabase/migrations/001_create_transactions.sql
supabase/migrations/002_grant_transactions_permissions.sql
```

`001_create_transactions.sql` 创建 `transactions` 表、约束、索引、RLS policy 和 `updated_at` trigger。  
`002_grant_transactions_permissions.sql` 授权 authenticated 角色访问 `transactions`。

如果出现 `permission denied for table transactions`，优先检查 `002_grant_transactions_permissions.sql` 是否已经在 Supabase SQL Editor 执行。

## 部署

当前部署平台：Vercel。

Production URL：[https://foxledger.vercel.app](https://foxledger.vercel.app/)

部署注意事项：

- Vercel 连接 GitHub `main` 分支。
- 环境变量在 Vercel Project Settings 配置。
- 修改环境变量后需要 redeploy。
- 排查环境变量问题时，redeploy 建议不要使用旧 Build Cache。
- Supabase Auth URL Configuration 需要配置生产地址和 Vercel preview redirect URLs。
- 不要把 `.env.local`、API key、Supabase key 或数据库密码提交到 GitHub。

## 当前限制

- 当前是个人 Web/PWA 雏形，不是多用户商业产品。
- 没有预算、预测、自动建议或 AI 消费分析。
- 没有自定义分类、账户、支付方式管理。
- 没有 service worker、离线记账、离线同步或 push notification。
- 没有 Capacitor App 封装。
- CSV 导入只做追加新增，不做覆盖、合并或自动去重。
- 账单删除当前支持单条删除和当前已加载可见账单的多选删除，不支持按日期范围删除或删除全部账单。
- 首页仍显示最近账单模块，下一阶段可考虑删除以减少首页长度。
- 手动记账表单字段较多，移动端滑动距离偏长，下一阶段可考虑分步填写或折叠商家、支付方式、备注等可选字段。
- 统计页的分类排行和趋势目前是静态条形展示，暂不支持点击跳转到账单筛选结果或切换图表类型。
- 当前没有自动化测试脚本，提交前主要依赖 `npm run lint` 和 `npm run build`。
