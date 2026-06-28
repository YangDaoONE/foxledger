import { listAllCachedTransactions } from "@/features/transactions/localTransactions";

import { calculateStatsForTransactions } from "@/features/stats/statsCalculator";
import type { StatsDateRange } from "@/features/stats/types";

export async function getStatsForRange(userId: string, range: StatsDateRange) {
  const rows = await listAllCachedTransactions(userId);
  const transactions = rows.filter(
    (row) => row.date >= range.startDate && row.date <= range.endDate,
  );

  return calculateStatsForTransactions(transactions, range);
}
