import { describe, expect, it, vi } from "vitest";

import type { SupabaseClientFactory } from "@shared/auth";
import type { EdgeEnvReader } from "@shared/edgeEnv";
import { runFoxChatFlow } from "@shared/foxChatFlow";
import type { LedgerReadClient, LedgerReadQuery } from "@shared/ledgerRead";

const today = "2026-08-13";
const readEnv: EdgeEnvReader = (name) =>
  ({
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_URL: "https://project.supabase.co",
  })[name] ?? null;

function createPlan() {
  return {
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
        metrics: ["expense", "count"],
        order: "amount_desc",
        range: {
          endDate: "2026-08-31",
          label: "本月",
          startDate: "2026-08-01",
        },
      },
    ],
  };
}

function createClientFactory(options?: { failRead?: boolean }) {
  const client: LedgerReadClient = {
    from() {
      const query = {
        eq() {
          return query;
        },
        gte() {
          return query;
        },
        lte() {
          return query;
        },
        order() {
          return query;
        },
        range() {
          return query;
        },
        select() {
          return query;
        },
        then(onFulfilled: (value: unknown) => unknown) {
          return Promise.resolve(
            options?.failRead
              ? { data: null, error: { message: "RLS read failed" } }
              : {
                  data: [
                    {
                      amount: 32,
                      category: "餐饮",
                      date: today,
                      id: "transaction-1",
                      merchant: "小狐餐厅",
                      type: "expense",
                      user_id: "user-1",
                    },
                  ],
                  error: null,
                },
          ).then(onFulfilled);
        },
      } as unknown as LedgerReadQuery;

      return query;
    },
  };

  return vi.fn(() => client) as unknown as SupabaseClientFactory<LedgerReadClient>;
}

describe("fox-chat M3 完整只读编排", () => {
  it("查询计划完整执行后才调用第二次 AI，并返回结构化内存上下文", async () => {
    const requestAi = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ intent: "query_ledger", plan: createPlan() }))
      .mockResolvedValueOnce(
        JSON.stringify({
          answerTemplate:
            "本月餐饮支出 {{metric:operations.0.stats.summary.expense}}，共 {{metric:operations.0.stats.transactionCount}} 笔。",
          evidenceRefs: ["operations.0.aiDetails.0"],
          metricRefs: [
            "operations.0.stats.summary.expense",
            "operations.0.stats.transactionCount",
          ],
          suggestion: null,
        }),
      );
    const result = await runFoxChatFlow({
      accessToken: "user-token",
      body: { previous_context: null, text: "本月餐饮花了多少？" },
      createClient: createClientFactory(),
      readEnv,
      requestAi,
      todayIsoDate: today,
      verifiedUserId: "user-1",
    });

    expect(requestAi).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      answer: { text: "本月餐饮支出 ¥32.00，共 1 笔。" },
      answer_status: "ready",
      context: { date_anchor: today, intent: "query_ledger", plan: createPlan() },
      intent: "query_ledger",
    });
    const secondPayload = JSON.parse(requestAi.mock.calls[1][0][1].content);
    expect(secondPayload.queryResult.operations[0].stats.summary.expense).toBe(32);
    expect(secondPayload.queryResult.operations[0].aiDetails[0]).toEqual({
      amount: 32,
      category: "餐饮",
      date: today,
      merchant: "小狐餐厅",
      type: "expense",
    });
  });

  it("第二次 AI 或 grounded 校验失败时保留完整代码统计并明确降级", async () => {
    const requestAi = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ intent: "query_ledger", plan: createPlan() }))
      .mockRejectedValueOnce(new Error("AI timeout"));
    const result = await runFoxChatFlow({
      accessToken: "user-token",
      body: { text: "本月餐饮花了多少？" },
      createClient: createClientFactory(),
      readEnv,
      requestAi,
      todayIsoDate: today,
      verifiedUserId: "user-1",
    });

    expect(result).toMatchObject({
      answer: null,
      answer_error: "统计已完成，但自然语言解释暂不可用。",
      answer_status: "unavailable",
      intent: "query_ledger",
      operations: [{ stats: { summary: { expense: 32 } } }],
    });
  });

  it("账本读取失败时整体报错，不调用第二次 AI 或返回部分统计", async () => {
    const requestAi = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ intent: "query_ledger", plan: createPlan() }));

    await expect(
      runFoxChatFlow({
        accessToken: "user-token",
        body: { text: "本月餐饮花了多少？" },
        createClient: createClientFactory({ failRead: true }),
        readEnv,
        requestAi,
        todayIsoDate: today,
        verifiedUserId: "user-1",
      }),
    ).rejects.toThrow("未生成部分统计");
    expect(requestAi).toHaveBeenCalledOnce();
  });
});
