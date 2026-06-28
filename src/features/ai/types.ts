import type { TransactionType } from "@/features/transactions/types";

export type ParsedTransaction = {
  account: string | null;
  ai_confidence: number | null;
  amount: number | null;
  category: string;
  currency: "CNY";
  date: string;
  merchant: string | null;
  needs_clarification: boolean;
  note: string | null;
  payment_method: string | null;
  raw_text: string;
  source: "ai";
  tag: string | null;
  type: TransactionType | null;
};

export type ParsedTransactionBatch = {
  max_input_chars: number;
  max_transactions: number;
  transactions: ParsedTransaction[];
  truncated: boolean;
};

export type ConfirmTransactionDraft = {
  amount: string;
  category: string;
  date: string;
  merchant: string;
  note: string;
  payment_method: string;
  type: TransactionType;
};
