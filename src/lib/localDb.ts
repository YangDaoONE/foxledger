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

class FoxLedgerDb extends Dexie {
  sync_meta!: Table<CacheSyncMeta, string>;
  transactions_cache!: Table<CachedTransaction, string>;

  constructor() {
    super("foxledger");

    this.version(3).stores({
      sync_meta: "user_id, sync_state, updated_at",
      transactions_cache:
        "cache_key, user_id, id, date, created_at, updated_at, type, category, [user_id+date]",
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
