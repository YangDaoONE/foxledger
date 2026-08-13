import {
  LEDGER_TRANSACTION_TYPES,
  type LedgerDateRange,
  type LedgerStatsEnvelope,
  type LedgerTransactionType,
  isLedgerIsoDate,
} from "./ledgerContracts";

export type LedgerStatsTransaction = {
  amount: number;
  category: string;
  date: string;
  merchant?: string | null;
  type: LedgerTransactionType;
};

function parseDateParts(value: string) {
  return value.split("-").map(Number) as [number, number, number];
}

export function getInclusiveLedgerDayCount(startDate: string, endDate: string) {
  if (!isLedgerIsoDate(startDate) || !isLedgerIsoDate(endDate) || startDate > endDate) {
    return 1;
  }

  const [startYear, startMonth, startDay] = parseDateParts(startDate);
  const [endYear, endMonth, endDay] = parseDateParts(endDate);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);

  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

export function calculateLedgerStatsEnvelope(
  transactions: readonly LedgerStatsTransaction[],
  range: LedgerDateRange,
): LedgerStatsEnvelope {
  const rows = transactions.map((transaction) => ({
    ...transaction,
    amount: Math.abs(Number(transaction.amount)),
    merchant: transaction.merchant?.trim() || null,
  }));
  const expenseRows = rows.filter((row) => row.type === "expense");
  const incomeRows = rows.filter((row) => row.type === "income");
  const expense = expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const income = incomeRows.reduce((sum, row) => sum + row.amount, 0);
  const categoryTotals = new Map<string, number>();
  const dailyTotals = new Map<string, number>();
  const merchantTotals = new Map<string, { amount: number; count: number }>();
  const typeTotals = new Map<LedgerTransactionType, { amount: number; count: number }>();

  for (const row of rows) {
    const total = typeTotals.get(row.type) ?? { amount: 0, count: 0 };
    total.amount += row.amount;
    total.count += 1;
    typeTotals.set(row.type, total);
  }

  for (const row of expenseRows) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.amount);
    dailyTotals.set(row.date, (dailyTotals.get(row.date) ?? 0) + row.amount);

    if (row.merchant) {
      const total = merchantTotals.get(row.merchant) ?? { amount: 0, count: 0 };
      total.amount += row.amount;
      total.count += 1;
      merchantTotals.set(row.merchant, total);
    }
  }

  const dayCount = getInclusiveLedgerDayCount(range.startDate, range.endDate);

  return {
    averageDailyExpense: dayCount > 0 ? expense / dayCount : 0,
    categorySpend: Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({ amount, category }))
      .sort((first, second) => second.amount - first.amount),
    dailySpend: Array.from(dailyTotals.entries())
      .map(([date, amount]) => ({ amount, date }))
      .sort((first, second) => first.date.localeCompare(second.date)),
    merchantSpend: Array.from(merchantTotals.entries())
      .map(([merchant, total]) => ({ merchant, ...total }))
      .sort((first, second) => second.amount - first.amount),
    maxExpenseAmount: expenseRows.reduce(
      (maximum, row) => Math.max(maximum, row.amount),
      0,
    ),
    range: {
      endDate: range.endDate,
      label: range.label,
      startDate: range.startDate,
    },
    summary: {
      balance: income - expense,
      expense,
      income,
    },
    transactionCount: rows.length,
    typeBreakdown: LEDGER_TRANSACTION_TYPES.flatMap((type) => {
      const total = typeTotals.get(type);
      return total ? [{ type, ...total }] : [];
    }),
  };
}
