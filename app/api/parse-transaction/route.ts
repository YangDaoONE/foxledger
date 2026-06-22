import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseTransactionWithAi } from "@/lib/ai";
import {
  getServerTodayIsoDate,
  InputValidationError,
  parseAiJson,
  sanitizeParsedTransaction,
  validateParseRequestBody,
} from "@/lib/validators";

function errorResponse(message: string, status: 400 | 401 | 500) {
  return NextResponse.json({ error: message }, { status });
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
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

export async function POST(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return errorResponse("请先登录后再解析账单。", 401);
  }

  try {
    const user = await verifySupabaseToken(token);

    if (!user) {
      return errorResponse("请先登录后再解析账单。", 401);
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const text = validateParseRequestBody(body);
    const todayIsoDate = getServerTodayIsoDate();
    const aiContent = await parseTransactionWithAi(text, todayIsoDate);
    const aiJson = parseAiJson(aiContent);
    const result = sanitizeParsedTransaction(aiJson, text, todayIsoDate);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InputValidationError) {
      return errorResponse(error.message, 400);
    }

    return errorResponse(error instanceof Error ? error.message : "AI 解析失败。", 500);
  }
}
