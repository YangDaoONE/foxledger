import { supabase } from "@/lib/supabase";
import type { MonthlySummaryData, Transaction } from "@/types/transaction";

export type StatsRangePreset = "this-week" | "this-month" | "last-month" | "this-year";

export type StatsDateRange = {
  label: string;
  startDate: string;
  endDate: string;
};

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
  averageDailyExpense: number;
  maxExpenseAmount: number;
  dayCount: number;
  range: StatsDateRange;
};

type StatsTransactionRow = Pick<Transaction, "type" | "amount" | "category" | "date"> & {
  amount: number | string;
};

const statsPageSize = 1000;

function getCurrentMonthRange(): StatsDateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);

  return {
    label: `${year} 年 ${month + 1} 月`,
    startDate: toLocalDate(start),
    endDate: toLocalDate(now),
  };
}

function toLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export function getPresetStatsDateRange(preset: StatsRangePreset): StatsDateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "this-week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(year, month, now.getDate() + mondayOffset);

    return {
      label: "本周",
      startDate: toLocalDate(start),
      endDate: toLocalDate(now),
    };
  }

  if (preset === "last-month") {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    return {
      label: "上月",
      startDate: toLocalDate(start),
      endDate: toLocalDate(end),
    };
  }

  if (preset === "this-year") {
    return {
      label: "今年",
      startDate: toLocalDate(new Date(year, 0, 1)),
      endDate: toLocalDate(now),
    };
  }

  return {
    ...getCurrentMonthRange(),
    label: "本月",
  };
}

export async function getStatsForDateRange(
  startDate: string,
  endDate: string,
  label = `${startDate} 至 ${endDate}`,
): Promise<MonthlyStats> {
  const range: StatsDateRange = {
    label,
    startDate,
    endDate,
  };
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后查看统计。");
  }

  const statsRows: StatsTransactionRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("type, amount, category, date")
      .eq("user_id", userData.user.id)
      .gte("date", range.startDate)
      .lte("date", range.endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + statsPageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const currentRows = (data ?? []) as unknown as StatsTransactionRow[];
    statsRows.push(...currentRows);

    if (currentRows.length < statsPageSize) {
      break;
    }

    offset += statsPageSize;
  }

  const rows = statsRows.map((row) => ({
    ...row,
    amount: Math.abs(Number(row.amount)),
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

export async function getMonthlyStats(): Promise<MonthlyStats> {
  const monthRange = getCurrentMonthRange();
  return getStatsForDateRange(monthRange.startDate, monthRange.endDate, monthRange.label);
}
