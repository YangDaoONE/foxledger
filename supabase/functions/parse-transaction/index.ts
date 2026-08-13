import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  ForbiddenEmailError,
  assertEmailAllowed,
  getBearerToken,
  verifySupabaseToken,
} from "../_shared/auth.ts";
import {
  requestOpenAiChatContent,
  type OpenAiChatMessage,
} from "../_shared/aiClient.ts";
import {
  DEFAULT_CATEGORIES,
  InputValidationError,
  MAX_PARSED_TRANSACTIONS,
  getServerTodayIsoDate,
  parseAiJson,
  sanitizeParsedTransactionsBatch,
  validateAiTextRequestBody,
} from "../_shared/transactionSanitizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

function buildParserPrompt(text: string, todayIsoDate: string): OpenAiChatMessage[] {
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
        `category must be one of these default categories only: ${DEFAULT_CATEGORIES.join(", ")}.`,
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
  return requestOpenAiChatContent({
    messages: buildParserPrompt(text, todayIsoDate),
    responseFormat: { type: "json_object" },
    temperature: 0.1,
  });
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
    const user = await verifySupabaseToken(token, createClient);

    if (!user) {
      return errorResponse("请先登录后再解析账单。", 401);
    }

    assertEmailAllowed(user.email);

    const body = (await request.json().catch(() => null)) as unknown;
    const text = validateAiTextRequestBody(body);
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
