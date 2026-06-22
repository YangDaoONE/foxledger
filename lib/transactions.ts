import { supabase } from "@/lib/supabase";
import type { Transaction, TransactionType } from "@/types/transaction";

type TransactionRow = Omit<Transaction, "amount" | "currency"> & {
  amount: number | string;
  currency: string;
};

export type EditableTransactionValues = {
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  note: string | null;
};

type UpdatedTransactionResult = {
  id: string;
  updated_at: string;
};

type DeletedTransactionResult = {
  id: string;
};

const noEditableTransactionMessage = "未找到可编辑的账单，或你没有权限修改这条记录。";
const noDeletableTransactionMessage = "未找到可删除的账单，或你没有权限删除这条记录。";

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

export async function updateTransaction(
  transaction: Transaction,
  values: EditableTransactionValues,
): Promise<UpdatedTransactionResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后再编辑账单。");
  }

  const updatePayload: EditableTransactionValues = {
    type: values.type,
    amount: values.amount,
    category: values.category,
    date: values.date,
    merchant: values.merchant,
    payment_method: values.payment_method,
    note: values.note,
  };

  const { data, error } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", transaction.id)
    .eq("user_id", userData.user.id)
    .select("id, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error(noEditableTransactionMessage);
    }

    throw new Error(error.message);
  }

  const updatedTransaction = data as unknown as UpdatedTransactionResult | null;

  if (!updatedTransaction?.id) {
    throw new Error(noEditableTransactionMessage);
  }

  return updatedTransaction;
}

export async function deleteTransaction(transactionId: string): Promise<DeletedTransactionResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后再删除账单");
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userData.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const deletedTransaction = data as unknown as DeletedTransactionResult | null;

  if (!deletedTransaction?.id) {
    throw new Error(noDeletableTransactionMessage);
  }

  return deletedTransaction;
}
