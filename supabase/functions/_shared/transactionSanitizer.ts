export type TransactionType = "expense" | "income" | "transfer";

export type ParsedTransaction = {
  account: string | null;
  ai_confidence: number | null;
  amount: number | null;
  category: string;
  currency: "CNY";
  date: string;
  merchant: string | null;
  needs_clarification: boolean;
  note: string | null;
  payment_method: string | null;
  raw_text: string;
  source: "ai";
  tag: string | null;
  type: TransactionType | null;
};

export type ParsedTransactionBatch = {
  max_input_chars: number;
  max_transactions: number;
  transactions: ParsedTransaction[];
  truncated: boolean;
};

export const DEFAULT_CURRENCY = "CNY";
export const DEFAULT_CATEGORY = "其他";
export const MAX_PARSE_INPUT_CHARS = 3000;
export const MAX_PARSED_TRANSACTIONS = 50;
export const DEFAULT_CATEGORIES = [
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

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTransactionType(value: string): value is TransactionType {
  return value === "expense" || value === "income" || value === "transfer";
}

function isDefaultCategory(value: string) {
  return DEFAULT_CATEGORIES.includes(
    value.trim() as (typeof DEFAULT_CATEGORIES)[number],
  );
}

function normalizeDefaultCategory(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return isDefaultCategory(trimmed) ? trimmed : DEFAULT_CATEGORY;
}

function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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

type TransactionTextEvidence = {
  amountTokens: number[];
  date: string;
  needsClarification: boolean;
  resolvedAmount: number | null;
  text: string;
};

type BareCompactDate = {
  amountValue: number | null;
  date: string;
  matchedLength: number;
  separator: "." | "/" | "-";
};

function collectStrongDatesFromText(text: string, todayIsoDate: string) {
  const dates: string[] = [];
  const fullDatePattern =
    /(?:^|[^\d])((?:19|20)\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日|号)?(?=$|[^\d])/g;
  const monthDayPattern =
    /(?:^|[^\d])(\d{1,2})月(\d{1,2})(?:日|号)?(?=$|[^\d])/g;
  const delimitedMonthDayWithMarkerPattern =
    /(?:^|[^\d])(\d{1,2})[./-](\d{1,2})(?:日|号)(?=$|[^\d])/g;

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

  for (const match of text.matchAll(monthDayPattern)) {
    const [, month, day] = match;
    const year = Number(todayIsoDate.slice(0, 4));
    const isoDate = toIsoDate(year, Number(month), Number(day));

    if (isoDate && !dates.includes(isoDate)) {
      dates.push(isoDate);
    }
  }

  for (const match of text.matchAll(delimitedMonthDayWithMarkerPattern)) {
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
  const candidateDates = collectStrongDatesFromText(text, todayIsoDate);

  if (candidateDates.length > 0) {
    return candidateDates[0];
  }

  const fullTextDates = collectStrongDatesFromText(fullText, todayIsoDate);

  if (fullTextDates.length === 1) {
    return fullTextDates[0];
  }

  return todayIsoDate;
}

function removeStrongDateExpressions(text: string) {
  return text
    .replace(
      /(^|[^\d])((?:19|20)\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日|号)?(?=$|[^\d])/g,
      "$1",
    )
    .replace(
      /(^|[^\d])(\d{1,2})月(\d{1,2})(?:日|号)?(?=$|[^\d])/g,
      "$1",
    )
    .replace(
      /(^|[^\d])(\d{1,2})[./-](\d{1,2})(?:日|号)(?=$|[^\d])/g,
      "$1",
    )
    .replace(/今天|今日|昨天|昨日|前天/g, "");
}

function getDigitLikeAmountTokens(text: string) {
  return removeStrongDateExpressions(text).match(/[+-]?\d+(?:\.\d+)?/g) ?? [];
}

function parseAmountTokens(text: string) {
  return getDigitLikeAmountTokens(text)
    .map((token) => Math.abs(Number(token)))
    .filter((amount) => Number.isFinite(amount));
}

function findBareCompactDate(
  dateFreeText: string,
  todayIsoDate: string,
): BareCompactDate | null {
  const match = /^\s*(\d{1,2})([./-])(\d{1,2})(?!\d)(?!\s*[元块角分])/.exec(
    dateFreeText,
  );

  if (!match) {
    return null;
  }

  const [, month, separator, day] = match;
  const date = toIsoDate(
    Number(todayIsoDate.slice(0, 4)),
    Number(month),
    Number(day),
  );

  if (!date) {
    return null;
  }

  return {
    amountValue: separator === "." ? Number(`${month}.${day}`) : null,
    date,
    matchedLength: match[0].length,
    separator: separator as BareCompactDate["separator"],
  };
}

function isDateOnlyFragment(fragment: string) {
  return removeStrongDateExpressions(fragment)
    .replace(/[\s,，.。;；:：、]/g, "")
    .length === 0;
}

function analyzeTransactionText(
  rawText: string,
  todayIsoDate: string,
): TransactionTextEvidence[] {
  const fragments = rawText
    .split(/[\n,，;；:：、]+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  const evidence: TransactionTextEvidence[] = [];
  let activeDate: { date: string; locked: boolean } | null = null;

  for (const fragment of fragments) {
    const strongDates = collectStrongDatesFromText(fragment, todayIsoDate);

    if (strongDates.length === 1 && isDateOnlyFragment(fragment)) {
      activeDate = { date: strongDates[0], locked: true };
      continue;
    }

    let needsClarification = strongDates.length > 1;
    const localStrongDate = strongDates[0] ?? null;
    let resolvedDate: string | null = localStrongDate ?? activeDate?.date ?? null;
    let inferredCompactDate: string | null = null;
    let resolvedAmount: number | null = null;
    const dateFreeText = removeStrongDateExpressions(fragment);
    const compactDate = findBareCompactDate(dateFreeText, todayIsoDate);
    let amountTokens: number[];

    if (compactDate) {
      const remainingText = dateFreeText.slice(compactDate.matchedLength);
      const remainingAmounts = parseAmountTokens(remainingText);
      const compactIsContextualAmount =
        compactDate.separator === "." &&
        remainingAmounts.length === 0 &&
        resolvedDate !== null;

      if (compactIsContextualAmount) {
        resolvedAmount = compactDate.amountValue;
        amountTokens = resolvedAmount === null ? [] : [resolvedAmount];
      } else if (
        compactDate.separator === "." &&
        remainingAmounts.length === 0 &&
        resolvedDate === null
      ) {
        amountTokens = [];
        needsClarification = true;
      } else {
        inferredCompactDate = compactDate.date;
        amountTokens = remainingAmounts;

        const conflictsWithLocalStrongDate =
          localStrongDate !== null && localStrongDate !== inferredCompactDate;
        const conflictsWithLockedDateScope =
          localStrongDate === null &&
          activeDate?.locked === true &&
          activeDate.date !== inferredCompactDate;

        if (conflictsWithLocalStrongDate || conflictsWithLockedDateScope) {
          needsClarification = true;
        } else {
          resolvedDate = inferredCompactDate;
        }
      }
    } else {
      amountTokens = parseAmountTokens(dateFreeText);
    }

    if (strongDates.length === 1) {
      activeDate = { date: strongDates[0], locked: false };
    } else if (inferredCompactDate && !needsClarification) {
      activeDate = { date: inferredCompactDate, locked: false };
    }

    evidence.push({
      amountTokens,
      date: resolvedDate ?? todayIsoDate,
      needsClarification,
      resolvedAmount,
      text: fragment,
    });
  }

  return evidence;
}

function textContainsAmountToken(text: string, amount: number) {
  const absoluteAmount = Math.abs(amount);

  return getDigitLikeAmountTokens(text).some((token) => {
    const parsedToken = Number(token);
    return (
      Number.isFinite(parsedToken) &&
      Math.abs(Math.abs(parsedToken) - absoluteAmount) < 0.000001
    );
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
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date());
}

export function validateAiTextRequestBody(body: unknown) {
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
    throw new InputValidationError(
      "输入中包含疑似银行卡号或身份证号，请删除敏感信息后再解析。",
    );
  }

  return text;
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
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
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

function getCandidateRawText(
  aiValue: Record<string, unknown>,
  rawText: string,
  evidence: TransactionTextEvidence | null,
) {
  if (evidence) {
    return evidence.text;
  }

  const candidateRawText = toNullableString(aiValue.raw_text);

  if (candidateRawText && rawText.includes(candidateRawText)) {
    return candidateRawText;
  }

  return rawText;
}

function amountsMatch(left: number, right: number) {
  return Math.abs(Math.abs(left) - Math.abs(right)) < 0.000001;
}

function selectTransactionEvidence(
  aiValue: unknown,
  evidence: TransactionTextEvidence[],
  usedEvidenceIndexes: Set<number>,
) {
  if (!isRecord(aiValue)) {
    return null;
  }

  const available = evidence
    .map((item, index) => ({ index, item }))
    .filter(({ index }) => !usedEvidenceIndexes.has(index));
  const candidateRawText = toNullableString(aiValue.raw_text);

  if (candidateRawText) {
    const sourceMatches = available.filter(
      ({ item }) =>
        item.text.includes(candidateRawText) || candidateRawText.includes(item.text),
    );

    if (sourceMatches.length === 1) {
      return sourceMatches[0];
    }
  }

  const amount = toFiniteNumber(aiValue.amount);

  if (amount !== null) {
    const amountMatches = available.filter(({ item }) =>
      item.amountTokens.some((token) => amountsMatch(token, amount)),
    );

    if (amountMatches.length === 1) {
      return amountMatches[0];
    }
  }

  return available.length === 1 ? available[0] : null;
}

function sanitizeParsedTransactionWithEvidence(
  aiValue: unknown,
  rawText: string,
  todayIsoDate: string,
  evidence: TransactionTextEvidence | null,
  forceClarification: boolean,
): ParsedTransaction {
  if (!isRecord(aiValue)) {
    throw new Error("AI 返回 JSON 必须是对象。");
  }

  const evidenceAmount = evidence?.resolvedAmount ?? null;
  const modelNeedsClarification = aiValue.needs_clarification === true;
  const needsClarification =
    evidenceAmount !== null && !evidence?.needsClarification
      ? false
      : modelNeedsClarification;
  const candidateRawText = getCandidateRawText(aiValue, rawText, evidence);
  const amount = evidenceAmount ?? toFiniteNumber(aiValue.amount);
  const hasValidAmount = amount !== null && Number.isFinite(amount) && amount !== 0;
  const normalizedAmount = amount === null ? null : Math.abs(amount);
  const amountCameFromText = hasValidAmount
    ? evidence
      ? evidence.amountTokens.some((token) => amountsMatch(token, amount))
      : textContainsAmountToken(candidateRawText, amount)
    : false;
  const shouldClarify =
    forceClarification ||
    evidence?.needsClarification === true ||
    needsClarification ||
    !hasValidAmount ||
    !amountCameFromText;
  const safeDate =
    evidence?.date ?? resolveDateFromText(candidateRawText, rawText, todayIsoDate);
  const safeType =
    typeof aiValue.type === "string" && isTransactionType(aiValue.type)
      ? aiValue.type
      : "expense";

  return {
    account: toNullableString(aiValue.account),
    ai_confidence: shouldClarify ? null : toSafeConfidence(aiValue.ai_confidence),
    amount: shouldClarify ? null : normalizedAmount,
    category: shouldClarify ? DEFAULT_CATEGORY : toSafeCategory(aiValue.category),
    currency: DEFAULT_CURRENCY,
    date: safeDate,
    merchant: toNullableString(aiValue.merchant),
    needs_clarification: shouldClarify,
    note: toNullableString(aiValue.note),
    payment_method: toNullableString(aiValue.payment_method),
    raw_text: candidateRawText,
    source: "ai",
    tag: toNullableString(aiValue.tag),
    type: shouldClarify ? null : safeType,
  };
}

export function sanitizeParsedTransaction(
  aiValue: unknown,
  rawText: string,
  todayIsoDate: string,
): ParsedTransaction {
  const evidence = analyzeTransactionText(rawText, todayIsoDate);
  const selected = selectTransactionEvidence(aiValue, evidence, new Set<number>());

  return sanitizeParsedTransactionWithEvidence(
    aiValue,
    rawText,
    todayIsoDate,
    selected?.item ?? null,
    evidence.length > 1 && !selected,
  );
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
  const evidence = analyzeTransactionText(rawText, todayIsoDate);
  const usedEvidenceIndexes = new Set<number>();

  return {
    max_input_chars: MAX_PARSE_INPUT_CHARS,
    max_transactions: MAX_PARSED_TRANSACTIONS,
    transactions: slicedTransactions.map((transaction) => {
      const selected = selectTransactionEvidence(
        transaction,
        evidence,
        usedEvidenceIndexes,
      );

      if (selected) {
        usedEvidenceIndexes.add(selected.index);
      }

      return sanitizeParsedTransactionWithEvidence(
        transaction,
        rawText,
        todayIsoDate,
        selected?.item ?? null,
        evidence.length > 1 && !selected,
      );
    }),
    truncated: aiValue.transactions.length > MAX_PARSED_TRANSACTIONS,
  };
}
