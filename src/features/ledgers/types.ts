export const DEFAULT_LEDGER_NAME = "默认账本";
export const MAX_LEDGER_COUNT = 20;
export const MAX_LEDGER_NAME_LENGTH = 30;

export type Ledger = {
  created_at: string;
  id: string;
  name: string;
  updated_at: string;
  user_id: string;
};

export type CachedLedger = Ledger & {
  cache_key: string;
};

export type CachedLedgerSummary = CachedLedger & {
  transactionCount: number;
};
