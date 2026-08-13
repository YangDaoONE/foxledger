import { supabase } from "@/lib/supabase";

import type {
  AiBatchTransactionInsert,
  CachedTransaction,
  TransactionInsertPayload,
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
  "ai_batch_id",
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

export type AiBatchInsertResult = {
  batchId: string;
  coordinated: boolean;
  transactionIds: string[];
};

export class AiBatchSaveStateError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "AiBatchSaveStateError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

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

  if (row.ai_batch_id !== null && !isValidUuid(row.ai_batch_id)) {
    throw new Error("远端账单 AI 批次 ID 异常。");
  }

  if (row.ai_batch_id !== null && row.source !== "ai") {
    throw new Error("非 AI 账单不能属于 AI 批次。");
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

export async function insertTransactionsForUser(
  userId: string,
  transactions: TransactionInsertPayload[],
) {
  if (transactions.length === 0) {
    throw new Error("没有可保存的账单。");
  }

  const expectedIds = getExplicitTransactionIds(transactions);
  const payload: TransactionWritePayload[] = transactions.map((transaction) => ({
    ...transaction,
    user_id: userId,
  }));
  const { data, error } = await supabase.from("transactions").insert(payload).select("id");

  if (error) {
    throw new Error(error.message);
  }

  return validateReturnedTransactionIds(data, payload.length, expectedIds);
}

export async function insertAiBatchTransactionsForUser(
  userId: string,
  transactions: AiBatchTransactionInsert[],
): Promise<AiBatchInsertResult> {
  const { batchId, expectedIds } = validateAiBatchInsert(transactions);
  const safeTransactions = transactions.map<TransactionInsertPayload>((transaction) => ({
    account: transaction.account,
    ai_batch_id: transaction.ai_batch_id,
    ai_confidence: transaction.ai_confidence,
    amount: transaction.amount,
    category: transaction.category,
    currency: transaction.currency,
    date: transaction.date,
    id: transaction.id,
    merchant: transaction.merchant,
    note: transaction.note,
    payment_method: transaction.payment_method,
    source: "ai",
    tag: transaction.tag,
    type: transaction.type,
  }));

  try {
    const transactionIds = await insertTransactionsForUser(userId, safeTransactions);

    return {
      batchId,
      coordinated: false,
      transactionIds,
    };
  } catch (insertError) {
    const remoteIds = await getRemoteAiBatchTransactionIds(userId, batchId);

    if (remoteIds.length === 0) {
      throw insertError instanceof Error
        ? insertError
        : new Error("AI 批次保存失败，请重试。");
    }

    if (haveSameIds(remoteIds, expectedIds)) {
      return {
        batchId,
        coordinated: true,
        transactionIds: expectedIds,
      };
    }

    throw new AiBatchSaveStateError(
      "AI 批次保存结果不完整，已禁止自动补写。请重新同步并人工核对账单。",
    );
  }
}

function getExplicitTransactionIds(transactions: TransactionInsertPayload[]) {
  const ids = transactions.map((transaction) => transaction.id ?? null);
  const explicitCount = ids.filter((id): id is string => id !== null).length;

  if (explicitCount === 0) {
    return null;
  }

  if (explicitCount !== ids.length) {
    throw new Error("同一次批量保存不能混用固定 ID 和数据库生成 ID。");
  }

  const explicitIds = ids as string[];

  if (new Set(explicitIds).size !== explicitIds.length) {
    throw new Error("同一次批量保存包含重复账单 ID。");
  }

  return explicitIds;
}

function validateReturnedTransactionIds(
  data: unknown,
  expectedCount: number,
  expectedIds: string[] | null,
) {
  if (!Array.isArray(data) || data.length !== expectedCount) {
    throw new Error("保存失败，创建账单数量不一致。");
  }

  const returnedIds = data.map((row) => {
    if (!row || typeof row !== "object" || !("id" in row)) {
      throw new Error("保存失败，返回账单 ID 异常。");
    }

    const id = row.id;

    if (typeof id !== "string" || !id.trim()) {
      throw new Error("保存失败，返回账单 ID 异常。");
    }

    return id;
  });

  if (new Set(returnedIds).size !== returnedIds.length) {
    throw new Error("保存失败，返回账单 ID 异常。");
  }

  if (expectedIds && !haveSameIds(returnedIds, expectedIds)) {
    throw new Error("保存失败，返回账单 ID 与提交不一致。");
  }

  return returnedIds;
}

function validateAiBatchInsert(transactions: AiBatchTransactionInsert[]) {
  if (transactions.length === 0) {
    throw new Error("没有可保存的 AI 候选。");
  }

  const batchId = transactions[0].ai_batch_id;

  if (!isValidUuid(batchId)) {
    throw new Error("AI 批次 ID 格式不正确。");
  }

  const expectedIds = transactions.map((transaction) => {
    if (transaction.source !== "ai") {
      throw new Error("AI 批次只能保存 AI 来源账单。");
    }

    if (transaction.ai_batch_id !== batchId) {
      throw new Error("同一次确认的 AI 候选必须使用相同批次 ID。");
    }

    if (!isValidUuid(transaction.id)) {
      throw new Error("AI 账单 ID 格式不正确。");
    }

    return transaction.id;
  });

  if (new Set(expectedIds).size !== expectedIds.length) {
    throw new Error("AI 批次包含重复账单 ID。");
  }

  return { batchId, expectedIds };
}

async function getRemoteAiBatchTransactionIds(userId: string, batchId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("ai_batch_id", batchId);

  if (error) {
    throw new AiBatchSaveStateError(
      "无法确认 AI 批次保存状态，请重新同步并核对账单后再操作。",
    );
  }

  if (!Array.isArray(data)) {
    throw new AiBatchSaveStateError(
      "无法确认 AI 批次保存状态，请重新同步并核对账单后再操作。",
    );
  }

  const ids = data.map((row) => row?.id);

  if (ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new AiBatchSaveStateError(
      "无法确认 AI 批次保存状态，请重新同步并核对账单后再操作。",
    );
  }

  const transactionIds = ids as string[];

  if (new Set(transactionIds).size !== transactionIds.length) {
    throw new AiBatchSaveStateError(
      "无法确认 AI 批次保存状态，请重新同步并核对账单后再操作。",
    );
  }

  return transactionIds;
}

function haveSameIds(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  const secondIds = new Set(second);
  return first.every((id) => secondIds.has(id));
}
