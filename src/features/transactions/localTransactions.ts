import { localDb, type CacheSyncMeta } from "@/lib/localDb";

import type {
  CachedTransaction,
  TransactionFilterSummary,
  TransactionFilters,
  TransactionPageResult,
} from "@/features/transactions/types";

export async function replaceCachedTransactionsForUser(params: {
  transactions: CachedTransaction[];
  userId: string;
}): Promise<CacheSyncMeta> {
  const now = new Date().toISOString();
  const meta: CacheSyncMeta = {
    last_error: null,
    last_successful_sync_at: now,
    row_count: params.transactions.length,
    sync_state: "synced",
    updated_at: now,
    user_id: params.userId,
  };

  await localDb.transaction("rw", localDb.transactions_cache, localDb.sync_meta, async () => {
    await localDb.transactions_cache.where("user_id").equals(params.userId).delete();
    await localDb.transactions_cache.bulkPut(params.transactions);
    await localDb.sync_meta.put(meta);
  });

  return meta;
}

export async function markSyncFailed(userId: string, message: string) {
  const previous = await localDb.sync_meta.get(userId);
  const now = new Date().toISOString();
  const meta: CacheSyncMeta = {
    last_error: message,
    last_successful_sync_at: previous?.last_successful_sync_at ?? null,
    row_count: previous?.row_count ?? 0,
    sync_state: "failed",
    updated_at: now,
    user_id: userId,
  };

  await localDb.sync_meta.put(meta);
  return meta;
}

export function getCachedSyncMeta(userId: string) {
  return localDb.sync_meta.get(userId);
}

export async function listAllCachedTransactions(userId: string) {
  return localDb.transactions_cache.where("user_id").equals(userId).toArray();
}

export async function listCachedTransactionsPage(params: {
  filters: TransactionFilters;
  limit: number;
  offset: number;
  userId: string;
}): Promise<TransactionPageResult> {
  const rows = await listAllCachedTransactions(params.userId);
  const filtered = applyTransactionFilters(rows, params.filters);
  const summary = summarizeTransactions(filtered);
  const start = Math.max(params.offset, 0);
  const end = start + Math.max(params.limit, 1);
  const transactions = filtered.slice(start, end);

  return {
    hasMore: end < filtered.length,
    summary,
    totalCount: filtered.length,
    transactions,
  };
}

export function applyTransactionFilters(
  rows: CachedTransaction[],
  filters: TransactionFilters,
) {
  const search = filters.search.trim().toLowerCase();
  const category = filters.category.trim();

  return rows
    .filter((row) => {
      if (filters.type && row.type !== filters.type) {
        return false;
      }

      if (category && row.category !== category) {
        return false;
      }

      if (filters.startDate && row.date < filters.startDate) {
        return false;
      }

      if (filters.endDate && row.date > filters.endDate) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [row.merchant, row.note, row.category]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search));
    })
    .sort((first, second) => compareTransactions(first, second, filters.sort));
}

export function summarizeTransactions(rows: CachedTransaction[]): TransactionFilterSummary {
  return rows.reduce<TransactionFilterSummary>(
    (summary, row) => {
      const amount = Math.abs(Number(row.amount));

      if (row.type === "expense") {
        summary.expense += amount;
      } else if (row.type === "income") {
        summary.income += amount;
      }

      summary.count += 1;
      return summary;
    },
    { count: 0, expense: 0, income: 0 },
  );
}

function compareTransactions(
  first: CachedTransaction,
  second: CachedTransaction,
  sort: TransactionFilters["sort"],
) {
  if (sort === "date-asc") {
    return (
      first.date.localeCompare(second.date) ||
      first.created_at.localeCompare(second.created_at) ||
      first.id.localeCompare(second.id)
    );
  }

  if (sort === "amount-desc") {
    return second.amount - first.amount || second.date.localeCompare(first.date);
  }

  if (sort === "amount-asc") {
    return first.amount - second.amount || second.date.localeCompare(first.date);
  }

  return (
    second.date.localeCompare(first.date) ||
    second.created_at.localeCompare(first.created_at) ||
    second.id.localeCompare(first.id)
  );
}
