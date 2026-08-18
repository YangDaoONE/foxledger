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

  it("识别交易片段开头的紧凑月日，并按唯一金额找回候选所属原文", () => {
    const result = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({
            amount: 76,
            date: "2026-08-18",
            raw_text: "吃饭花了76",
          }),
          createAiTransaction({
            amount: 52,
            date: "2026-08-18",
            raw_text: "吃饭花了52",
          }),
        ],
      },
      "7.6吃饭花了76；7.8吃饭花了52",
      "2026-08-18",
    );

    expect(result.transactions.map(({ amount, date, raw_text }) => ({
      amount,
      date,
      raw_text,
    }))).toEqual([
      { amount: 76, date: "2026-07-06", raw_text: "7.6吃饭花了76" },
      { amount: 52, date: "2026-07-08", raw_text: "7.8吃饭花了52" },
    ]);
  });

  it("明确日期作用域下把单个紧凑小数识别为金额", () => {
    const result = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({
            amount: null,
            date: "2026-07-06",
            needs_clarification: true,
            raw_text: "7.6吃饭",
          }),
          createAiTransaction({
            amount: null,
            category: "交通",
            date: "2026-08-04",
            merchant: "地铁",
            needs_clarification: true,
            raw_text: "8.4坐地铁",
          }),
        ],
      },
      "今天，7.6吃饭，8.4坐地铁",
      "2026-08-18",
    );

    expect(result.transactions.map(({ amount, date, needs_clarification }) => ({
      amount,
      date,
      needs_clarification,
    }))).toEqual([
      { amount: 7.6, date: "2026-08-18", needs_clarification: false },
      { amount: 8.4, date: "2026-08-18", needs_clarification: false },
    ]);
  });

  it("支持斜杠、短横线和带号的明确月日写法", () => {
    const result = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({ amount: 76, raw_text: "7/6吃饭76" }),
          createAiTransaction({
            amount: 52,
            category: "交通",
            raw_text: "7-8坐地铁52",
          }),
          createAiTransaction({ amount: 20, raw_text: "7.9号买菜20" }),
        ],
      },
      "7/6吃饭76；7-8坐地铁52；7.9号买菜20",
      "2026-08-18",
    );

    expect(result.transactions.map((transaction) => transaction.date)).toEqual([
      "2026-07-06",
      "2026-07-08",
      "2026-07-09",
    ]);
    expect(result.transactions.map((transaction) => transaction.amount)).toEqual([
      76,
      52,
      20,
    ]);
  });

  it("单独的紧凑小数和冲突日期保持核对，不静默猜测", () => {
    const ambiguous = sanitizeParsedTransactionsBatch(
      {
        transactions: [createAiTransaction({ amount: 7.6, raw_text: "7.6吃饭" })],
      },
      "7.6吃饭",
      "2026-08-18",
    );
    const conflicting = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({ amount: 76, raw_text: "7.6吃饭花了76" }),
        ],
      },
      "今天，7.6吃饭花了76",
      "2026-08-18",
    );

    expect(ambiguous.transactions[0]).toMatchObject({
      amount: null,
      date: "2026-08-18",
      needs_clarification: true,
      type: null,
    });
    expect(conflicting.transactions[0]).toMatchObject({
      amount: null,
      date: "2026-08-18",
      needs_clarification: true,
      type: null,
    });
  });

  it("相同金额且模型丢失日期片段时保持核对，不按顺序强行配对", () => {
    const result = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({ amount: 76, raw_text: "吃饭花了76" }),
          createAiTransaction({ amount: 76, raw_text: "吃饭花了76" }),
        ],
      },
      "7.6吃饭花了76；7.8吃饭花了76",
      "2026-08-18",
    );

    expect(result.transactions.every((transaction) =>
      transaction.needs_clarification && transaction.amount === null
    )).toBe(true);
  });

  it("不把带货币单位的小数金额误判成月日", () => {
    const result = sanitizeParsedTransactionsBatch(
      {
        transactions: [
          createAiTransaction({
            amount: 7.6,
            date: "2099-01-01",
            raw_text: "7.6元早餐",
          }),
        ],
      },
      "7.6元早餐",
      "2026-08-18",
    );

    expect(result.transactions[0]).toMatchObject({
      amount: 7.6,
      date: "2026-08-18",
      needs_clarification: false,
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
