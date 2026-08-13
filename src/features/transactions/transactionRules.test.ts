import { describe, expect, it } from "vitest";

import {
  DEFAULT_CATEGORY,
  DEFAULT_CURRENCY,
  defaultCategories,
  getTransactionTypeLabel,
  isDefaultCategory,
  isTransactionType,
  normalizeDefaultCategory,
  toNullableText,
  validateTransactionDraft,
} from "@/features/transactions/transactionRules";

describe("交易规则", () => {
  it("冻结交易类型、固定货币和默认分类集合", () => {
    expect(DEFAULT_CURRENCY).toBe("CNY");
    expect(DEFAULT_CATEGORY).toBe("其他");
    expect(defaultCategories).toEqual([
      "餐饮",
      "交通",
      "购物",
      "住房",
      "学习",
      "医疗",
      "娱乐",
      "日用",
      "旅行",
      "订阅",
      "人情",
      "收入",
      "转账",
      "其他",
    ]);
    expect(["expense", "income", "transfer"].every(isTransactionType)).toBe(true);
    expect(isTransactionType("refund")).toBe(false);
    expect(getTransactionTypeLabel("expense")).toBe("支出");
    expect(getTransactionTypeLabel("income")).toBe("收入");
    expect(getTransactionTypeLabel("transfer")).toBe("转账");
  });

  it("只保留默认分类，并把空文本转为 null", () => {
    expect(isDefaultCategory(" 餐饮 ")).toBe(true);
    expect(normalizeDefaultCategory(" 餐饮 ")).toBe("餐饮");
    expect(normalizeDefaultCategory("自定义分类")).toBe("其他");
    expect(normalizeDefaultCategory(null)).toBe("其他");
    expect(toNullableText("  商家  ")).toBe("商家");
    expect(toNullableText("  ")).toBeNull();
  });

  it("接受合法草稿，并同时报告非法草稿的全部问题", () => {
    expect(
      validateTransactionDraft({
        amount: "12.50",
        category: "餐饮",
        date: "2026-08-13",
        type: "expense",
      }),
    ).toEqual([]);

    expect(
      validateTransactionDraft({
        amount: "0",
        category: "自定义",
        date: "2026-02-30",
        type: "refund",
      }),
    ).toEqual([
      "请选择正确的账单类型。",
      "金额必须是大于 0 的有效数字。",
      "请选择默认分类。",
      "日期必须是 YYYY-MM-DD。",
    ]);
  });
});
