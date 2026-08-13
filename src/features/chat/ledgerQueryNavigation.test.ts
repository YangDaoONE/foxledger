import { describe, expect, it } from "vitest";

import { createLedgerQueryNavigation } from "@/features/chat/ledgerQueryNavigation";
import type { LedgerQueryOperation } from "@shared/ledgerContracts";

function createOperation(): LedgerQueryOperation {
  return {
    filters: {
      categories: ["餐饮"],
      keyword: null,
      maxAmount: null,
      merchants: ["小狐餐厅"],
      minAmount: null,
      types: ["expense"],
    },
    groupBy: ["category"],
    metrics: ["expense"],
    order: "amount_desc",
    range: {
      endDate: "2026-08-31",
      label: "本月",
      startDate: "2026-08-01",
    },
  };
}

describe("问账到账单页白名单跳转", () => {
  it("单值日期、类型、分类和商家映射到现有筛选", () => {
    const result = createLedgerQueryNavigation(createOperation());

    expect(result.isPartial).toBe(false);
    expect(result.search).toMatchObject({
      category: "餐饮",
      endDate: "2026-08-31",
      search: "小狐餐厅",
      startDate: "2026-08-01",
      type: "expense",
    });
  });

  it("金额或多值筛选不进入路由，并明确标记为部分映射", () => {
    const operation = createOperation();
    operation.filters.categories = ["餐饮", "交通"];
    operation.filters.minAmount = 100;
    const result = createLedgerQueryNavigation(operation);

    expect(result.isPartial).toBe(true);
    expect(result.search.category).toBe("");
    expect(result.search).not.toHaveProperty("minAmount");
  });
});
