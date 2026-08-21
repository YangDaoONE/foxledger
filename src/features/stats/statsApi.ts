import { listAllCachedTransactions } from "@/features/transactions/localTransactions";

import { calculateStatsForTransactions } from "@/features/stats/statsCalculator";
import type { StatsDateRange } from "@/features/stats/types";
import type { FoxLedgerDb } from "@/lib/localDb";

export async function getStatsForRange(
  userId: string,
  ledgerId: string,
  range: StatsDateRange,
  cache?: FoxLedgerDb,
) {
  const rows = await listAllCachedTransactions(userId, ledgerId, cache);
  const transactions = rows.filter(
    (row) => row.date >= range.startDate && row.date <= range.endDate,
  );

  return calculateStatsForTransactions(transactions, range);
}
