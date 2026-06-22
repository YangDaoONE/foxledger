import type { ParsedTransaction, TransactionType } from "@/types/transaction";

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

const defaultCategory = "其他";
const maxTextLength = 500;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const transactionTypes: TransactionType[] = ["expense", "income", "transfer"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSafeCategory(value: unknown) {
  return toNullableString(value) ?? defaultCategory;
}

function toSafeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || value > 1) {
    return null;
  }

  return value;
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && transactionTypes.includes(value as TransactionType);
}

function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getDigitLikeAmountTokens(text: string) {
  return text.match(/[+-]?\d+(?:\.\d+)?/g) ?? [];
}

function textContainsAmountToken(text: string, amount: number) {
  const absoluteAmount = Math.abs(amount);

  return getDigitLikeAmountTokens(text).some((token) => {
    const parsedToken = Number(token);
    return Number.isFinite(parsedToken) && Math.abs(Math.abs(parsedToken) - absoluteAmount) < 0.000001;
  });
}

function hasSensitiveLongNumber(text: string) {
  const hasChineseIdLikeText = /\d{17}[\dXx]/.test(text);
  const longDigitGroups = text.match(/\d[\d\s-]{13,}\d/g) ?? [];

  return (
    hasChineseIdLikeText ||
    longDigitGroups.some((group) => group.replace(/\D/g, "").length >= 15)
  );
}

export function getServerTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function validateParseRequestBody(body: unknown) {
  if (!isRecord(body)) {
    throw new InputValidationError("请求体必须是 JSON 对象。");
  }

  if (typeof body.text !== "string") {
    throw new InputValidationError("text 必须是字符串。");
  }

  const text = body.text;
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new InputValidationError("text 不能为空。");
  }

  if (text.length > maxTextLength) {
    throw new InputValidationError(`text 不能超过 ${maxTextLength} 个字符。`);
  }

  if (hasSensitiveLongNumber(text)) {
    throw new InputValidationError("输入中包含疑似银行卡号或身份证号，请删除敏感信息后再解析。");
  }

  return text;
}

export function parseAiJson(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("AI 返回内容不是有效 JSON。");
  }
}

export function sanitizeParsedTransaction(
  aiValue: unknown,
  rawText: string,
  todayIsoDate: string,
): ParsedTransaction {
  if (!isRecord(aiValue)) {
    throw new Error("AI 返回 JSON 必须是对象。");
  }

  const needsClarification = aiValue.needs_clarification === true;
  const amount = toFiniteNumber(aiValue.amount);
  const hasValidAmount = amount !== null && Number.isFinite(amount) && amount !== 0;
  const amountCameFromText = hasValidAmount ? textContainsAmountToken(rawText, amount) : false;
  const shouldClarify = needsClarification || !hasValidAmount || !amountCameFromText;
  const aiDate = toNullableString(aiValue.date);
  const safeDate = aiDate && isValidIsoDate(aiDate) ? aiDate : todayIsoDate;

  return {
    type: shouldClarify ? null : isTransactionType(aiValue.type) ? aiValue.type : "expense",
    amount: shouldClarify ? null : amount,
    currency: "CNY",
    category: shouldClarify ? defaultCategory : toSafeCategory(aiValue.category),
    tag: toNullableString(aiValue.tag),
    merchant: toNullableString(aiValue.merchant),
    payment_method: toNullableString(aiValue.payment_method),
    account: toNullableString(aiValue.account),
    date: safeDate,
    note: toNullableString(aiValue.note),
    raw_text: rawText,
    source: "ai",
    ai_confidence: shouldClarify ? null : toSafeConfidence(aiValue.ai_confidence),
    needs_clarification: shouldClarify,
  };
}
