import { supabase } from "@/lib/supabase";
import {
  normalizeAiConfidence,
  toNullableText,
  validateAiTransactionDraft,
} from "@/lib/transactionDrafts";
import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
} from "@/types/transaction";

type CreateAiTransactionResult = {
  id: string;
  created_at: string;
};

type CreateAiTransactionItem = {
  parsedTransaction: ParsedTransaction;
  draft: ConfirmTransactionDraft;
};

type CreateAiTransactionsResult = {
  count: number;
  transactions: CreateAiTransactionResult[];
};

async function getCurrentUserId() {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后再保存");
  }

  return userData.user.id;
}

function buildAiTransactionInsertPayload(
  userId: string,
  parsedTransaction: ParsedTransaction,
  draft: ConfirmTransactionDraft,
) {
  const { amount, category } = validateAiTransactionDraft(parsedTransaction, draft);

  return {
    user_id: userId,
    type: draft.type,
    amount,
    currency: "CNY",
    category,
    tag: toNullableText(parsedTransaction.tag),
    merchant: toNullableText(draft.merchant),
    payment_method: toNullableText(draft.payment_method),
    account: toNullableText(parsedTransaction.account),
    date: draft.date,
    note: toNullableText(draft.note),
    raw_text: parsedTransaction.raw_text,
    source: "ai",
    ai_confidence: normalizeAiConfidence(parsedTransaction.ai_confidence),
  };
}

export async function createAiTransaction(
  parsedTransaction: ParsedTransaction,
  draft: ConfirmTransactionDraft,
): Promise<CreateAiTransactionResult> {
  const userId = await getCurrentUserId();
  const insertPayload = buildAiTransactionInsertPayload(userId, parsedTransaction, draft);

  const { data, error } = await supabase
    .from("transactions")
    .insert(insertPayload)
    .select("id, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const createdTransaction = data as unknown as CreateAiTransactionResult | null;

  if (!createdTransaction?.id) {
    throw new Error("保存失败，未创建账单。");
  }

  return createdTransaction;
}

export async function createAiTransactions(
  items: CreateAiTransactionItem[],
): Promise<CreateAiTransactionsResult> {
  if (items.length === 0) {
    throw new Error("没有可保存的账单。");
  }

  const userId = await getCurrentUserId();
  const insertPayload = items.map(({ parsedTransaction, draft }) =>
    buildAiTransactionInsertPayload(userId, parsedTransaction, draft),
  );

  const { data, error } = await supabase
    .from("transactions")
    .insert(insertPayload)
    .select("id, created_at");

  if (error) {
    throw new Error(error.message);
  }

  const createdTransactions = (data ?? []) as unknown as CreateAiTransactionResult[];

  if (createdTransactions.length !== insertPayload.length) {
    throw new Error("保存失败，创建账单数量不一致。");
  }

  return {
    count: createdTransactions.length,
    transactions: createdTransactions,
  };
}
