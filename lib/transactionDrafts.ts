import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
} from "@/types/transaction";
import {
  defaultCategories,
  isDefaultCategory,
  isTransactionType,
  isValidIsoDate,
  normalizeDefaultCategory,
  toNullableText,
  transactionTypeOptions,
} from "@/lib/transactionRules";

export {
  defaultCategories,
  isTransactionType,
  isValidIsoDate,
  toNullableText,
  transactionTypeOptions,
};

export function createConfirmTransactionDraft(
  transaction: ParsedTransaction,
): ConfirmTransactionDraft {
  return {
    type: transaction.type ?? "expense",
    amount: transaction.amount === null ? "" : String(transaction.amount),
    category: normalizeDefaultCategory(transaction.category),
    date: transaction.date,
    merchant: transaction.merchant ?? "",
    payment_method: transaction.payment_method ?? "",
    note: transaction.note ?? "",
  };
}

export function validateConfirmTransactionDraft(draft: ConfirmTransactionDraft) {
  const messages: string[] = [];
  const amount = Number(draft.amount.trim());

  if (!isTransactionType(draft.type)) {
    messages.push("账单类型不正确。");
  }

  if (!draft.amount.trim()) {
    messages.push("金额不能为空。");
  } else if (!Number.isFinite(amount) || amount === 0) {
    messages.push("金额必须是非 0 的有效数字，可正可负。");
  }

  if (!draft.category.trim()) {
    messages.push("分类不能为空。");
  } else if (!isDefaultCategory(draft.category)) {
    messages.push("分类只能选择默认分类。");
  }

  if (!isValidIsoDate(draft.date)) {
    messages.push("日期必须是 YYYY-MM-DD 格式。");
  }

  return messages;
}

export function normalizeAiConfidence(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || value > 1) {
    return null;
  }

  return value;
}

export function validateAiTransactionDraft(
  parsedTransaction: ParsedTransaction,
  draft: ConfirmTransactionDraft,
) {
  const validationMessages = validateConfirmTransactionDraft(draft);

  if (validationMessages.length > 0) {
    throw new Error(validationMessages.join(" "));
  }

  if (!parsedTransaction.raw_text) {
    throw new Error("缺少 AI 解析原文，不能保存。");
  }

  return {
    amount: Math.abs(Number(draft.amount.trim())),
    category: normalizeDefaultCategory(draft.category),
  };
}
