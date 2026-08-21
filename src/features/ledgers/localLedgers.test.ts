import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
  listCachedLedgerSummaries,
  listCachedLedgersForUser,
  replaceCachedLedgerDataForUser,
} from "@/features/ledgers/localLedgers";
import type { CachedLedger } from "@/features/ledgers/types";
import type { CachedTransaction } from "@/features/transactions/types";
import { FoxLedgerDb } from "@/lib/localDb";

const ledgerOneId = "33333333-3333-4333-8333-333333333333";
const ledgerTwoId = "44444444-4444-4444-8444-444444444444";
const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

function createLedger(
  userId: string,
  id: string,
  name: string,
): CachedLedger {
  return {
    cache_key: `${userId}:${id}`,
    created_at: id === ledgerOneId
      ? "2026-08-22T01:00:00.000Z"
      : "2026-08-22T02:00:00.000Z",
    id,
    name,
    updated_at: "2026-08-22T02:00:00.000Z",
    user_id: userId,
  };
}

function createTransaction(
  userId: string,
  id: string,
  ledgerId: string,
): CachedTransaction {
  return {
    ai_batch_id: null,
    amount: 10,
    cache_key: `${userId}:${id}`,
    category: "餐饮",
    created_at: "2026-08-22T02:00:00.000Z",
    currency: "CNY",
    date: "2026-08-22",
    id,
    ledger_id: ledgerId,
    merchant: null,
    note: null,
    payment_method: null,
    source: "manual",
    type: "expense",
    updated_at: "2026-08-22T02:00:00.000Z",
    user_id: userId,
  };
}

describe("账本与账单原子缓存", () => {
  it("只替换当前用户，并按账本统计各自账单", async () => {
    const name = `foxledger-ledgers-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const db = new FoxLedgerDb(name);
    await db.open();
    const otherLedger = createLedger("user-2", ledgerOneId, "他人账本");
    const otherTransaction = createTransaction(
      "user-2",
      "other-transaction",
      ledgerOneId,
    );
    await db.ledgers_cache.put(otherLedger);
    await db.transactions_cache.put(otherTransaction);

    const ledgers = [
      createLedger("user-1", ledgerOneId, "默认账本"),
      createLedger("user-1", ledgerTwoId, "旅行账本"),
    ];
    const transactions = [
      createTransaction("user-1", "transaction-1", ledgerOneId),
      createTransaction("user-1", "transaction-2", ledgerTwoId),
      createTransaction("user-1", "transaction-3", ledgerTwoId),
    ];

    const meta = await replaceCachedLedgerDataForUser(
      { ledgers, transactions, userId: "user-1" },
      db,
    );

    expect(meta.row_count).toBe(3);
    await expect(listCachedLedgersForUser("user-1", db)).resolves.toEqual(ledgers);
    await expect(listCachedLedgerSummaries("user-1", db)).resolves.toEqual([
      { ...ledgers[0], transactionCount: 1 },
      { ...ledgers[1], transactionCount: 2 },
    ]);
    await expect(listCachedLedgersForUser("user-2", db)).resolves.toEqual([
      otherLedger,
    ]);
    await expect(
      db.transactions_cache.where("user_id").equals("user-2").toArray(),
    ).resolves.toEqual([otherTransaction]);

    db.close();
  });

  it("发现悬空 ledger_id 时拒绝整次替换并保留上次完整缓存", async () => {
    const name = `foxledger-ledgers-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const db = new FoxLedgerDb(name);
    await db.open();
    const ledger = createLedger("user-1", ledgerOneId, "默认账本");
    const existing = createTransaction("user-1", "existing", ledgerOneId);
    await replaceCachedLedgerDataForUser(
      { ledgers: [ledger], transactions: [existing], userId: "user-1" },
      db,
    );

    await expect(
      replaceCachedLedgerDataForUser(
        {
          ledgers: [ledger],
          transactions: [
            createTransaction("user-1", "invalid", ledgerTwoId),
          ],
          userId: "user-1",
        },
        db,
      ),
    ).rejects.toThrow("待缓存账单指向了当前用户不存在的账本");
    await expect(
      db.transactions_cache.where("user_id").equals("user-1").toArray(),
    ).resolves.toEqual([existing]);

    db.close();
  });
});
