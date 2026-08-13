import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  ForbiddenEmailError,
  assertEmailAllowed,
  getBearerToken,
  verifySupabaseToken,
} from "../_shared/auth.ts";
import { requestOpenAiChatContent } from "../_shared/aiClient.ts";
import { ChatIntentContractError } from "../_shared/chatIntent.ts";
import { runFoxChatFlow } from "../_shared/foxChatFlow.ts";
import { LedgerContractError } from "../_shared/ledgerContracts.ts";
import {
  InputValidationError,
  getServerTodayIsoDate,
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return errorResponse("只支持 POST 请求。", 405);
  }

  const token = getBearerToken(request);

  if (!token) {
    return errorResponse("请先登录后再使用狐狐。", 401);
  }

  try {
    const user = await verifySupabaseToken(token, createClient);

    if (!user) {
      return errorResponse("请先登录后再使用狐狐。", 401);
    }

    assertEmailAllowed(user.email);

    const body = (await request.json().catch(() => null)) as unknown;
    const todayIsoDate = getServerTodayIsoDate();
    const result = await runFoxChatFlow({
      accessToken: token,
      body,
      createClient,
      requestAi: (messages) =>
        requestOpenAiChatContent({
          messages,
          responseFormat: { type: "json_object" },
          temperature: 0.1,
        }),
      todayIsoDate,
      verifiedUserId: user.id,
    });

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof InputValidationError) {
      return errorResponse(error.message, 400);
    }

    if (error instanceof ForbiddenEmailError) {
      return errorResponse(error.message, 403);
    }

    if (error instanceof LedgerContractError) {
      return errorResponse(
        `AI 查询计划字段 ${error.path} 未通过安全校验，请重试。`,
        502,
      );
    }

    if (error instanceof ChatIntentContractError) {
      return errorResponse("AI 返回的意图结构不完整，请重试。", 502);
    }

    return errorResponse(error instanceof Error ? error.message : "狐狐暂时无法处理。", 500);
  }
});
