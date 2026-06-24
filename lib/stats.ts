import { listCachedTransactionsForDateRange } from "@/lib/localTransactions";
import { calculateStatsForTransactions } from "@/lib/statsCalculator";
import type { MonthlySummaryData } from "@/types/transaction";

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
  userId: string,
  startDate: string,
  endDate: string,
  label = `${startDate} 至 ${endDate}`,
): Promise<MonthlyStats> {
  const range: StatsDateRange = {
    label,
    startDate,
    endDate,
  };
  const transactions = await listCachedTransactionsForDateRange(userId, range.startDate, range.endDate);
  return calculateStatsForTransactions(transactions, range);
}

export async function getMonthlyStats(userId: string): Promise<MonthlyStats> {
  const monthRange = getCurrentMonthRange();
  return getStatsForDateRange(userId, monthRange.startDate, monthRange.endDate, monthRange.label);
}
