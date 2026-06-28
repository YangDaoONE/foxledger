import { isValidIsoDate } from "@/lib/date";

import type { TransactionType } from "@/features/transactions/types";

export const DEFAULT_CURRENCY = "CNY";
export const DEFAULT_CATEGORY = "其他";

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
  DEFAULT_CATEGORY,
] as const;

export function isTransactionType(value: string): value is TransactionType {
  return value === "expense" || value === "income" || value === "transfer";
}

export function getTransactionTypeLabel(type: TransactionType) {
  if (type === "income") {
    return "收入";
  }

  if (type === "transfer") {
    return "转账";
  }

  return "支出";
}

export function isDefaultCategory(value: string) {
  return defaultCategories.includes(value.trim() as (typeof defaultCategories)[number]);
}

export function normalizeDefaultCategory(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return isDefaultCategory(trimmed) ? trimmed : DEFAULT_CATEGORY;
}

export function toNullableText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function validateTransactionDraft(values: {
  amount: string;
  category: string;
  date: string;
  type: string;
}) {
  const messages: string[] = [];
  const amount = Number(values.amount.trim());

  if (!isTransactionType(values.type)) {
    messages.push("请选择正确的账单类型。");
  }

  if (!values.amount.trim()) {
    messages.push("金额不能为空。");
  } else if (!Number.isFinite(amount) || amount <= 0) {
    messages.push("金额必须是大于 0 的有效数字。");
  }

  if (!isDefaultCategory(values.category)) {
    messages.push("请选择默认分类。");
  }

  if (!isValidIsoDate(values.date)) {
    messages.push("日期必须是 YYYY-MM-DD。");
  }

  return messages;
}
