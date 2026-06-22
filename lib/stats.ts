import { supabase } from "@/lib/supabase";
import type { MonthlySummaryData, Transaction } from "@/types/transaction";

export type DailySpend = {
  date: string;
  amount: number;
  percent: number;
};

export type MonthlyStats = {
  summary: MonthlySummaryData;
  categorySpend: Array<{
    category: string;
    amount: number;
    percent: number;
  }>;
  dailySpend: DailySpend[];
  transactionCount: number;
};

type StatsTransactionRow = Pick<Transaction, "type" | "amount" | "category" | "date"> & {
  amount: number | string;
};

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    label: `${year} 年 ${month + 1} 月`,
    startDate: toLocalDate(start),
    endDate: toLocalDate(end),
  };
}

function toLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyStats(month: string): MonthlyStats {
  return {
    summary: {
      month,
      expense: 0,
      income: 0,
      balance: 0,
      budgetUsedPercent: 0,
    },
    categorySpend: [],
    dailySpend: [],
    transactionCount: 0,
  };
}

export async function getMonthlyStats(): Promise<MonthlyStats> {
  const monthRange = getCurrentMonthRange();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后查看统计。");
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, category, date")
    .eq("user_id", userData.user.id)
    .gte("date", monthRange.startDate)
    .lte("date", monthRange.endDate)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as unknown as StatsTransactionRow[]).map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));

  if (rows.length === 0) {
    return emptyStats(monthRange.label);
  }

  const expense = rows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + row.amount, 0);
  const income = rows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + row.amount, 0);
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

  return {
    summary: {
      month: monthRange.label,
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
  };
}
