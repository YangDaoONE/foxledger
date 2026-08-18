export const queryKeys = {
  monthlySummaries: (userId: string) => ["monthlySummary", userId] as const,
  monthlySummary: (userId: string, startDate: string, endDate: string) =>
    [...queryKeys.monthlySummaries(userId), startDate, endDate] as const,
  recentAiBatches: (userId: string) => ["recentAiBatches", userId] as const,
  recentAiBatch: (userId: string, batchId: string) =>
    [...queryKeys.recentAiBatches(userId), "detail", batchId] as const,
  recentAiBatchPage: (userId: string, limit: number) =>
    [...queryKeys.recentAiBatches(userId), limit] as const,
  stats: (userId: string) => ["stats", userId] as const,
  statsRange: (
    userId: string,
    rangeKey: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
  ) => [...queryKeys.stats(userId), rangeKey, startDate, endDate] as const,
  syncMeta: (userId: string) => ["syncMeta", userId] as const,
  transactions: (userId: string) => ["transactions", userId] as const,
  transactionPage: (userId: string, filtersKey: string, visibleCount: number) =>
    [...queryKeys.transactions(userId), filtersKey, visibleCount] as const,
};
