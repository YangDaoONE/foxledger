import {
  getOptionalEdgeEnv,
  getRequiredEdgeEnv,
  readRuntimeEnv,
  type EdgeEnvReader,
} from "./edgeEnv.ts";

export type OpenAiChatMessage = {
  content: string;
  role: "assistant" | "system" | "user";
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

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_DEFAULT_TIMEOUT_MS = 30000;

export function getOpenAiConfig(readEnv: EdgeEnvReader = readRuntimeEnv) {
  const provider = getOptionalEdgeEnv("AI_PROVIDER", readEnv) ?? "openai";

  if (provider !== "openai") {
    throw new Error("当前仅支持 AI_PROVIDER=openai。");
  }

  return {
    apiKey: getRequiredEdgeEnv("OPENAI_API_KEY", readEnv),
    baseUrl: (
      getOptionalEdgeEnv("OPENAI_BASE_URL", readEnv) ?? OPENAI_DEFAULT_BASE_URL
    ).replace(/\/+$/, ""),
    model: getOptionalEdgeEnv("OPENAI_MODEL", readEnv) ?? OPENAI_DEFAULT_MODEL,
  };
}

export async function requestOpenAiChatContent(params: {
  fetchImpl?: typeof fetch;
  messages: OpenAiChatMessage[];
  readEnv?: EdgeEnvReader;
  responseFormat?: { type: "json_object" };
  temperature?: number;
  timeoutMs?: number;
}) {
  const config = getOpenAiConfig(params.readEnv);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? OPENAI_DEFAULT_TIMEOUT_MS,
  );
  let response: Response;

  try {
    response = await (params.fetchImpl ?? fetch)(`${config.baseUrl}/chat/completions`, {
      body: JSON.stringify({
        messages: params.messages,
        model: config.model,
        response_format: params.responseFormat,
        temperature: params.temperature ?? 0.1,
      }),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI 请求超时，请稍后重试。");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const responseBody = (await response.json().catch(() => null)) as OpenAiChatResponse | null;

  if (!response.ok) {
    throw new Error(
      responseBody?.error?.message ?? `AI request failed with status ${response.status}`,
    );
  }

  const content = responseBody?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI 返回内容为空。");
  }

  return content.trim();
}
