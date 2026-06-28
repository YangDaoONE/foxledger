import { getInclusiveDayCount } from "@/lib/date";

import type { MonthlyStats, StatsDateRange, StatsTransaction } from "@/features/stats/types";

function emptyStats(range: StatsDateRange): MonthlyStats {
  return {
    averageDailyExpense: 0,
    categorySpend: [],
    dailySpend: [],
    dayCount: getInclusiveDayCount(range.startDate, range.endDate),
    maxExpenseAmount: 0,
    range,
    summary: {
      balance: 0,
      budgetUsedPercent: 0,
      expense: 0,
      income: 0,
      month: range.label,
    },
    transactionCount: 0,
  };
}

export function calculateStatsForTransactions(
  transactions: StatsTransaction[],
  range: StatsDateRange,
): MonthlyStats {
  const rows = transactions.map((transaction) => ({
    ...transaction,
    amount: Math.abs(Number(transaction.amount)),
  }));

  if (rows.length === 0) {
    return emptyStats(range);
  }

  const expenseRows = rows.filter((row) => row.type === "expense");
  const incomeRows = rows.filter((row) => row.type === "income");
  const expense = expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const income = incomeRows.reduce((sum, row) => sum + row.amount, 0);
  const maxExpenseAmount = expenseRows.reduce((max, row) => Math.max(max, row.amount), 0);
  const categoryTotals = new Map<string, number>();
  const dailyTotals = new Map<string, number>();

  for (const row of expenseRows) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.amount);
    dailyTotals.set(row.date, (dailyTotals.get(row.date) ?? 0) + row.amount);
  }

  const maxCategoryAmount = Math.max(...categoryTotals.values(), 0);
  const maxDailyAmount = Math.max(...dailyTotals.values(), 0);
  const dayCount = getInclusiveDayCount(range.startDate, range.endDate);

  return {
    averageDailyExpense: dayCount > 0 ? expense / dayCount : 0,
    categorySpend: Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        amount,
        category,
        percent: maxCategoryAmount > 0 ? Math.round((amount / maxCategoryAmount) * 100) : 0,
      }))
      .sort((first, second) => second.amount - first.amount),
    dailySpend: Array.from(dailyTotals.entries())
      .map(([date, amount]) => ({
        amount,
        date,
        percent: maxDailyAmount > 0 ? Math.round((amount / maxDailyAmount) * 100) : 0,
      }))
      .sort((first, second) => first.date.localeCompare(second.date)),
    dayCount,
    maxExpenseAmount,
    range,
    summary: {
      balance: income - expense,
      budgetUsedPercent: 0,
      expense,
      income,
      month: range.label,
    },
    transactionCount: rows.length,
  };
}
