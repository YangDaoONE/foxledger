import { MAX_PARSED_TRANSACTIONS } from "@/lib/parseTransactionLimits";

const openAiDefaultBaseUrl = "https://api.openai.com/v1";
const openAiDefaultModel = "gpt-4o-mini";

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

function getOpenAiConfig() {
  const provider = process.env.AI_PROVIDER ?? "openai";

  if (provider !== "openai") {
    throw new Error("当前仅支持 AI_PROVIDER=openai。");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in .env.local");
  }

  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL ?? openAiDefaultBaseUrl).replace(/\/+$/, ""),
    model: process.env.OPENAI_MODEL ?? openAiDefaultModel,
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

export async function parseTransactionWithAi(text: string, todayIsoDate: string) {
  const config = getOpenAiConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildParserPrompt(text, todayIsoDate),
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
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
