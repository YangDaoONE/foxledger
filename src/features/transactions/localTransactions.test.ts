import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyTransactionFilters,
  listAllCachedTransactions,
  summarizeTransactions,
} from "@/features/transactions/localTransactions";
import type {
  CachedTransaction,
  TransactionFilters,
} from "@/features/transactions/types";
import { FoxLedgerDb } from "@/lib/localDb";

const ledgerId = "33333333-3333-4333-8333-333333333333";
const otherLedgerId = "44444444-4444-4444-8444-444444444444";
const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

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
    ledger_id: ledgerId,
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

describe("账本作用域缓存读取", () => {
  it("复合索引同时隔离当前用户和当前账本", async () => {
    const name = `foxledger-transactions-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const db = new FoxLedgerDb(name);
    await db.open();
    await db.transactions_cache.bulkPut([
      createTransaction({ id: "active-ledger" }),
      createTransaction({ id: "other-ledger", ledger_id: otherLedgerId }),
      createTransaction({ id: "other-user", user_id: "user-2" }),
    ]);

    await expect(
      listAllCachedTransactions("user-1", ledgerId, db),
    ).resolves.toEqual([expect.objectContaining({ id: "active-ledger" })]);

    db.close();
  });
});
