import type { TransactionType } from "@/types/transaction";

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

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isTransactionType(value: string): value is TransactionType {
  return value === "expense" || value === "income" || value === "transfer";
}

export function isDefaultCategory(value: string) {
  return defaultCategories.includes(value.trim() as (typeof defaultCategories)[number]);
}

export function normalizeDefaultCategory(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return isDefaultCategory(trimmed) ? trimmed : DEFAULT_CATEGORY;
}

export function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function toNullableText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
