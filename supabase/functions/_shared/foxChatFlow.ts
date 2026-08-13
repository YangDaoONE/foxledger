import type { OpenAiChatMessage } from "./aiClient.ts";
import {
  runFoxChatFirstStage,
  type LedgerConversationContext,
} from "./chatIntent.ts";
import {
  capLedgerAiDetailsForRequest,
  runGroundedLedgerAnswer,
  type RenderedGroundedLedgerAnswer,
} from "./groundedLedgerAnswer.ts";
import {
  executeLedgerQueryPlan,
  type LedgerQueryExecutionResult,
  type LedgerReadClient,
} from "./ledgerRead.ts";
import type { SupabaseClientFactory } from "./auth.ts";
import type { EdgeEnvReader } from "./edgeEnv.ts";

export type FoxChatQueryResult = LedgerQueryExecutionResult & {
  answer: RenderedGroundedLedgerAnswer | null;
  answer_error: string | null;
  answer_status: "ready" | "unavailable";
  context: LedgerConversationContext;
  intent: "query_ledger";
};

export async function runFoxChatFlow(params: {
  accessToken: string;
  body: unknown;
  createClient: SupabaseClientFactory<LedgerReadClient>;
  readEnv?: EdgeEnvReader;
  requestAi: (messages: OpenAiChatMessage[]) => Promise<string>;
  todayIsoDate: string;
  verifiedUserId: string;
}) {
  const firstStage = await runFoxChatFirstStage({
    body: params.body,
    requestAi: params.requestAi,
    todayIsoDate: params.todayIsoDate,
  });

  if (firstStage.intent !== "query_ledger") {
    return firstStage;
  }

  const execution = capLedgerAiDetailsForRequest(await executeLedgerQueryPlan({
    accessToken: params.accessToken,
    createClient: params.createClient,
    plan: firstStage.plan,
    ...(params.readEnv ? { readEnv: params.readEnv } : {}),
    verifiedUserId: params.verifiedUserId,
  }));
  const context: LedgerConversationContext = {
    date_anchor: params.todayIsoDate,
    intent: "query_ledger",
    plan: execution.plan,
  };

  try {
    const answer = await runGroundedLedgerAnswer({
      execution,
      requestAi: params.requestAi,
    });

    return {
      ...execution,
      answer,
      answer_error: null,
      answer_status: "ready",
      context,
      intent: "query_ledger",
    } satisfies FoxChatQueryResult;
  } catch {
    return {
      ...execution,
      answer: null,
      answer_error: "统计已完成，但自然语言解释暂不可用。",
      answer_status: "unavailable",
      context,
      intent: "query_ledger",
    } satisfies FoxChatQueryResult;
  }
}
