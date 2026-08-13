import type { Page } from "@playwright/test";

export const TEST_USER_EMAIL = "m5-browser@example.com";
export const TEST_USER_ID = "11111111-2222-4333-8444-555555555555";

const issuedAt = Math.floor(Date.now() / 1000);

function toBase64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const accessToken = [
  toBase64Url({ alg: "HS256", typ: "JWT" }),
  toBase64Url({
    aud: "authenticated",
    email: TEST_USER_EMAIL,
    exp: issuedAt + 3600,
    iat: issuedAt,
    role: "authenticated",
    sub: TEST_USER_ID,
  }),
  "m5-browser-signature",
].join(".");

const user = {
  app_metadata: { provider: "email", providers: ["email"] },
  aud: "authenticated",
  confirmed_at: "2026-08-13T00:00:00.000Z",
  created_at: "2026-08-13T00:00:00.000Z",
  email: TEST_USER_EMAIL,
  email_confirmed_at: "2026-08-13T00:00:00.000Z",
  id: TEST_USER_ID,
  identities: [],
  is_anonymous: false,
  last_sign_in_at: "2026-08-13T00:00:00.000Z",
  phone: "",
  role: "authenticated",
  updated_at: "2026-08-13T00:00:00.000Z",
  user_metadata: {},
};

const transactions = [
  createTransaction({
    amount: 32,
    category: "餐饮",
    date: "2026-08-13",
    id: "aaaaaaaa-1111-4111-8111-111111111111",
    merchant: "小狐餐厅",
    type: "expense",
  }),
  createTransaction({
    amount: 6,
    category: "交通",
    date: "2026-08-13",
    id: "bbbbbbbb-2222-4222-8222-222222222222",
    merchant: "地铁",
    type: "expense",
  }),
  createTransaction({
    amount: 100,
    category: "收入",
    date: "2026-08-12",
    id: "cccccccc-3333-4333-8333-333333333333",
    merchant: "测试收入",
    type: "income",
  }),
];

function createTransaction(input: {
  amount: number;
  category: string;
  date: string;
  id: string;
  merchant: string;
  type: "expense" | "income";
}) {
  return {
    ai_batch_id: null,
    amount: input.amount,
    category: input.category,
    created_at: `${input.date}T08:00:00.000Z`,
    currency: "CNY",
    date: input.date,
    id: input.id,
    merchant: input.merchant,
    note: null,
    payment_method: null,
    source: "manual",
    type: input.type,
    updated_at: `${input.date}T08:00:00.000Z`,
    user_id: TEST_USER_ID,
  };
}

function createQueryResponse() {
  const range = {
    endDate: "2026-08-31",
    label: "本月餐饮",
    startDate: "2026-08-01",
  };
  const plan = {
    answer_goal: "summary",
    operations: [
      {
        filters: {
          categories: ["餐饮"],
          keyword: null,
          maxAmount: null,
          merchants: [],
          minAmount: null,
          types: ["expense"],
        },
        groupBy: ["category"],
        metrics: ["expense"],
        order: "amount_desc",
        range,
      },
    ],
  };

  return {
    answer: {
      evidenceRefs: ["operations.0.aiDetails.0"],
      metricRefs: ["operations.0.stats.summary.expense"],
      suggestion: "可以打开依据核对商家。",
      text: "本月餐饮支出 ¥32.00。",
    },
    answer_error: null,
    answer_status: "ready",
    context: { date_anchor: "2026-08-13", intent: "query_ledger", plan },
    intent: "query_ledger",
    operations: [
      {
        aiDetailCount: 1,
        aiDetails: [
          {
            amount: 32,
            category: "餐饮",
            date: "2026-08-13",
            merchant: "小狐餐厅",
            type: "expense",
          },
        ],
        aiDetailsTruncated: false,
        matchedTransactionCount: 1,
        stats: {
          averageDailyExpense: 1.03,
          categorySpend: [{ amount: 32, category: "餐饮" }],
          dailySpend: [{ amount: 32, date: "2026-08-13" }],
          merchantSpend: [{ amount: 32, count: 1, merchant: "小狐餐厅" }],
          maxExpenseAmount: 32,
          range,
          summary: { balance: -32, expense: 32, income: 0 },
          transactionCount: 1,
          typeBreakdown: [{ amount: 32, count: 1, type: "expense" }],
        },
      },
    ],
    plan,
  };
}

export async function installSupabaseMocks(page: Page) {
  const foxChatRequests: Array<Record<string, unknown>> = [];

  await page.route("**/auth/v1/token**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        access_token: accessToken,
        expires_at: issuedAt + 3600,
        expires_in: 3600,
        refresh_token: "m5-browser-refresh-token",
        token_type: "bearer",
        user,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route("**/auth/v1/logout**", async (route) => {
    await route.fulfill({ status: 204 });
  });

  await page.route("**/rest/v1/transactions**", async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({
        body: JSON.stringify(transactions),
        contentType: "application/json",
        headers: {
          "Content-Range": `0-${transactions.length - 1}/${transactions.length}`,
        },
        status: 200,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify([]),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route("**/functions/v1/fox-chat", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    foxChatRequests.push(body);
    await route.fulfill({
      body: JSON.stringify(createQueryResponse()),
      contentType: "application/json",
      status: 200,
    });
  });

  return { foxChatRequests };
}

export async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("邮箱").fill(TEST_USER_EMAIL);
  await page.getByLabel("密码").fill("m5-browser-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByText("已同步缓存", { exact: true }).waitFor();
}
