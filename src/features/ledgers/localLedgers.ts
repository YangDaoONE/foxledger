import type {
  CachedLedger,
  CachedLedgerSummary,
} from "@/features/ledgers/types";
import type { CachedTransaction } from "@/features/transactions/types";
import { localDb, type CacheSyncMeta, type FoxLedgerDb } from "@/lib/localDb";

export async function listCachedLedgersForUser(
  userId: string,
  cache: FoxLedgerDb = localDb,
) {
  const ledgers = await cache.ledgers_cache
    .where("user_id")
    .equals(userId)
    .toArray();

  return ledgers.sort(
    (first, second) =>
      first.created_at.localeCompare(second.created_at) ||
      first.id.localeCompare(second.id),
  );
}

export async function listCachedLedgerSummaries(
  userId: string,
  cache: FoxLedgerDb = localDb,
): Promise<CachedLedgerSummary[]> {
  const [ledgers, transactions] = await Promise.all([
    listCachedLedgersForUser(userId, cache),
    cache.transactions_cache.where("user_id").equals(userId).toArray(),
  ]);
  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    counts.set(
      transaction.ledger_id,
      (counts.get(transaction.ledger_id) ?? 0) + 1,
    );
  }

  return ledgers.map((ledger) => ({
    ...ledger,
    transactionCount: counts.get(ledger.id) ?? 0,
  }));
}

export async function replaceCachedLedgerDataForUser(params: {
  ledgers: CachedLedger[];
  transactions: CachedTransaction[];
  userId: string;
}, cache: FoxLedgerDb = localDb): Promise<CacheSyncMeta> {
  if (params.ledgers.length === 0) {
    throw new Error("当前用户至少需要一个待缓存账本。");
  }

  const ledgerIds = new Set<string>();

  for (const ledger of params.ledgers) {
    if (ledger.user_id !== params.userId) {
      throw new Error("待缓存账本不属于当前用户。");
    }

    if (ledger.cache_key !== `${params.userId}:${ledger.id}`) {
      throw new Error("待缓存账本键格式异常。");
    }

    ledgerIds.add(ledger.id);
  }

  if (ledgerIds.size !== params.ledgers.length) {
    throw new Error("待缓存账本包含重复 ID。");
  }

  const transactionIds = new Set<string>();

  for (const transaction of params.transactions) {
    if (transaction.user_id !== params.userId) {
      throw new Error("待缓存账单不属于当前用户。");
    }

    if (!ledgerIds.has(transaction.ledger_id)) {
      throw new Error("待缓存账单指向了当前用户不存在的账本。");
    }

    if (transaction.cache_key !== `${params.userId}:${transaction.id}`) {
      throw new Error("待缓存账单键格式异常。");
    }

    if (transactionIds.has(transaction.id)) {
      throw new Error("待缓存账单包含重复 ID。");
    }

    transactionIds.add(transaction.id);
  }

  const now = new Date().toISOString();
  const meta: CacheSyncMeta = {
    last_error: null,
    last_successful_sync_at: now,
    row_count: params.transactions.length,
    sync_state: "synced",
    updated_at: now,
    user_id: params.userId,
  };

  await cache.transaction(
    "rw",
    cache.ledgers_cache,
    cache.transactions_cache,
    cache.sync_meta,
    async () => {
      await cache.ledgers_cache.where("user_id").equals(params.userId).delete();
      await cache.transactions_cache.where("user_id").equals(params.userId).delete();
      await cache.ledgers_cache.bulkPut(params.ledgers);
      await cache.transactions_cache.bulkPut(params.transactions);
      await cache.sync_meta.put(meta);
    },
  );

  return meta;
}
