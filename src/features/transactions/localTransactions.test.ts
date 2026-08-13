import { describe, expect, it } from "vitest";

import {
  applyTransactionFilters,
  summarizeTransactions,
} from "@/features/transactions/localTransactions";
import type {
  CachedTransaction,
  TransactionFilters,
} from "@/features/transactions/types";

function createTransaction(
  overrides: Partial<CachedTransaction> & Pick<CachedTransaction, "id">,
): CachedTransaction {
  return {
    ai_batch_id: null,
    amount: 1,
    cache_key: `user-1:${overrides.id}`,
    category: "其他",
    created_at: "2026-08-01T00:00:00.000Z",
    currency: "CNY",
    date: "2026-08-01",
    merchant: null,
    note: null,
    payment_method: null,
    source: "manual",
    type: "expense",
    updated_at: "2026-08-01T00:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  };
}

const baseFilters: TransactionFilters = {
  category: "",
  endDate: "",
  search: "",
  sort: "date-desc",
  startDate: "",
  type: "",
};

describe("账单筛选、排序和汇总", () => {
  const rows = [
    createTransaction({
      amount: 20,
      category: "餐饮",
      date: "2026-08-02",
      id: "expense-lunch",
      merchant: "小狐餐厅",
    }),
    createTransaction({
      amount: 100,
      category: "收入",
      date: "2026-08-01",
      id: "income-salary",
      note: "八月工资",
      type: "income",
    }),
    createTransaction({
      amount: 50,
      category: "转账",
      date: "2026-08-03",
      id: "transfer-card",
      type: "transfer",
    }),
  ];

  it("组合应用用户可见筛选，并对搜索忽略大小写和首尾空格", () => {
    expect(
      applyTransactionFilters(rows, {
        ...baseFilters,
        category: "餐饮",
        endDate: "2026-08-02",
        search: " 小狐 ",
        startDate: "2026-08-02",
        type: "expense",
      }).map((row) => row.id),
    ).toEqual(["expense-lunch"]);
  });

  it("金额排序覆盖全部账单，而不是只在同一天内排序", () => {
    expect(
      applyTransactionFilters(rows, { ...baseFilters, sort: "amount-desc" }).map(
        (row) => row.id,
      ),
    ).toEqual(["income-salary", "transfer-card", "expense-lunch"]);
  });

  it("汇总使用金额绝对值，转账只计数量不计收支", () => {
    const summary = summarizeTransactions([
      { ...rows[0], amount: -20 },
      { ...rows[1], amount: -100 },
      rows[2],
    ]);

    expect(summary).toEqual({ count: 3, expense: 20, income: 100 });
  });
});
