export const queryKeys = {
  ledgers: (userId: string) => ["ledgers", userId] as const,
  ledgerSummaries: (userId: string) =>
    [...queryKeys.ledgers(userId), "summaries"] as const,
  monthlySummaries: (userId: string) => ["monthlySummary", userId] as const,
  monthlySummary: (
    userId: string,
    ledgerId: string,
    startDate: string,
    endDate: string,
  ) =>
    [
      ...queryKeys.monthlySummaries(userId),
      ledgerId,
      startDate,
      endDate,
    ] as const,
  recentAiBatches: (userId: string) => ["recentAiBatches", userId] as const,
  recentAiBatchesForLedger: (userId: string, ledgerId: string) =>
    [...queryKeys.recentAiBatches(userId), ledgerId] as const,
  recentAiBatch: (userId: string, ledgerId: string, batchId: string) =>
    [
      ...queryKeys.recentAiBatchesForLedger(userId, ledgerId),
      "detail",
      batchId,
    ] as const,
  recentAiBatchPage: (userId: string, ledgerId: string, limit: number) =>
    [...queryKeys.recentAiBatchesForLedger(userId, ledgerId), limit] as const,
  stats: (userId: string) => ["stats", userId] as const,
  statsRange: (
    userId: string,
    ledgerId: string,
    rangeKey: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
  ) =>
    [
      ...queryKeys.stats(userId),
      ledgerId,
      rangeKey,
      startDate,
      endDate,
    ] as const,
  syncMeta: (userId: string) => ["syncMeta", userId] as const,
  transactions: (userId: string) => ["transactions", userId] as const,
  transactionPage: (
    userId: string,
    ledgerId: string,
    filtersKey: string,
    visibleCount: number,
  ) =>
    [
      ...queryKeys.transactions(userId),
      ledgerId,
      filtersKey,
      visibleCount,
    ] as const,
};
