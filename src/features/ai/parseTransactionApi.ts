import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";

import type { ParsedTransactionBatch } from "@/features/ai/types";

export const MAX_PARSE_INPUT_CHARS = 3000;
export const MAX_PARSED_TRANSACTIONS = 50;

export async function parseTransactionsWithAi(text: string): Promise<ParsedTransactionBatch> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("请先登录后再解析账单。");
  }

  const parseTransactionApiUrl = `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1/parse-transaction`;
  const response = await fetch(parseTransactionApiUrl, {
    body: JSON.stringify({ text }),
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabasePublishableKey,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const responseBody = (await response.json().catch(() => null)) as
    | { error?: string }
    | ParsedTransactionBatch
    | null;

  if (!response.ok) {
    throw new Error(
      responseBody && "error" in responseBody && responseBody.error
        ? responseBody.error
        : "AI 解析失败。",
    );
  }

  if (!responseBody || !("transactions" in responseBody)) {
    throw new Error("AI API 返回格式异常。");
  }

  return responseBody;
}
