import {
  MAX_PARSED_TRANSACTIONS,
  MAX_PARSE_INPUT_CHARS,
} from "@/lib/parseTransactionLimits";
import {
  DEFAULT_CATEGORY,
  DEFAULT_CURRENCY,
  isTransactionType,
  isValidIsoDate,
  normalizeDefaultCategory,
} from "@/lib/transactionRules";
import type {
  ParsedTransaction,
  ParsedTransactionBatch,
} from "@/types/transaction";

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

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
  return normalizeDefaultCategory(toNullableString(value));
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

function toIsoDate(year: number, month: number, day: number) {
  const isoDate = [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");

  return isValidIsoDate(isoDate) ? isoDate : null;
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function collectDatesFromText(text: string, todayIsoDate: string) {
  const dates: string[] = [];
  const fullDatePattern =
    /(?:^|[^\d])((?:19|20)\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日|号)?(?=$|[^\d])/g;
  const explicitMonthDayPattern =
    /(?:^|[^\d])(\d{1,2})(?:月|[./-])(\d{1,2})(?:日|号)(?=$|[^\d])/g;
  const plainMonthDayPattern =
    /(?:^|[\s,，.。;；:：、])(\d{1,2})(?:月|[./-])(\d{1,2})(?=$|[\s,，.。;；:：、])/g;

  for (const match of text.matchAll(fullDatePattern)) {
    const [, year, month, day] = match;
    const isoDate = toIsoDate(Number(year), Number(month), Number(day));

    if (isoDate && !dates.includes(isoDate)) {
      dates.push(isoDate);
    }
  }

  if (text.includes("前天")) {
    const isoDate = addDaysToIsoDate(todayIsoDate, -2);
    if (!dates.includes(isoDate)) {
      dates.push(isoDate);
    }
  }

  if (text.includes("昨天") || text.includes("昨日")) {
    const isoDate = addDaysToIsoDate(todayIsoDate, -1);
    if (!dates.includes(isoDate)) {
      dates.push(isoDate);
    }
  }

  if (text.includes("今天") || text.includes("今日")) {
    if (!dates.includes(todayIsoDate)) {
      dates.push(todayIsoDate);
    }
  }

  for (const match of text.matchAll(explicitMonthDayPattern)) {
    const [, month, day] = match;
    const year = Number(todayIsoDate.slice(0, 4));
    const isoDate = toIsoDate(year, Number(month), Number(day));

    if (isoDate && !dates.includes(isoDate)) {
      dates.push(isoDate);
    }
  }

  for (const match of text.matchAll(plainMonthDayPattern)) {
    const [, month, day] = match;
    const year = Number(todayIsoDate.slice(0, 4));
    const isoDate = toIsoDate(year, Number(month), Number(day));

    if (isoDate && !dates.includes(isoDate)) {
      dates.push(isoDate);
    }
  }

  return dates;
}

function resolveDateFromText(text: string, fullText: string, todayIsoDate: string) {
  const candidateDates = collectDatesFromText(text, todayIsoDate);

  if (candidateDates.length > 0) {
    return candidateDates[0];
  }

  const fullTextDates = collectDatesFromText(fullText, todayIsoDate);

  if (fullTextDates.length === 1) {
    return fullTextDates[0];
  }

  return todayIsoDate;
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

  if (text.length > MAX_PARSE_INPUT_CHARS) {
    throw new InputValidationError(`text 不能超过 ${MAX_PARSE_INPUT_CHARS} 个字符。`);
  }

  if (hasSensitiveLongNumber(text)) {
    throw new InputValidationError("输入中包含疑似银行卡号或身份证号，请删除敏感信息后再解析。");
  }

  return text;
}

export function parseAiJson(content: string) {
  const candidates = [
    content.trim(),
    extractJsonCodeBlock(content),
    extractFirstJsonObject(content),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next candidate. The final error stays intentionally generic.
    }
  }

  throw new Error("AI 返回内容不是有效 JSON。");
}

function extractJsonCodeBlock(content: string) {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? null;
}

function extractFirstJsonObject(content: string) {
  const start = content.indexOf("{");

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return content.slice(start, index + 1).trim();
      }
    }
  }

  return null;
}

function getCandidateRawText(aiValue: Record<string, unknown>, rawText: string) {
  const candidateRawText = toNullableString(aiValue.raw_text);

  if (candidateRawText && rawText.includes(candidateRawText)) {
    return candidateRawText;
  }

  return rawText;
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
  const candidateRawText = getCandidateRawText(aiValue, rawText);
  const amount = toFiniteNumber(aiValue.amount);
  const hasValidAmount = amount !== null && Number.isFinite(amount) && amount !== 0;
  const amountCameFromText = hasValidAmount ? textContainsAmountToken(candidateRawText, amount) : false;
  const shouldClarify = needsClarification || !hasValidAmount || !amountCameFromText;
  const safeDate = resolveDateFromText(candidateRawText, rawText, todayIsoDate);
  const safeType =
    typeof aiValue.type === "string" && isTransactionType(aiValue.type) ? aiValue.type : "expense";

  return {
    type: shouldClarify ? null : safeType,
    amount: shouldClarify ? null : amount,
    currency: DEFAULT_CURRENCY,
    category: shouldClarify ? DEFAULT_CATEGORY : toSafeCategory(aiValue.category),
    tag: toNullableString(aiValue.tag),
    merchant: toNullableString(aiValue.merchant),
    payment_method: toNullableString(aiValue.payment_method),
    account: toNullableString(aiValue.account),
    date: safeDate,
    note: toNullableString(aiValue.note),
    raw_text: candidateRawText,
    source: "ai",
    ai_confidence: shouldClarify ? null : toSafeConfidence(aiValue.ai_confidence),
    needs_clarification: shouldClarify,
  };
}

export function sanitizeParsedTransactionsBatch(
  aiValue: unknown,
  rawText: string,
  todayIsoDate: string,
): ParsedTransactionBatch {
  if (!isRecord(aiValue)) {
    throw new Error("AI 返回 JSON 必须是对象。");
  }

  if (!Array.isArray(aiValue.transactions)) {
    throw new Error("AI 返回 JSON 必须包含 transactions 数组。");
  }

  const slicedTransactions = aiValue.transactions.slice(0, MAX_PARSED_TRANSACTIONS);

  return {
    transactions: slicedTransactions.map((transaction) =>
      sanitizeParsedTransaction(transaction, rawText, todayIsoDate),
    ),
    truncated: aiValue.transactions.length > MAX_PARSED_TRANSACTIONS,
    max_transactions: MAX_PARSED_TRANSACTIONS,
    max_input_chars: MAX_PARSE_INPUT_CHARS,
  };
}
