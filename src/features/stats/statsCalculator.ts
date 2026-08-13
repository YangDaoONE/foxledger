import type { MonthlyStats, StatsDateRange, StatsTransaction } from "@/features/stats/types";
import {
  calculateLedgerStatsEnvelope,
  getInclusiveLedgerDayCount,
} from "@shared/ledgerAnalytics";

export function calculateStatsForTransactions(
  transactions: StatsTransaction[],
  range: StatsDateRange,
): MonthlyStats {
  const ledgerStats = calculateLedgerStatsEnvelope(transactions, range);
  const maxCategoryAmount = Math.max(
    ...ledgerStats.categorySpend.map((item) => item.amount),
    0,
  );
  const maxDailyAmount = Math.max(
    ...ledgerStats.dailySpend.map((item) => item.amount),
    0,
  );

  return {
    averageDailyExpense: ledgerStats.averageDailyExpense,
    categorySpend: ledgerStats.categorySpend.map(({ amount, category }) => ({
      amount,
      category,
      percent: maxCategoryAmount > 0 ? Math.round((amount / maxCategoryAmount) * 100) : 0,
    })),
    dailySpend: ledgerStats.dailySpend.map(({ amount, date }) => ({
      amount,
      date,
      percent: maxDailyAmount > 0 ? Math.round((amount / maxDailyAmount) * 100) : 0,
    })),
    dayCount: getInclusiveLedgerDayCount(range.startDate, range.endDate),
    maxExpenseAmount: ledgerStats.maxExpenseAmount,
    range,
    summary: {
      balance: ledgerStats.summary.balance,
      budgetUsedPercent: 0,
      expense: ledgerStats.summary.expense,
      income: ledgerStats.summary.income,
      month: range.label,
    },
    transactionCount: ledgerStats.transactionCount,
  };
}
