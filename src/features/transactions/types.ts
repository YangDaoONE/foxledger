export type TransactionType = "expense" | "income" | "transfer";

export type TransactionSource = "manual" | "ai";

export type CachedTransaction = {
  cache_key: string;
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: "CNY";
  category: string;
  merchant: string | null;
  payment_method: string | null;
  date: string;
  note: string | null;
  source: TransactionSource;
  created_at: string;
  updated_at: string;
};

export type TransactionWritePayload = {
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: "CNY";
  category: string;
  tag?: string | null;
  merchant: string | null;
  payment_method: string | null;
  account?: string | null;
  date: string;
  note: string | null;
  raw_text?: string | null;
  source: TransactionSource;
  ai_confidence?: number | null;
};

export type TransactionSortOption =
  | "amount-asc"
  | "amount-desc"
  | "date-asc"
  | "date-desc";

export type TransactionFilters = {
  category: string;
  endDate: string;
  search: string;
  sort: TransactionSortOption;
  startDate: string;
  type: TransactionType | "";
};

export type TransactionFilterSummary = {
  count: number;
  expense: number;
  income: number;
};

export type TransactionPageResult = {
  hasMore: boolean;
  summary: TransactionFilterSummary;
  totalCount: number;
  transactions: CachedTransaction[];
};
