import { describe, expect, it } from "vitest";

import {
  InputValidationError,
  MAX_PARSED_TRANSACTIONS,
  parseAiJson,
  sanitizeParsedTransactionsBatch,
  validateAiTextRequestBody,
} from "@shared/transactionSanitizer";

function createAiTransaction(overrides: Record<string, unknown> = {}) {
  return {
    account: null,
    ai_confidence: 0.9,
    amount: 32,
    category: "餐饮",
    currency: "CNY",
    date: "2026-08-13",
    merchant: "小狐餐厅",
    needs_clarification: false,
    note: null,
    payment_method: null,
    raw_text: "午饭 32",
    source: "ai",
    tag: null,
    type: "expense",
    ...overrides,
  };
}

describe("V3.0/V3.1 共用交易清洗", () => {
  it("金额必须来自当前原文，并按本地文本日期和默认分类规则归一化", () => {
    const result = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({
            amount: -32,
            category: "不存在分类",
            date: "2099-01-01",
            raw_text: "昨天午饭 -32",
          }),
        ],
      },
      "昨天午饭 -32",
      "2026-08-13",
    );

    expect(result.transactions[0]).toEqual({
      account: null,
      ai_confidence: 0.9,
      amount: 32,
      category: "其他",
      currency: "CNY",
      date: "2026-08-12",
      merchant: "小狐餐厅",
      needs_clarification: false,
      note: null,
      payment_method: null,
      raw_text: "昨天午饭 -32",
      source: "ai",
      tag: null,
      type: "expense",
    });
  });

  it("AI 编造金额或 raw_text 时回退原文并强制用户补充", () => {
    const result = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({
            amount: 99,
            raw_text: "AI 编造的片段",
          }),
        ],
      },
      "午饭 32",
      "2026-08-13",
    );

    expect(result.transactions[0]).toMatchObject({
      ai_confidence: null,
      amount: null,
      category: "其他",
      needs_clarification: true,
      raw_text: "午饭 32",
      type: null,
    });
  });

  it("继续执行 50 条上限并标记截断", () => {
    const transactions = Array.from({ length: MAX_PARSED_TRANSACTIONS + 1 }, () =>
      createAiTransaction(),
    );
    const result = sanitizeParsedTransactionsBatch(
      { transactions },
      "午饭 32",
      "2026-08-13",
    );

    expect(result.transactions).toHaveLength(50);
    expect(result.truncated).toBe(true);
    expect(result.max_transactions).toBe(50);
  });

  it("请求继续拒绝空文本、超长文本和敏感长数字", () => {
    expect(() => validateAiTextRequestBody({ text: " " })).toThrow(InputValidationError);
    expect(() => validateAiTextRequestBody({ text: "a".repeat(3001) })).toThrow(
      "不能超过 3000",
    );
    expect(() => validateAiTextRequestBody({ text: "卡号 6222 0000 0000 0000" })).toThrow(
      "疑似银行卡号或身份证号",
    );
  });

  it("只解析有效 JSON，并兼容模型的 JSON code block", () => {
    expect(parseAiJson('```json\n{"transactions":[]}\n```')).toEqual({
      transactions: [],
    });
    expect(() => parseAiJson("not json")).toThrow("AI 返回内容不是有效 JSON");
  });
});
