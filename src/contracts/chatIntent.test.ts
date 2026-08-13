import { describe, expect, it, vi } from "vitest";

import {
  ChatIntentContractError,
  buildFoxChatIntentPrompt,
  parseFoxChatIntentResult,
  runFoxChatFirstStage,
  validateFoxChatRequestBody,
} from "@shared/chatIntent";
import { InputValidationError } from "@shared/transactionSanitizer";

const today = "2026-08-13";

function createQueryPlan() {
  return {
    answer_goal: "comparison",
    operations: [
      {
        compareRange: {
          endDate: "2026-07-31",
          label: "上月",
          startDate: "2026-07-01",
        },
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
        range: {
          endDate: "2026-08-13",
          label: "本月截至今天",
          startDate: "2026-08-01",
        },
      },
    ],
  };
}

describe("fox-chat M3 请求契约", () => {
  it("只接受当前文本、严格查询上下文和两个强制意图", () => {
    const previousContext = {
      date_anchor: today,
      intent: "query_ledger",
      plan: createQueryPlan(),
    };

    expect(
      validateFoxChatRequestBody({
        forced_intent: "query_ledger",
        previous_context: previousContext,
        text: "本月餐饮花了多少？",
      }),
    ).toEqual({
      forced_intent: "query_ledger",
      previous_context: previousContext,
      text: "本月餐饮花了多少？",
    });
  });

  it("拒绝未知字段、任意 user_id、非法强制意图和夹带历史内容的上下文", () => {
    expect(() =>
      validateFoxChatRequestBody({ text: "本月支出", user_id: "user-2" }),
    ).toThrow(InputValidationError);
    expect(() =>
      validateFoxChatRequestBody({ forced_intent: "delete", text: "午饭 32" }),
    ).toThrow(/forced_intent/);
    expect(() =>
      validateFoxChatRequestBody({
        previous_context: { old_message: "历史账单" },
        text: "那上个月呢？",
      }),
    ).toThrow(/previous_context/);
    expect(() =>
      validateFoxChatRequestBody({
        previous_context: {
          date_anchor: today,
          intent: "query_ledger",
          plan: createQueryPlan(),
          stats: { expense: 999 },
        },
        text: "那上个月呢？",
      }),
    ).toThrow(/未知字段/);
  });
});

describe("fox-chat 四类严格意图", () => {
  it("记账意图复用服务端交易清洗，不信任模型金额", () => {
    const result = parseFoxChatIntentResult({
      aiValue: {
        intent: "record_transaction",
        transactions: [
          {
            ai_confidence: 0.8,
            amount: 99,
            category: "餐饮",
            raw_text: "午饭 32",
            type: "expense",
          },
        ],
      },
      rawText: "午饭 32",
      todayIsoDate: today,
    });

    expect(result.intent).toBe("record_transaction");
    if (result.intent === "record_transaction") {
      expect(result.ledger_result.transactions[0]).toMatchObject({
        amount: null,
        needs_clarification: true,
        raw_text: "午饭 32",
        type: null,
      });
    }
  });

  it("问账意图只接受 normalized query plan，拒绝 SQL 和未知字段", () => {
    expect(
      parseFoxChatIntentResult({
        aiValue: { intent: "query_ledger", plan: createQueryPlan() },
        rawText: "这个月餐饮比上月多多少？",
        todayIsoDate: today,
      }),
    ).toEqual({ intent: "query_ledger", plan: createQueryPlan() });

    expect(() =>
      parseFoxChatIntentResult({
        aiValue: {
          intent: "query_ledger",
          plan: { ...createQueryPlan(), sql: "delete from transactions" },
        },
        rawText: "查账",
        todayIsoDate: today,
      }),
    ).toThrow(/未知字段/);
  });

  it("澄清和不支持只接受确定性白名单 key", () => {
    expect(
      parseFoxChatIntentResult({
        aiValue: { clarification_key: "intent_ambiguous", intent: "clarify" },
        rawText: "看看",
        todayIsoDate: today,
      }),
    ).toEqual({ clarification_key: "intent_ambiguous", intent: "clarify" });
    expect(
      parseFoxChatIntentResult({
        aiValue: { intent: "unsupported", reason_key: "general_chat" },
        rawText: "讲个故事",
        todayIsoDate: today,
      }),
    ).toEqual({ intent: "unsupported", reason_key: "general_chat" });
    expect(() =>
      parseFoxChatIntentResult({
        aiValue: { intent: "unsupported", reason_key: "model_free_text" },
        rawText: "讲个故事",
        todayIsoDate: today,
      }),
    ).toThrow(ChatIntentContractError);
  });

  it("拒绝混合 union 字段和未遵守的强制意图", () => {
    expect(() =>
      parseFoxChatIntentResult({
        aiValue: {
          intent: "clarify",
          clarification_key: "intent_ambiguous",
          reason_key: "general_chat",
        },
        rawText: "看看",
        todayIsoDate: today,
      }),
    ).toThrow(/未知字段/);
    expect(() =>
      parseFoxChatIntentResult({
        aiValue: { intent: "query_ledger", plan: createQueryPlan() },
        forcedIntent: "record_transaction",
        rawText: "午饭 32",
        todayIsoDate: today,
      }),
    ).toThrow("未遵守强制意图");
  });
});

describe("fox-chat 第一次 AI 编排", () => {
  it("只调用一次 AI，强制意图进入 system prompt，且用户消息只有当前文本、日期和空上下文", async () => {
    const requestAi = vi.fn().mockResolvedValue(
      JSON.stringify({ intent: "query_ledger", plan: createQueryPlan() }),
    );
    const result = await runFoxChatFirstStage({
      body: {
        forced_intent: "query_ledger",
        text: "这个月餐饮比上月多多少？",
      },
      requestAi,
      todayIsoDate: today,
    });

    expect(result.intent).toBe("query_ledger");
    expect(requestAi).toHaveBeenCalledOnce();
    const messages = requestAi.mock.calls[0][0];
    expect(messages[0].content).toContain("MUST return intent=query_ledger");
    expect(messages[0].content).toContain("Never output SQL");
    expect(JSON.parse(messages[1].content)).toEqual({
      previous_context: null,
      text: "这个月餐饮比上月多多少？",
      today,
    });
    expect(messages[1].content).not.toContain("history");
  });

  it("连续追问只向第一次 AI 提供归一化计划与日期锚点", async () => {
    const previousContext = {
      date_anchor: today,
      intent: "query_ledger" as const,
      plan: createQueryPlan(),
    };
    const requestAi = vi.fn().mockResolvedValue(
      JSON.stringify({ intent: "query_ledger", plan: createQueryPlan() }),
    );

    await runFoxChatFirstStage({
      body: { previous_context: previousContext, text: "那上个月呢？" },
      requestAi,
      todayIsoDate: today,
    });

    const userPayload = JSON.parse(requestAi.mock.calls[0][0][1].content);
    expect(userPayload).toEqual({
      previous_context: previousContext,
      text: "那上个月呢？",
      today,
    });
    expect(userPayload).not.toHaveProperty("messages");
    expect(userPayload).not.toHaveProperty("stats");
    expect(userPayload).not.toHaveProperty("aiDetails");
  });

  it("prompt 明确四类边界，不提供数据库写工具", () => {
    const messages = buildFoxChatIntentPrompt(
      { previous_context: null, text: "午饭 32" },
      today,
    );

    expect(messages[0].content).toContain("record_transaction");
    expect(messages[0].content).toContain("query_ledger");
    expect(messages[0].content).toContain("clarify");
    expect(messages[0].content).toContain("unsupported");
    expect(messages[0].content).toContain("never write, update, or delete ledger data");
    expect(messages[0].content).toContain('"startDate":"YYYY-MM-DD"');
    expect(messages[0].content).toContain("never return compareRange:null");
    expect(messages[0].content).toContain(
      "Every operation MUST contain range, filters, metrics, groupBy, and order",
    );
  });
});
