import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types/transaction";

type TransactionRow = Omit<Transaction, "amount" | "currency"> & {
  amount: number | string;
  currency: string;
};

const transactionSelectColumns = [
  "id",
  "user_id",
  "type",
  "amount",
  "currency",
  "category",
  "tag",
  "merchant",
  "payment_method",
  "account",
  "date",
  "note",
  "raw_text",
  "source",
  "ai_confidence",
  "created_at",
  "updated_at",
].join(",");

function normalizeTransaction(row: TransactionRow): Transaction {
  return {
    ...row,
    amount: Number(row.amount),
    currency: "CNY",
  };
}

export async function listRecentTransactions(limit = 20): Promise<Transaction[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后查看账单。");
  }

  const { data, error } = await supabase
    .from("transactions")
    .select(transactionSelectColumns)
    .eq("user_id", userData.user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as TransactionRow[]).map(normalizeTransaction);
}
