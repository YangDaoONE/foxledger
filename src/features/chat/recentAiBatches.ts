import Dexie, { type Table } from "dexie";

import type { CachedTransaction } from "@/features/transactions/types";
import { localDb } from "@/lib/localDb";

export const DEFAULT_RECENT_AI_BATCH_LIMIT = 20;

export type RecentAiBatch = {
  balance: number;
  batchCreatedAt: string;
  batchId: string;
  expense: number;
  income: number;
  latestCreatedAt: string;
  transactionCount: number;
  transactions: CachedTransaction[];
};

export type RecentAiBatchPage = {
  batches: RecentAiBatch[];
  hasMore: boolean;
  totalCount: number;
};

type AiBatchCacheReader = {
  transactions_cache: Table<CachedTransaction, string>;
};

export function groupRecentAiBatches(
  rows: CachedTransaction[],
  userId: string,
): RecentAiBatch[] {
  const groupedRows = new Map<string, CachedTransaction[]>();

  for (const row of rows) {
    if (row.user_id !== userId || typeof row.ai_batch_id !== "string") {
      continue;
    }

    const batchId = row.ai_batch_id.trim();

    if (!batchId) {
      continue;
    }

    const batchRows = groupedRows.get(batchId) ?? [];
    batchRows.push(row);
    groupedRows.set(batchId, batchRows);
  }

  return Array.from(groupedRows, ([batchId, batchRows]) =>
    createRecentAiBatch(batchId, batchRows),
  ).sort(
    (first, second) =>
      second.latestCreatedAt.localeCompare(first.latestCreatedAt) ||
      second.batchId.localeCompare(first.batchId),
  );
}

export function paginateRecentAiBatches(
  batches: RecentAiBatch[],
  offset = 0,
  limit = DEFAULT_RECENT_AI_BATCH_LIMIT,
): RecentAiBatchPage {
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.max(1, Math.trunc(limit));
  const end = safeOffset + safeLimit;

  return {
    batches: batches.slice(safeOffset, end),
    hasMore: end < batches.length,
    totalCount: batches.length,
  };
}

export async function listRecentAiBatches(
  params: {
    limit?: number;
    offset?: number;
    userId: string;
  },
  cache: AiBatchCacheReader = localDb,
) {
  const rows = await cache.transactions_cache
    .where("[user_id+ai_batch_id]")
    .between([params.userId, Dexie.minKey], [params.userId, Dexie.maxKey])
    .toArray();
  const batches = groupRecentAiBatches(rows, params.userId);

  return paginateRecentAiBatches(
    batches,
    params.offset,
    params.limit ?? DEFAULT_RECENT_AI_BATCH_LIMIT,
  );
}

export async function getRecentAiBatch(
  userId: string,
  batchId: string,
  cache: AiBatchCacheReader = localDb,
) {
  const normalizedBatchId = batchId.trim();

  if (!normalizedBatchId) {
    return null;
  }

  const rows = await cache.transactions_cache
    .where("[user_id+ai_batch_id]")
    .equals([userId, normalizedBatchId])
    .toArray();

  return groupRecentAiBatches(rows, userId)[0] ?? null;
}

function createRecentAiBatch(
  batchId: string,
  rows: CachedTransaction[],
): RecentAiBatch {
  const transactions = [...rows].sort(
    (first, second) =>
      first.created_at.localeCompare(second.created_at) ||
      first.id.localeCompare(second.id),
  );
  let expense = 0;
  let income = 0;

  for (const transaction of transactions) {
    const amount = Math.abs(Number(transaction.amount));

    if (transaction.type === "expense") {
      expense += amount;
    } else if (transaction.type === "income") {
      income += amount;
    }
  }

  return {
    balance: income - expense,
    batchCreatedAt: transactions[0].created_at,
    batchId,
    expense,
    income,
    latestCreatedAt: transactions[transactions.length - 1].created_at,
    transactionCount: transactions.length,
    transactions,
  };
}
