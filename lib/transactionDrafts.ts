import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
  TransactionType,
} from "@/types/transaction";

export const transactionTypeOptions: Array<{ label: string; value: TransactionType }> = [
  { label: "支出", value: "expense" },
  { label: "收入", value: "income" },
  { label: "转账", value: "transfer" },
];

export const defaultCategories = [
  "餐饮",
  "交通",
  "购物",
  "住房",
  "学习",
  "医疗",
  "娱乐",
  "日用",
  "旅行",
  "订阅",
  "人情",
  "收入",
  "转账",
  "其他",
];

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function createConfirmTransactionDraft(
  transaction: ParsedTransaction,
): ConfirmTransactionDraft {
  return {
    type: transaction.type ?? "expense",
    amount: transaction.amount === null ? "" : String(transaction.amount),
    category: transaction.category,
    date: transaction.date,
    merchant: transaction.merchant ?? "",
    payment_method: transaction.payment_method ?? "",
    note: transaction.note ?? "",
  };
}

export function isTransactionType(value: string): value is TransactionType {
  return value === "expense" || value === "income" || value === "transfer";
}

export function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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
  }

  if (!isValidIsoDate(draft.date)) {
    messages.push("日期必须是 YYYY-MM-DD 格式。");
  }

  return messages;
}

export function toNullableText(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
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
    category: draft.category.trim(),
  };
}
