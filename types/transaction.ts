export type TransactionType = "expense" | "income" | "transfer";

export type TransactionSource = "manual" | "ai";

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: "CNY";
  category: string;
  tag: string | null;
  merchant: string | null;
  payment_method: string | null;
  account: string | null;
  date: string;
  note: string | null;
  raw_text: string | null;
  source: TransactionSource;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type MonthlySummaryData = {
  month: string;
  expense: number;
  income: number;
  balance: number;
  budgetUsedPercent: number;
};

export type CategorySpend = {
  category: string;
  amount: number;
  percent: number;
};
