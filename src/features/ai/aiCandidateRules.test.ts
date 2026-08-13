import { describe, expect, it } from "vitest";

import {
  createConfirmTransactionDraft,
  normalizeAiConfidence,
  validateAiTransactionDraft,
  validateConfirmTransactionDraft,
} from "@/features/ai/aiCandidateRules";
import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
} from "@/features/ai/types";

function createParsedTransaction(
  overrides: Partial<ParsedTransaction> = {},
): ParsedTransaction {
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

describe("AI 候选规则", () => {
  it("从服务端候选创建可编辑草稿，并对缺失值使用安全默认值", () => {
    expect(
      createConfirmTransactionDraft(
        createParsedTransaction({
          amount: null,
          category: "自定义",
          merchant: null,
          type: null,
        }),
      ),
    ).toEqual({
      amount: "",
      category: "其他",
      date: "2026-08-13",
      merchant: "",
      note: "",
      payment_method: "",
      type: "expense",
    });
  });

  it("候选必须具备合法类型、正金额、默认分类和真实日期", () => {
    const invalidDraft = {
      amount: "NaN",
      category: "自定义",
      date: "2026-02-30",
      merchant: "",
      note: "",
      payment_method: "",
      type: "refund",
    } as unknown as ConfirmTransactionDraft;

    expect(validateConfirmTransactionDraft(invalidDraft)).toEqual([
      "账单类型不正确。",
      "金额必须是大于 0 的有效数字。",
      "分类只能选择默认分类。",
      "日期必须是 YYYY-MM-DD。",
    ]);
  });

  it("保存前要求当前输入的解析原文，并只返回清洗后的金额与分类", () => {
    const parsed = createParsedTransaction();
    const draft = createConfirmTransactionDraft(parsed);

    expect(validateAiTransactionDraft(parsed, draft)).toEqual({
      amount: 32,
      category: "餐饮",
    });
    expect(() =>
      validateAiTransactionDraft({ ...parsed, raw_text: "" }, draft),
    ).toThrow("缺少 AI 解析原文，不能保存。");
  });

  it("AI 置信度只接受 0 到 1 之间的有限数字", () => {
    expect(normalizeAiConfidence(0)).toBe(0);
    expect(normalizeAiConfidence(1)).toBe(1);
    expect(normalizeAiConfidence(0.5)).toBe(0.5);
    expect(normalizeAiConfidence(-0.1)).toBeNull();
    expect(normalizeAiConfidence(1.1)).toBeNull();
    expect(normalizeAiConfidence(Number.NaN)).toBeNull();
    expect(normalizeAiConfidence(null)).toBeNull();
  });
});
