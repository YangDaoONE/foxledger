import type { MonthlyStats, StatsDateRange } from "@/lib/stats";
import type { Transaction } from "@/types/transaction";

function getInclusiveDayCount(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 1;
  }

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

function emptyStats(range: StatsDateRange): MonthlyStats {
  return {
    summary: {
      month: range.label,
      expense: 0,
      income: 0,
      balance: 0,
      budgetUsedPercent: 0,
    },
    categorySpend: [],
    dailySpend: [],
    transactionCount: 0,
    averageDailyExpense: 0,
    maxExpenseAmount: 0,
    dayCount: getInclusiveDayCount(range.startDate, range.endDate),
    range,
  };
}

export function calculateStatsForTransactions(
  transactions: Array<Pick<Transaction, "type" | "amount" | "category" | "date">>,
  range: StatsDateRange,
): MonthlyStats {
  const rows = transactions.map((transaction) => ({
    ...transaction,
    amount: Math.abs(Number(transaction.amount)),
  }));

  if (rows.length === 0) {
    return emptyStats(range);
  }

  const expense = rows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + row.amount, 0);
  const income = rows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const maxExpenseAmount = rows
    .filter((row) => row.type === "expense")
    .reduce((max, row) => Math.max(max, row.amount), 0);
  const categoryTotals = new Map<string, number>();
  const dailyTotals = new Map<string, number>();

  for (const row of rows) {
    if (row.type !== "expense") {
      continue;
    }

    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.amount);
    dailyTotals.set(row.date, (dailyTotals.get(row.date) ?? 0) + row.amount);
  }

  const maxCategoryAmount = Math.max(...categoryTotals.values(), 0);
  const maxDailyAmount = Math.max(...dailyTotals.values(), 0);
  const dayCount = getInclusiveDayCount(range.startDate, range.endDate);

  return {
    summary: {
      month: range.label,
      expense,
      income,
      balance: income - expense,
      budgetUsedPercent: 0,
    },
    categorySpend: Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percent: maxCategoryAmount > 0 ? Math.round((amount / maxCategoryAmount) * 100) : 0,
      }))
      .sort((first, second) => second.amount - first.amount),
    dailySpend: Array.from(dailyTotals.entries())
      .map(([date, amount]) => ({
        date,
        amount,
        percent: maxDailyAmount > 0 ? Math.round((amount / maxDailyAmount) * 100) : 0,
      }))
      .sort((first, second) => first.date.localeCompare(second.date)),
    transactionCount: rows.length,
    averageDailyExpense: dayCount > 0 ? expense / dayCount : 0,
    maxExpenseAmount,
    dayCount,
    range,
  };
}
