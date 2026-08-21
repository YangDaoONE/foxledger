export type TransactionType = "expense" | "income" | "transfer";

export type TransactionSource = "manual" | "ai";

export type CachedTransaction = {
  ai_batch_id: string | null;
  cache_key: string;
  id: string;
  ledger_id: string;
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

export type TransactionInsertPayload = {
  ai_batch_id?: string | null;
  id?: string;
  ledger_id: string;
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

export type AiBatchTransactionInput = Omit<
  TransactionInsertPayload,
  "ai_batch_id" | "id" | "raw_text" | "source"
>;

export type AiBatchTransactionInsert = AiBatchTransactionInput & {
  ai_batch_id: string;
  id: string;
  source: "ai";
};

export type TransactionWritePayload = TransactionInsertPayload & {
  user_id: string;
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
