import type { ParsedTransactionBatch } from "@/features/ai/types";
import { MAX_FOX_CHAT_INPUT_CHARS } from "@/features/chat/foxChatConstants";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type {
  ForcedChatIntent,
  LedgerConversationContext,
} from "@shared/chatIntent";
import {
  LEDGER_QUERY_CATEGORIES,
  LEDGER_TRANSACTION_TYPES,
  isLedgerIsoDate,
  parseLedgerQueryPlan,
  parseLedgerStatsEnvelope,
  type LedgerQueryPlan,
} from "@shared/ledgerContracts";
import type { RenderedGroundedLedgerAnswer } from "@shared/groundedLedgerAnswer";
import type { LedgerQueryOperationResult } from "@shared/ledgerRead";

export { MAX_FOX_CHAT_INPUT_CHARS };

export type FoxChatQueryClientResult = {
  answer: RenderedGroundedLedgerAnswer | null;
  answer_error: string | null;
  answer_status: "ready" | "unavailable";
  context: LedgerConversationContext;
  intent: "query_ledger";
  operations: LedgerQueryOperationResult[];
  plan: LedgerQueryPlan;
};

export type FoxChatClientResult =
  | { intent: "record_transaction"; ledger_result: ParsedTransactionBatch }
  | FoxChatQueryClientResult
  | {
      clarification_key:
        | "intent_ambiguous"
        | "missing_transaction_details"
        | "missing_query_scope";
      intent: "clarify";
    }
  | {
      intent: "unsupported";
      reason_key:
        | "not_ledger_related"
        | "general_chat"
        | "financial_advice"
        | "unsupported_capability";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAiDetails(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("问账明细格式异常。");
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error("问账明细格式异常。");
    }

    const keys = Object.keys(item).sort();

    if (
      keys.join(",") !== "amount,category,date,merchant,type" ||
      typeof item.amount !== "number" ||
      !Number.isFinite(item.amount) ||
      item.amount < 0 ||
      typeof item.date !== "string" ||
      !isLedgerIsoDate(item.date) ||
      typeof item.category !== "string" ||
      !LEDGER_QUERY_CATEGORIES.includes(
        item.category as (typeof LEDGER_QUERY_CATEGORIES)[number],
      ) ||
      typeof item.type !== "string" ||
      !LEDGER_TRANSACTION_TYPES.includes(
        item.type as (typeof LEDGER_TRANSACTION_TYPES)[number],
      ) ||
      (item.merchant !== null && typeof item.merchant !== "string")
    ) {
      throw new Error("问账明细格式异常。");
    }

    return item as LedgerQueryOperationResult["aiDetails"][number];
  });
}

function parseQueryOperationResult(value: unknown): LedgerQueryOperationResult {
  if (!isRecord(value)) {
    throw new Error("问账统计格式异常。");
  }

  const aiDetails = parseAiDetails(value.aiDetails);
  const aiDetailCount = value.aiDetailCount;
  const matchedTransactionCount = value.matchedTransactionCount;

  if (
    typeof aiDetailCount !== "number" ||
    !Number.isInteger(aiDetailCount) ||
    aiDetailCount < 0 ||
    aiDetailCount !== aiDetails.length ||
    typeof matchedTransactionCount !== "number" ||
    !Number.isInteger(matchedTransactionCount) ||
    matchedTransactionCount < 0 ||
    typeof value.aiDetailsTruncated !== "boolean" ||
    aiDetailCount > matchedTransactionCount ||
    (!value.aiDetailsTruncated && aiDetailCount !== matchedTransactionCount)
  ) {
    throw new Error("问账统计数量格式异常。");
  }

  const result: LedgerQueryOperationResult = {
    aiDetailCount,
    aiDetails,
    aiDetailsTruncated: value.aiDetailsTruncated,
    matchedTransactionCount,
    stats: parseLedgerStatsEnvelope(value.stats),
  };

  if (value.compareStats !== undefined) {
    result.compareStats = parseLedgerStatsEnvelope(value.compareStats);
  }

  return result;
}

function parseRenderedAnswer(value: unknown): RenderedGroundedLedgerAnswer {
  if (!isRecord(value)) {
    throw new Error("问账回答格式异常。");
  }

  if (
    typeof value.text !== "string" ||
    value.text.trim().length === 0 ||
    !Array.isArray(value.metricRefs) ||
    !value.metricRefs.every((item) => typeof item === "string") ||
    !Array.isArray(value.evidenceRefs) ||
    !value.evidenceRefs.every((item) => typeof item === "string") ||
    (value.suggestion !== null &&
      (typeof value.suggestion !== "string" || value.suggestion.trim().length === 0))
  ) {
    throw new Error("问账回答格式异常。");
  }

  return value as RenderedGroundedLedgerAnswer;
}

function parseFoxChatResponse(value: unknown): FoxChatClientResult {
  if (!isRecord(value) || typeof value.intent !== "string") {
    throw new Error("狐狐 API 返回格式异常。");
  }

  if (value.intent === "record_transaction") {
    if (!isRecord(value.ledger_result) || !Array.isArray(value.ledger_result.transactions)) {
      throw new Error("记账候选格式异常。");
    }

    return value as FoxChatClientResult;
  }

  if (value.intent === "query_ledger") {
    if (!Array.isArray(value.operations) || !isRecord(value.context)) {
      throw new Error("问账结果格式异常。");
    }

    const plan = parseLedgerQueryPlan(value.plan);
    const contextPlan = parseLedgerQueryPlan(value.context.plan);
    const answerStatus = value.answer_status;

    if (
      value.context.intent !== "query_ledger" ||
      typeof value.context.date_anchor !== "string" ||
      !isLedgerIsoDate(value.context.date_anchor) ||
      JSON.stringify(contextPlan) !== JSON.stringify(plan) ||
      (answerStatus !== "ready" && answerStatus !== "unavailable")
    ) {
      throw new Error("问账上下文格式异常。");
    }

    const operations = value.operations.map(parseQueryOperationResult);
    const answer = value.answer === null ? null : parseRenderedAnswer(value.answer);
    const answerError =
      typeof value.answer_error === "string" ? value.answer_error : null;

    if (
      operations.length !== plan.operations.length ||
      operations.reduce((total, operation) => total + operation.aiDetailCount, 0) > 500 ||
      (answerStatus === "ready" && !answer) ||
      (answerStatus === "unavailable" && answer !== null) ||
      (answerStatus === "ready" && value.answer_error !== null) ||
      (answerStatus === "unavailable" && typeof value.answer_error !== "string")
    ) {
      throw new Error("问账回答状态异常。");
    }

    return {
      answer,
      answer_error: answerError,
      answer_status: answerStatus,
      context: {
        date_anchor: value.context.date_anchor,
        intent: "query_ledger",
        plan: contextPlan,
      },
      intent: "query_ledger",
      operations,
      plan,
    };
  }

  if (value.intent === "clarify") {
    if (
      value.clarification_key !== "intent_ambiguous" &&
      value.clarification_key !== "missing_transaction_details" &&
      value.clarification_key !== "missing_query_scope"
    ) {
      throw new Error("澄清结果格式异常。");
    }

    return value as FoxChatClientResult;
  }

  if (value.intent === "unsupported") {
    if (
      value.reason_key !== "not_ledger_related" &&
      value.reason_key !== "general_chat" &&
      value.reason_key !== "financial_advice" &&
      value.reason_key !== "unsupported_capability"
    ) {
      throw new Error("不支持结果格式异常。");
    }

    return value as FoxChatClientResult;
  }

  throw new Error("狐狐 API 返回了未知意图。");
}

export async function sendFoxChatMessage(params: {
  forcedIntent?: ForcedChatIntent;
  ledgerId: string;
  previousContext: LedgerConversationContext | null;
  text: string;
}): Promise<FoxChatClientResult> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("请先登录后再使用狐狐。");
  }

  const foxChatApiUrl = `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1/fox-chat`;
  const response = await fetch(foxChatApiUrl, {
    body: JSON.stringify({
      ...(params.forcedIntent ? { forced_intent: params.forcedIntent } : {}),
      ledger_id: params.ledgerId,
      previous_context: params.previousContext,
      text: params.text,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabasePublishableKey,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      isRecord(responseBody) && typeof responseBody.error === "string"
        ? responseBody.error
        : "狐狐暂时无法处理这次输入。",
    );
  }

  return parseFoxChatResponse(responseBody);
}
