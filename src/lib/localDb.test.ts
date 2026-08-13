import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { FoxLedgerDb } from "@/lib/localDb";

const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((databaseName) => Dexie.delete(databaseName)));
});

describe("Dexie v4 升级", () => {
  it("从 v3 增加 AI 批次索引时保留既有缓存行", async () => {
    const databaseName = `foxledger-upgrade-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const legacyDb = new Dexie(databaseName);
    legacyDb.version(3).stores({
      sync_meta: "user_id, sync_state, updated_at",
      transactions_cache:
        "cache_key, user_id, id, date, created_at, updated_at, type, category, [user_id+date]",
    });
    const legacyRow = {
      amount: 18,
      cache_key: "user-1:legacy-1",
      category: "餐饮",
      created_at: "2026-08-12T01:00:00.000Z",
      currency: "CNY",
      date: "2026-08-12",
      id: "legacy-1",
      merchant: null,
      note: null,
      payment_method: null,
      source: "manual",
      type: "expense",
      updated_at: "2026-08-12T01:00:00.000Z",
      user_id: "user-1",
    };

    await legacyDb.open();
    await legacyDb.table("transactions_cache").put(legacyRow);
    legacyDb.close();

    const upgradedDb = new FoxLedgerDb(databaseName);
    await upgradedDb.open();

    expect(upgradedDb.verno).toBe(4);
    await expect(upgradedDb.transactions_cache.toArray()).resolves.toEqual([legacyRow]);
    expect(
      upgradedDb.transactions_cache.schema.indexes.map((index) => index.name),
    ).toEqual(
      expect.arrayContaining(["ai_batch_id", "[user_id+ai_batch_id]"]),
    );

    upgradedDb.close();
  });
});
