import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { getStatsForRange } from "@/features/stats/statsApi";
import type { CachedTransaction } from "@/features/transactions/types";
import { FoxLedgerDb } from "@/lib/localDb";

const ledgerOneId = "33333333-3333-4333-8333-333333333333";
const ledgerTwoId = "44444444-4444-4444-8444-444444444444";
const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

function createTransaction(
  id: string,
  ledgerId: string,
  amount: number,
): CachedTransaction {
  return {
    ai_batch_id: null,
    amount,
    cache_key: `user-1:${id}`,
    category: "餐饮",
    created_at: "2026-08-22T01:00:00.000Z",
    currency: "CNY",
    date: "2026-08-22",
    id,
    ledger_id: ledgerId,
    merchant: null,
    note: null,
    payment_method: null,
    source: "manual",
    type: "expense",
    updated_at: "2026-08-22T01:00:00.000Z",
    user_id: "user-1",
  };
}

describe("本地统计账本作用域", () => {
  it("同一用户的两个账本分别计算，不提供全部账本合计", async () => {
    const name = `foxledger-stats-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const db = new FoxLedgerDb(name);
    await db.open();
    await db.transactions_cache.bulkPut([
      createTransaction("daily", ledgerOneId, 10),
      createTransaction("travel", ledgerTwoId, 100),
    ]);
    const range = {
      endDate: "2026-08-31",
      key: "month" as const,
      label: "本月",
      startDate: "2026-08-01",
    };

    const daily = await getStatsForRange("user-1", ledgerOneId, range, db);
    const travel = await getStatsForRange("user-1", ledgerTwoId, range, db);

    expect(daily.summary.expense).toBe(10);
    expect(travel.summary.expense).toBe(100);

    db.close();
  });
});
