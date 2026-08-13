import Dexie, { type Table } from "dexie";

import type { CachedTransaction } from "@/features/transactions/types";

export type CacheSyncMeta = {
  last_error: string | null;
  last_successful_sync_at: string | null;
  row_count: number;
  sync_state: "failed" | "idle" | "syncing" | "synced";
  updated_at: string;
  user_id: string;
};

export class FoxLedgerDb extends Dexie {
  sync_meta!: Table<CacheSyncMeta, string>;
  transactions_cache!: Table<CachedTransaction, string>;

  constructor(databaseName = "foxledger") {
    super(databaseName);

    this.version(3).stores({
      sync_meta: "user_id, sync_state, updated_at",
      transactions_cache:
        "cache_key, user_id, id, date, created_at, updated_at, type, category, [user_id+date]",
    });

    this.version(4).stores({
      sync_meta: "user_id, sync_state, updated_at",
      transactions_cache:
        "cache_key, user_id, id, date, created_at, updated_at, type, category, ai_batch_id, [user_id+date], [user_id+ai_batch_id]",
    });
  }
}

export const localDb = new FoxLedgerDb();

export async function clearCachedDataForUser(userId: string) {
  await localDb.transaction("rw", localDb.transactions_cache, localDb.sync_meta, async () => {
    await localDb.transactions_cache.where("user_id").equals(userId).delete();
    await localDb.sync_meta.delete(userId);
  });
}
