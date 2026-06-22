# AGENTS.md

## 1. 项目定位

本项目是一个自用 AI 记账 App，项目名暂定为 **FoxLedger / 狐狐记账**。

这是一个真实长期自用项目，不是作品集 Demo，也不是商业化 SaaS。

第一优先级：

1. 记账稳定
2. 数据准确
3. 隐私安全
4. 数据可导出
5. 代码简单可维护
6. 手机端好用

核心原则：

- AI 只负责把自然语言解析成结构化账单。
- AI 不能直接入账，必须用户确认后才能保存。
- 统计必须由代码和数据库计算，不能让 AI 计算。
- 数据必须支持 CSV 导出。
- 第一版优先做 PWA，后期再考虑 Capacitor 封装为 iOS / Android App。

## 2. 用户与协作方式

用户是 0 基础开发者。开发时必须遵守：

1. 每次只实现一个小阶段。
2. 不要一次性实现完整 App。
3. 不要引入复杂架构。
4. 不要过度设计。
5. 不要修改与当前任务无关的文件。
6. 每次修改后用中文解释：改了什么、改了哪些文件、如何运行、如何测试。
7. 如果出现报错，优先做最小范围修复，不要大规模重构。

回复和总结使用中文。

代码变量名、数据库字段、文件名和技术名词使用英文。

## 3. 技术栈

第一阶段使用：

- Next.js
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- OpenAI API 或 DeepSeek API
- Recharts
- Vercel
- PWA

后期可使用：

- Capacitor

## 4. MVP 功能范围

第一版必须实现：

1. 用户登录
2. 手动记账
3. AI 对话式记账
4. AI 解析后生成确认卡片
5. 用户确认后入库
6. 账单列表
7. 编辑账单
8. 删除账单
9. 月度收入、支出、结余统计
10. 分类支出统计
11. 每日支出趋势
12. CSV 导出
13. 移动端 PWA 适配

第一版暂时不做：

1. 银行卡同步
2. 微信 / 支付宝自动导入
3. 短信自动读取
4. OCR 发票识别
5. 多人共享账本
6. 投资理财建议
7. 复杂资产负债表
8. 订阅付费
9. 社交功能
10. 商业化多租户系统

不要主动实现超出 MVP 的功能，除非用户明确要求。

## 5. 核心数据表

核心表名：

```text
transactions
```

字段：

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

字段规则：

- `user_id`: 当前 Supabase Auth 用户 id
- `type`: `expense` / `income` / `transfer`
- `amount`: 金额，必须大于 0
- `currency`: 第一版默认 `CNY`
- `category`: 分类
- `tag`: 标签，可选
- `merchant`: 商家，可选
- `payment_method`: 支付方式，可选
- `account`: 账户，可选，第一版可先保留字段
- `date`: 实际消费日期
- `note`: 用户备注
- `raw_text`: AI 记账时的用户原始输入
- `source`: `manual` / `ai`
- `ai_confidence`: AI 解析置信度，可选

默认分类：

```text
餐饮
交通
购物
住房
学习
医疗
娱乐
日用
旅行
订阅
人情
收入
转账
其他
```

如果分类不确定，使用 `其他`。

## 6. AI 解析规则

AI 只解析当前用户输入，不读取历史账单。

示例输入：

```text
今天中午麦当劳花了 38，支付宝
```

期望输出：

```json
{
  "type": "expense",
  "amount": 38,
  "currency": "CNY",
  "category": "餐饮",
  "tag": "午餐",
  "merchant": "麦当劳",
  "payment_method": "支付宝",
  "account": null,
  "date": "2026-06-22",
  "note": "中午麦当劳",
  "raw_text": "今天中午麦当劳花了 38，支付宝",
  "source": "ai",
  "ai_confidence": 0.95,
  "needs_clarification": false
}
```

规则：

1. AI 必须返回严格 JSON。
2. 金额必须来自用户原文，不能编造。
3. 如果没有金额，返回 `needs_clarification: true`。
4. 如果没有日期，默认使用今天。
5. 如果没有支付方式，`payment_method` 为 `null`。
6. 如果没有商家，`merchant` 为 `null`。
7. 如果分类不确定，`category` 为 `其他`。
8. AI 不允许直接写数据库。
9. AI 不允许计算统计。
10. 前端必须显示确认卡片。
11. 用户必须可以修改 AI 解析结果。
12. 用户点击确认后才保存。

## 7. 安全规则

必须遵守：

1. Supabase 必须开启 Row Level Security。
2. 用户只能读取、创建、修改、删除自己的 `transactions`。
3. CSV 只能导出当前用户数据。
4. API Key 只能放在服务端环境变量。
5. 不要把 OpenAI API Key 或 DeepSeek API Key 写进前端。
6. 不要提交 `.env.local`。
7. 不要把 Supabase service role key 放到前端。
8. 不要把银行卡号、身份证号、完整地址等高度敏感信息传给 AI。
9. AI 解析时只发送当前输入句子，不发送全部历史账单。

环境变量示例：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
DEEPSEEK_API_KEY
AI_PROVIDER
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 可以前端使用。
- 旧项目中的 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 属于 legacy anon key，第一版新项目优先使用 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- `OPENAI_API_KEY` 和 `DEEPSEEK_API_KEY` 只能服务端使用。

## 8. 统计和导出规则

统计必须由代码和数据库计算，不调用 AI。

需要支持：

1. 本月总支出
2. 本月总收入
3. 本月结余
4. 分类支出排行
5. 每日支出趋势

CSV 导出至少包含：

```text
date
type
amount
currency
category
tag
merchant
payment_method
account
note
raw_text
source
created_at
updated_at
```

导出必须只包含当前登录用户的数据。

## 9. 开发顺序

请按以下顺序逐步实现，不要跳阶段：

1. 项目骨架
2. Mock UI 页面
3. Supabase Auth
4. `transactions` 表和 RLS
5. 手动记账
6. 账单列表
7. 编辑账单
8. 删除账单
9. AI 解析 API
10. AI 确认卡片
11. 确认后入库
12. 统计页
13. CSV 导出
14. PWA 优化
15. Vercel 部署
16. Capacitor 封装 App

如果用户没有明确要求，不要自动进入下一阶段。

## 10. 编码规则

1. 使用 TypeScript。
2. 保持代码简单、清晰、可读。
3. 不要引入不必要的库。
4. 不要使用复杂状态管理库，除非明确需要。
5. 不要大规模重构项目结构。
6. 不要修改与当前任务无关的文件。
7. 不要删除已有功能。
8. 数据库字段和 TypeScript 类型要保持一致。
9. 表单必须做基础校验。
10. 数据库操作必须处理错误。
11. AI 解析结果必须做服务端校验。
12. 页面优先简单、清晰、可用。

## 11. 推荐文件结构

推荐但不强制：

```text
fox-ledger/
├─ app/
│  ├─ page.tsx
│  ├─ transactions/page.tsx
│  ├─ stats/page.tsx
│  ├─ settings/page.tsx
│  └─ api/
│     ├─ parse-transaction/route.ts
│     ├─ transactions/route.ts
│     └─ export/route.ts
│
├─ components/
│  ├─ ChatInput.tsx
│  ├─ TransactionCard.tsx
│  ├─ ConfirmTransaction.tsx
│  ├─ MonthlySummary.tsx
│  ├─ CategoryChart.tsx
│  └─ BottomNav.tsx
│
├─ lib/
│  ├─ supabase.ts
│  ├─ ai.ts
│  ├─ validators.ts
│  ├─ transactions.ts
│  └─ date.ts
│
├─ types/
│  └─ transaction.ts
│
├─ public/
│  ├─ manifest.json
│  └─ icons/
│
├─ AGENTS.md
├─ README.md
└─ .env.local
```

如果项目已有更简单结构，优先保持简单，不要为了符合此结构而强行重构。

## 12. 每次任务完成后的回复格式

每次修改后，请用中文报告：

1. 本次完成了什么
2. 新增了哪些文件
3. 修改了哪些文件
4. 如何运行
5. 如何测试
6. 是否需要配置环境变量
7. 是否有已知问题
8. 下一步建议

不要只给代码，不解释。

## 13. Git 保存规则

本项目需要使用 Git 和 GitHub 做长期备份。

每次完成一个小阶段或一次明确修改后，必须尽量执行：

1. 查看 `git status`。
2. 暂存本次相关修改。
3. 创建一条清晰的 Git commit。
4. 如果已经配置 GitHub remote，则推送到 GitHub。
5. 在完成回复中说明 commit 信息和是否已 push。

注意：

- 不要把 `.env.local` 提交到 Git。
- 不要提交 API Key、数据库密码、Supabase service role key 等敏感信息。
- 不要把与当前任务无关的文件混进同一个 commit。
- 如果 GitHub 尚未接入，则先做本地 commit，再提示用户完成 remote 配置。

## 14. README 同步规则

每次完成一个阶段、功能、数据库变更、环境变量变更或运行方式变更后，必须检查并同步更新 `README.md`。

README 至少需要保持以下内容准确：

1. 当前项目阶段。
2. 当前已完成的能力。
3. 当前仍未完成或仍是 Mock 的能力。
4. 新增的关键文件或 SQL migration。
5. 本地运行方式。
6. 必要环境变量。

如果本次修改不需要更新 README，也要在完成回复中说明原因。
