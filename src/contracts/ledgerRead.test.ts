import { describe, expect, it, vi } from "vitest";

import type { SupabaseClientFactory } from "@shared/auth";
import type { EdgeEnvReader } from "@shared/edgeEnv";
import {
  executeLedgerQueryPlan,
  LEDGER_READ_PAGE_SIZE,
  LEDGER_READ_SELECT,
  MAX_AI_LEDGER_DETAILS,
  type LedgerReadClient,
  type LedgerReadQuery,
} from "@shared/ledgerRead";

type QuerySnapshot = {
  endDate: string;
  eq: Array<[string, string]>;
  from: number;
  orders: Array<[string, { ascending: boolean }]>;
  select: string;
  startDate: string;
  to: number;
};

type RemoteRow = {
  amount: number;
  category: string;
  date: string;
  id: string;
  merchant: string | null;
  type: "expense" | "income" | "transfer";
  user_id: string;
};

const readEnv: EdgeEnvReader = (name) =>
  ({
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_URL: "https://project.supabase.co",
  })[name] ?? null;

function createPlan(overrides?: Record<string, unknown>) {
  return {
    answer_goal: "summary",
    operations: [
      {
        filters: {
          categories: [],
          keyword: null,
          maxAmount: null,
          merchants: [],
          minAmount: null,
          types: [],
        },
        groupBy: ["category", "merchant", "day", "type"],
        metrics: [
          "count",
          "expense",
          "income",
          "balance",
          "average_daily_expense",
          "max_expense",
        ],
        order: "date_desc",
        range: {
          endDate: "2026-12-31",
          label: "2026 年",
          startDate: "2026-01-01",
        },
        ...overrides,
      },
    ],
  };
}

function createRow(index: number, overrides: Partial<RemoteRow> = {}): RemoteRow {
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 28) + 1).padStart(2, "0");

  return {
    amount: index + 1,
    category: "餐饮",
    date: `2026-${month}-${day}`,
    id: `transaction-${String(index).padStart(4, "0")}`,
    merchant: index % 2 === 0 ? "小狐餐厅" : "另一家",
    type: "expense",
    user_id: "user-1",
    ...overrides,
  };
}

function createFakeClient(
  handler: (request: QuerySnapshot) => Promise<{ data: unknown; error: { message: string } | null }>,
) {
  const requests: QuerySnapshot[] = [];
  const client: LedgerReadClient = {
    from(table) {
      expect(table).toBe("transactions");
      const state: QuerySnapshot = {
        endDate: "",
        eq: [],
        from: 0,
        orders: [],
        select: "",
        startDate: "",
        to: 0,
      };
      const query = {
        eq(column: string, value: string) {
          state.eq.push([column, value]);
          return query;
        },
        gte(column: string, value: string) {
          expect(column).toBe("date");
          state.startDate = value;
          return query;
        },
        lte(column: string, value: string) {
          expect(column).toBe("date");
          state.endDate = value;
          return query;
        },
        order(column: string, options: { ascending: boolean }) {
          state.orders.push([column, options]);
          return query;
        },
        range(from: number, to: number) {
          state.from = from;
          state.to = to;
          return query;
        },
        select(columns: string) {
          state.select = columns;
          return query;
        },
        then(onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) {
          const snapshot = structuredClone(state);
          requests.push(snapshot);
          return handler(snapshot).then(onFulfilled);
        },
      } as unknown as LedgerReadQuery;

      return query;
    },
  };

  return { client, requests };
}

function createFactory(client: LedgerReadClient) {
  return vi.fn(() => client) as unknown as SupabaseClientFactory<LedgerReadClient>;
}

describe("RLS 完整分页读取与统计", () => {
  it("显式约束验证用户、稳定分页读取全部行，并只输出 AI 白名单字段", async () => {
    const rows = Array.from({ length: LEDGER_READ_PAGE_SIZE + 1 }, (_, index) =>
      createRow(index),
    );
    const fake = createFakeClient(async (request) => ({
      data: rows.slice(request.from, request.to + 1),
      error: null,
    }));
    const factory = createFactory(fake.client);
    const result = await executeLedgerQueryPlan({
      accessToken: "user-token",
      createClient: factory,
      plan: createPlan(),
      readEnv,
      verifiedUserId: "user-1",
    });
    const operation = result.operations[0];

    expect(operation.stats.transactionCount).toBe(501);
    expect(operation.stats.summary.expense).toBe(125751);
    expect(operation.stats.merchantSpend).toEqual([
      { amount: 63001, count: 251, merchant: "小狐餐厅" },
      { amount: 62750, count: 250, merchant: "另一家" },
    ]);
    expect(operation.aiDetailCount).toBe(MAX_AI_LEDGER_DETAILS);
    expect(operation.aiDetailsTruncated).toBe(true);
    expect(operation.aiDetails).toHaveLength(500);
    expect(Object.keys(operation.aiDetails[0]).sort()).toEqual([
      "amount",
      "category",
      "date",
      "merchant",
      "type",
    ]);
    expect(fake.requests).toHaveLength(2);

    for (const request of fake.requests) {
      expect(request.select).toBe(LEDGER_READ_SELECT);
      expect(request.eq).toEqual([["user_id", "user-1"]]);
      expect(request.orders).toEqual([
        ["date", { ascending: true }],
        ["id", { ascending: true }],
      ]);
    }

    expect(fake.requests.map(({ from, to }) => [from, to])).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(factory).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "test-publishable-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer user-token" } },
      }),
    );
  });

  it("代码只执行白名单筛选，并基于完整匹配数据聚合", async () => {
    const rows = [
      createRow(0, { amount: 32, merchant: "小狐餐厅" }),
      createRow(1, { amount: 600, merchant: "小狐餐厅" }),
      createRow(2, { amount: 20, category: "交通", merchant: "小狐公交" }),
      createRow(3, { amount: 100, category: "收入", merchant: "公司", type: "income" }),
    ];
    const fake = createFakeClient(async () => ({ data: rows, error: null }));
    const plan = createPlan({
      filters: {
        categories: ["餐饮"],
        keyword: "小狐",
        maxAmount: 100,
        merchants: ["小狐餐厅"],
        minAmount: 10,
        types: ["expense"],
      },
    });
    const result = await executeLedgerQueryPlan({
      accessToken: "user-token",
      createClient: createFactory(fake.client),
      plan,
      readEnv,
      verifiedUserId: "user-1",
    });

    expect(result.operations[0].stats.summary).toEqual({
      balance: -32,
      expense: 32,
      income: 0,
    });
    expect(result.operations[0].matchedTransactionCount).toBe(1);
    expect(result.operations[0].aiDetails).toEqual([
      {
        amount: 32,
        category: "餐饮",
        date: rows[0].date,
        merchant: "小狐餐厅",
        type: "expense",
      },
    ]);
  });

  it("兼容历史未知或空分类，并按现有业务规则归一为其他", async () => {
    const rows = [
      createRow(0, { amount: 32, category: "旧分类" }),
      createRow(1, { amount: 20, category: " 餐饮 " }),
      { ...createRow(2), amount: 8, category: null },
    ];
    const fake = createFakeClient(async () => ({ data: rows, error: null }));
    const result = await executeLedgerQueryPlan({
      accessToken: "user-token",
      createClient: createFactory(fake.client),
      plan: createPlan(),
      readEnv,
      verifiedUserId: "user-1",
    });

    expect(result.operations[0].stats.categorySpend).toEqual([
      { amount: 40, category: "其他" },
      { amount: 20, category: "餐饮" },
    ]);
    expect(result.operations[0].aiDetails.map((detail) => detail.category)).toEqual([
      "其他",
      "餐饮",
      "其他",
    ]);
  });

  it("比较范围分别完整统计，并由代码生成支出变化", async () => {
    const rows = [
      createRow(0, { amount: 150, date: "2026-08-10" }),
      createRow(1, { amount: 100, date: "2026-07-10" }),
    ];
    const fake = createFakeClient(async (request) => ({
      data: rows.filter((row) => row.date >= request.startDate && row.date <= request.endDate),
      error: null,
    }));
    const result = await executeLedgerQueryPlan({
      accessToken: "user-token",
      createClient: createFactory(fake.client),
      plan: createPlan({
        compareRange: {
          endDate: "2026-07-31",
          label: "上月",
          startDate: "2026-07-01",
        },
        range: {
          endDate: "2026-08-31",
          label: "本月",
          startDate: "2026-08-01",
        },
      }),
      readEnv,
      verifiedUserId: "user-1",
    });

    expect(result.operations[0].stats.comparison).toEqual({
      absoluteChange: 50,
      baseRange: {
        endDate: "2026-07-31",
        label: "上月",
        startDate: "2026-07-01",
      },
      percentChange: 50,
    });
    expect(result.operations[0].compareStats?.summary.expense).toBe(100);
    expect(result.operations[0].matchedTransactionCount).toBe(2);
  });
});

describe("完整性失败边界", () => {
  it("任一远端页失败时整体拒绝，不返回第一页的部分统计", async () => {
    const firstPage = Array.from({ length: LEDGER_READ_PAGE_SIZE }, (_, index) =>
      createRow(index),
    );
    const fake = createFakeClient(async (request) =>
      request.from === 0
        ? { data: firstPage, error: null }
        : { data: null, error: { message: "page failed" } },
    );

    await expect(
      executeLedgerQueryPlan({
        accessToken: "user-token",
        createClient: createFactory(fake.client),
        plan: createPlan(),
        readEnv,
        verifiedUserId: "user-1",
      }),
    ).rejects.toThrow("未生成部分统计");
    expect(fake.requests).toHaveLength(2);
  });

  it("拒绝跨用户行、重复行和不符合字段契约的行", async () => {
    for (const rows of [
      [createRow(0, { user_id: "user-2" })],
      [createRow(0), createRow(0)],
      [{ ...createRow(0), amount: Number.NaN }],
    ]) {
      const fake = createFakeClient(async () => ({ data: rows, error: null }));

      await expect(
        executeLedgerQueryPlan({
          accessToken: "user-token",
          createClient: createFactory(fake.client),
          plan: createPlan(),
          readEnv,
          verifiedUserId: "user-1",
        }),
      ).rejects.toThrow("未生成部分统计");
    }
  });

  it("日期、类型、金额和商家等关键字段异常仍整体失败并指出字段", async () => {
    const cases = [
      [{ ...createRow(0), date: "2026-02-30" }, "日期字段"],
      [{ ...createRow(0), type: "unknown" }, "类型字段"],
      [{ ...createRow(0), amount: 0 }, "金额字段"],
      [{ ...createRow(0), merchant: { text: "商家" } }, "商家字段"],
    ] as const;

    for (const [row, field] of cases) {
      const fake = createFakeClient(async () => ({ data: [row], error: null }));

      await expect(
        executeLedgerQueryPlan({
          accessToken: "user-token",
          createClient: createFactory(fake.client),
          plan: createPlan(),
          readEnv,
          verifiedUserId: "user-1",
        }),
      ).rejects.toThrow(field);
    }
  });

  it("0、1、500 条不截断，超过 500 条才截断 AI 明细", async () => {
    for (const count of [0, 1, 500, 501]) {
      const rows = Array.from({ length: count }, (_, index) => createRow(index));
      const fake = createFakeClient(async (request) => ({
        data: rows.slice(request.from, request.to + 1),
        error: null,
      }));
      const result = await executeLedgerQueryPlan({
        accessToken: "user-token",
        createClient: createFactory(fake.client),
        plan: createPlan(),
        readEnv,
        verifiedUserId: "user-1",
      });
      const operation = result.operations[0];

      expect(operation.stats.transactionCount).toBe(count);
      expect(operation.aiDetailCount).toBe(Math.min(count, 500));
      expect(operation.aiDetailsTruncated).toBe(count > 500);
    }
  });
});
