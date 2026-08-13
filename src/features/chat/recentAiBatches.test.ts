import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
  getRecentAiBatch,
  groupRecentAiBatches,
  listRecentAiBatches,
  paginateRecentAiBatches,
} from "@/features/chat/recentAiBatches";
import type { CachedTransaction } from "@/features/transactions/types";
import { FoxLedgerDb } from "@/lib/localDb";

const batchOne = "11111111-1111-4111-8111-111111111111";
const batchTwo = "22222222-2222-4222-8222-222222222222";
const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((databaseName) => Dexie.delete(databaseName)));
});

function createTransaction(
  overrides: Partial<CachedTransaction> & Pick<CachedTransaction, "id">,
): CachedTransaction {
  return {
    ai_batch_id: batchOne,
    amount: 1,
    cache_key: `user-1:${overrides.id}`,
    category: "其他",
    created_at: "2026-08-13T01:00:00.000Z",
    currency: "CNY",
    date: "2026-08-13",
    merchant: null,
    note: null,
    payment_method: null,
    source: "ai",
    type: "expense",
    updated_at: "2026-08-13T01:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  };
}

describe("最近 AI 批次计算", () => {
  const rows = [
    createTransaction({
      amount: 30,
      created_at: "2026-08-13T02:00:00.000Z",
      id: "batch-one-income",
      type: "income",
    }),
    createTransaction({
      amount: -10,
      created_at: "2026-08-13T01:00:00.000Z",
      id: "batch-one-expense",
    }),
    createTransaction({
      amount: 99,
      created_at: "2026-08-13T03:00:00.000Z",
      id: "batch-one-transfer",
      type: "transfer",
    }),
    createTransaction({
      ai_batch_id: batchTwo,
      amount: 8,
      created_at: "2026-08-13T04:00:00.000Z",
      id: "batch-two-expense",
    }),
    createTransaction({ ai_batch_id: null, id: "manual-row", source: "manual" }),
    createTransaction({ id: "other-user-row", user_id: "user-2" }),
  ];

  it("只分组当前用户 AI 行，并按组内最新时间倒序", () => {
    const batches = groupRecentAiBatches(rows, "user-1");

    expect(batches.map((batch) => batch.batchId)).toEqual([batchTwo, batchOne]);
    expect(batches[1]).toMatchObject({
      balance: 20,
      batchCreatedAt: "2026-08-13T01:00:00.000Z",
      expense: 10,
      income: 30,
      latestCreatedAt: "2026-08-13T03:00:00.000Z",
      transactionCount: 3,
    });
    expect(batches[1].transactions.map((transaction) => transaction.id)).toEqual([
      "batch-one-expense",
      "batch-one-income",
      "batch-one-transfer",
    ]);
  });

  it("按批次分页并正确报告是否还有更多", () => {
    const batches = groupRecentAiBatches(rows, "user-1");

    expect(paginateRecentAiBatches(batches, 0, 1)).toMatchObject({
      hasMore: true,
      totalCount: 2,
    });
    expect(paginateRecentAiBatches(batches, 1, 1)).toMatchObject({
      hasMore: false,
      totalCount: 2,
    });
  });

  it("默认只返回最近 20 个批次，并允许继续加载", () => {
    const manyBatches = groupRecentAiBatches(
      Array.from({ length: 21 }, (_, index) =>
        createTransaction({
          ai_batch_id: `batch-${String(index).padStart(2, "0")}`,
          created_at: `2026-08-13T01:00:${String(index).padStart(2, "0")}.000Z`,
          id: `transaction-${index}`,
        }),
      ),
      "user-1",
    );
    const firstPage = paginateRecentAiBatches(manyBatches);

    expect(firstPage.batches).toHaveLength(20);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.totalCount).toBe(21);
  });

  it("删除单笔后的批次结果由剩余真实行重新计算", () => {
    const batchRows = rows.filter((row) => row.ai_batch_id === batchOne);
    const beforeDelete = groupRecentAiBatches(batchRows, "user-1")[0];
    const afterDelete = groupRecentAiBatches(
      batchRows.filter((row) => row.id !== "batch-one-income"),
      "user-1",
    )[0];

    expect(beforeDelete).toMatchObject({ balance: 20, transactionCount: 3 });
    expect(afterDelete).toMatchObject({
      balance: -10,
      expense: 10,
      income: 0,
      transactionCount: 2,
    });
  });
});

describe("Dexie AI 批次读取", () => {
  it("通过当前用户复合索引读取列表和单批详情", async () => {
    const databaseName = `foxledger-batches-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const db = new FoxLedgerDb(databaseName);
    await db.open();
    await db.transactions_cache.bulkPut([
      createTransaction({ id: "batch-one" }),
      createTransaction({ ai_batch_id: batchTwo, id: "batch-two" }),
      createTransaction({ ai_batch_id: null, id: "manual-row", source: "manual" }),
      createTransaction({ id: "other-user-row", user_id: "user-2" }),
    ]);

    const page = await listRecentAiBatches({ userId: "user-1" }, db);
    const detail = await getRecentAiBatch("user-1", batchOne, db);

    expect(page.totalCount).toBe(2);
    expect(page.batches.flatMap((batch) => batch.transactions)).toHaveLength(2);
    expect(detail?.transactions.map((transaction) => transaction.id)).toEqual([
      "batch-one",
    ]);
    await expect(getRecentAiBatch("user-2", batchTwo, db)).resolves.toBeNull();

    db.close();
  });
});
