import { supabase } from "@/lib/supabase";

import type {
  CachedTransaction,
  TransactionType,
  TransactionWritePayload,
} from "@/features/transactions/types";
import {
  DEFAULT_CURRENCY,
  isTransactionType,
  normalizeDefaultCategory,
  toNullableText,
} from "@/features/transactions/transactionRules";

export const TRANSACTION_CACHE_SELECT = [
  "id",
  "user_id",
  "type",
  "amount",
  "currency",
  "category",
  "merchant",
  "payment_method",
  "date",
  "note",
  "source",
  "created_at",
  "updated_at",
].join(",");

type RemoteCacheRow = Omit<CachedTransaction, "amount" | "cache_key"> & {
  amount: number | string;
};

export type EditableTransactionValues = {
  amount: string;
  category: string;
  date: string;
  merchant: string;
  note: string;
  payment_method: string;
  type: TransactionType;
};

export function normalizeRemoteCacheRow(row: RemoteCacheRow, userId: string): CachedTransaction {
  if (row.user_id !== userId) {
    throw new Error("远端返回了不属于当前用户的账单。");
  }

  if (!isTransactionType(row.type)) {
    throw new Error("远端账单类型异常。");
  }

  const amount = Number(row.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("远端账单金额异常。");
  }

  return {
    ...row,
    amount,
    cache_key: `${row.user_id}:${row.id}`,
    currency: DEFAULT_CURRENCY,
  };
}

export async function createManualTransaction(
  userId: string,
  values: EditableTransactionValues,
) {
  const payload: TransactionWritePayload = {
    amount: Math.abs(Number(values.amount)),
    category: normalizeDefaultCategory(values.category),
    currency: DEFAULT_CURRENCY,
    date: values.date,
    merchant: toNullableText(values.merchant),
    note: toNullableText(values.note),
    payment_method: toNullableText(values.payment_method),
    source: "manual",
    type: values.type,
    user_id: userId,
  };

  const { error } = await supabase.from("transactions").insert(payload).select("id").single();

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  values: EditableTransactionValues,
) {
  const payload = {
    amount: Math.abs(Number(values.amount)),
    category: normalizeDefaultCategory(values.category),
    date: values.date,
    merchant: toNullableText(values.merchant),
    note: toNullableText(values.note),
    payment_method: toNullableText(values.payment_method),
    type: values.type,
  };

  const { data, error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", transactionId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("未找到可编辑的账单，或当前账号没有权限。");
  }
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("未找到可删除的账单，或当前账号没有权限。");
  }
}

export async function deleteTransactionsByIds(userId: string, transactionIds: string[]) {
  const uniqueIds = Array.from(new Set(transactionIds.map((id) => id.trim()).filter(Boolean)));

  if (uniqueIds.length === 0) {
    throw new Error("请选择要删除的账单。");
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .in("id", uniqueIds)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function insertTransactions(payload: TransactionWritePayload[]) {
  if (payload.length === 0) {
    throw new Error("没有可保存的账单。");
  }

  const { data, error } = await supabase.from("transactions").insert(payload).select("id");

  if (error) {
    throw new Error(error.message);
  }

  if ((data?.length ?? 0) !== payload.length) {
    throw new Error("保存失败，创建账单数量不一致。");
  }

  return data.length;
}
