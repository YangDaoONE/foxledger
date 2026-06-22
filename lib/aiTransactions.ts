import { supabase } from "@/lib/supabase";
import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
  TransactionType,
} from "@/types/transaction";

type CreateAiTransactionResult = {
  id: string;
  created_at: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isTransactionType(value: string): value is TransactionType {
  return value === "expense" || value === "income" || value === "transfer";
}

function toNullableText(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAiConfidence(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || value > 1) {
    return null;
  }

  return value;
}

function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateAiTransactionDraft(parsedTransaction: ParsedTransaction, draft: ConfirmTransactionDraft) {
  const amount = Number(draft.amount.trim());
  const category = draft.category.trim();

  if (parsedTransaction.needs_clarification) {
    throw new Error("AI 解析结果仍需补充信息，不能保存。");
  }

  if (!isTransactionType(draft.type)) {
    throw new Error("账单类型不正确。");
  }

  if (!draft.amount.trim() || !Number.isFinite(amount) || amount === 0) {
    throw new Error("金额必须是非 0 的有效数字。");
  }

  if (!category) {
    throw new Error("分类不能为空。");
  }

  if (!isValidIsoDate(draft.date)) {
    throw new Error("日期必须是 YYYY-MM-DD 格式。");
  }

  if (!parsedTransaction.raw_text) {
    throw new Error("缺少 AI 解析原文，不能保存。");
  }

  return {
    amount: Math.abs(amount),
    category,
  };
}

export async function createAiTransaction(
  parsedTransaction: ParsedTransaction,
  draft: ConfirmTransactionDraft,
): Promise<CreateAiTransactionResult> {
  const { amount, category } = validateAiTransactionDraft(parsedTransaction, draft);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后再保存");
  }

  const insertPayload = {
    user_id: userData.user.id,
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
