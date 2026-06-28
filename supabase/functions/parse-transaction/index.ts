import { createClient } from "jsr:@supabase/supabase-js@2";

type TransactionType = "expense" | "income" | "transfer";

type ParsedTransaction = {
  type: TransactionType | null;
  amount: number | null;
  currency: "CNY";
  category: string;
  tag: string | null;
  merchant: string | null;
  payment_method: string | null;
  account: string | null;
  date: string;
  note: string | null;
  raw_text: string;
  source: "ai";
  ai_confidence: number | null;
  needs_clarification: boolean;
};

type ParsedTransactionBatch = {
  transactions: ParsedTransaction[];
  truncated: boolean;
  max_transactions: number;
  max_input_chars: number;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_CURRENCY = "CNY";
const DEFAULT_CATEGORY = "其他";
const MAX_PARSE_INPUT_CHARS = 3000;
const MAX_PARSED_TRANSACTIONS = 50;
const openAiDefaultBaseUrl = "https://api.openai.com/v1";
const openAiDefaultModel = "gpt-4o-mini";
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const defaultCategories = [
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
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

class ForbiddenEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenEmailError";
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOptionalEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  return value ? value : null;
}

function getRequiredEnv(name: string) {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new Error(`Missing ${name} in Edge Function secrets.`);
  }

  return value;
}

function getSupabasePublishableKey() {
  const key = getOptionalEnv("SUPABASE_PUBLISHABLE_KEY") ?? getOptionalEnv("SUPABASE_ANON_KEY");

  if (!key) {
    throw new Error("Missing SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY in Edge Function secrets.");
  }

  return key;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function verifySupabaseToken(accessToken: string) {
  const supabase = createClient(getRequiredEnv("SUPABASE_URL"), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

function getAllowedEmails() {
  return (getOptionalEnv("ALLOWED_EMAILS") ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function assertEmailAllowed(email: string | undefined) {
  const allowedEmails = getAllowedEmails();

  if (allowedEmails.length === 0) {
    throw new Error("Missing ALLOWED_EMAILS in Edge Function secrets.");
  }

  if (!email || !allowedEmails.includes(email.toLowerCase())) {
    throw new ForbiddenEmailError("当前账号不允许使用 AI 解析。");
  }
}

function isTransactionType(value: string): value is TransactionType {
  return value === "expense" || value === "income" || value === "transfer";
}

function isDefaultCategory(value: string) {
  return defaultCategories.includes(value.trim() as (typeof defaultCategories)[number]);
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

  return hasChineseIdLikeText || longDigitGroups.some((group) => group.replace(/\D/g, "").length >= 15);
}

function getServerTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validateParseRequestBody(body: unknown) {
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

function parseAiJson(content: string) {
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

function getCandidateRawText(aiValue: Record<string, unknown>, rawText: string) {
  const candidateRawText = toNullableString(aiValue.raw_text);

  if (candidateRawText && rawText.includes(candidateRawText)) {
    return candidateRawText;
  }

  return rawText;
}

function sanitizeParsedTransaction(
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

function sanitizeParsedTransactionsBatch(
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

function getOpenAiConfig() {
  const provider = getOptionalEnv("AI_PROVIDER") ?? "openai";

  if (provider !== "openai") {
    throw new Error("当前仅支持 AI_PROVIDER=openai。");
  }

  return {
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
    baseUrl: (getOptionalEnv("OPENAI_BASE_URL") ?? openAiDefaultBaseUrl).replace(/\/+$/, ""),
    model: getOptionalEnv("OPENAI_MODEL") ?? openAiDefaultModel,
  };
}

function buildParserPrompt(text: string, todayIsoDate: string) {
  return [
    {
      role: "system",
      content: [
        "You are a transaction parser for a personal bookkeeping app.",
        "Return strict JSON only. Do not include markdown, comments, or extra text.",
        "Parse only the current user input. Do not infer from history.",
        "Do not calculate summaries or statistics.",
        `Return at most ${MAX_PARSED_TRANSACTIONS} candidate transactions.`,
        "Return a JSON object with exactly one top-level key: transactions.",
        "transactions must be an array. Use an empty array only when no transaction-like item exists.",
        "The amount must come from the user input. Do not invent an amount.",
        "Amounts may be positive or negative. Preserve the sign if the user explicitly writes one.",
        "If there is no reliable amount, set needs_clarification to true and amount to null.",
        "For each transaction, raw_text must be the shortest original text fragment that supports that transaction.",
        "If you cannot split a fragment reliably, use the full input text as raw_text for that transaction.",
        "For dates: use dates explicitly present in the text.",
        `Resolve 今天 as ${todayIsoDate}. Resolve 昨天 and 前天 relative to ${todayIsoDate}.`,
        `If date is missing, use ${todayIsoDate}.`,
        "If the text contains month/day without a year, use the current server year only. Do not infer previous or next year across year boundaries.",
        "date must use YYYY-MM-DD.",
        "currency must be CNY.",
        "source must be ai.",
        `category must be one of these default categories only: ${defaultCategories.join(", ")}.`,
        "Classify the transaction into the closest default category. For example, coffee and meals should be 餐饮.",
        "If category is uncertain, use 其他.",
        "Optional missing fields must be null.",
        "Each transaction item must include keys: type, amount, currency, category, tag, merchant, payment_method, account, date, note, raw_text, source, ai_confidence, needs_clarification.",
        "type must be expense, income, or transfer when needs_clarification is false.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({ text, today: todayIsoDate }),
    },
  ];
}

async function parseTransactionWithAi(text: string, todayIsoDate: string) {
  const config = getOpenAiConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: buildParserPrompt(text, todayIsoDate),
      model: config.model,
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const responseBody = (await response.json().catch(() => null)) as OpenAiChatResponse | null;

  if (!response.ok) {
    throw new Error(responseBody?.error?.message ?? `AI request failed with status ${response.status}`);
  }

  const content = responseBody?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI 返回内容为空。");
  }

  return content.trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return errorResponse("只支持 POST 请求。", 405);
  }

  const token = getBearerToken(request);

  if (!token) {
    return errorResponse("请先登录后再解析账单。", 401);
  }

  try {
    const user = await verifySupabaseToken(token);

    if (!user) {
      return errorResponse("请先登录后再解析账单。", 401);
    }

    assertEmailAllowed(user.email);

    const body = (await request.json().catch(() => null)) as unknown;
    const text = validateParseRequestBody(body);
    const todayIsoDate = getServerTodayIsoDate();
    const aiContent = await parseTransactionWithAi(text, todayIsoDate);
    const aiJson = parseAiJson(aiContent);
    const result = sanitizeParsedTransactionsBatch(aiJson, text, todayIsoDate);

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof InputValidationError) {
      return errorResponse(error.message, 400);
    }

    if (error instanceof ForbiddenEmailError) {
      return errorResponse(error.message, 403);
    }

    return errorResponse(error instanceof Error ? error.message : "AI 解析失败。", 500);
  }
});
