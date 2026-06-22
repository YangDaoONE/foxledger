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
        "The amount must come from the user input. Do not invent an amount.",
        "Amounts may be positive or negative. Preserve the sign if the user explicitly writes one.",
        "If there is no reliable amount, set needs_clarification to true and amount to null.",
        `If date is missing or uncertain, use ${todayIsoDate}.`,
        "date must use YYYY-MM-DD.",
        "currency must be CNY.",
        "source must be ai.",
        "If category is uncertain, use 其他.",
        "Optional missing fields must be null.",
        "Return keys: type, amount, currency, category, tag, merchant, payment_method, account, date, note, raw_text, source, ai_confidence, needs_clarification.",
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
