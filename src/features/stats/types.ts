import type { CachedTransaction } from "@/features/transactions/types";

export type StatsRangeKey = "custom" | "last-month" | "month" | "week" | "year";

export type StatsDateRange = {
  endDate: string;
  key: StatsRangeKey;
  label: string;
  startDate: string;
};

export type CategorySpend = {
  amount: number;
  category: string;
  percent: number;
};

export type DailySpend = {
  amount: number;
  date: string;
  percent: number;
};

export type MonthlyStats = {
  averageDailyExpense: number;
  categorySpend: CategorySpend[];
  dailySpend: DailySpend[];
  dayCount: number;
  maxExpenseAmount: number;
  range: StatsDateRange;
  summary: {
    balance: number;
    budgetUsedPercent: number;
    expense: number;
    income: number;
    month: string;
  };
  transactionCount: number;
};

export type StatsTransaction = Pick<CachedTransaction, "amount" | "category" | "date" | "type">;
