import type { OpenAiChatMessage } from "./aiClient.ts";
import {
  isLedgerIsoDate,
  parseLedgerQueryPlan,
  type LedgerQueryPlan,
} from "./ledgerContracts.ts";
import {
  DEFAULT_CATEGORIES,
  InputValidationError,
  MAX_PARSED_TRANSACTIONS,
  isRecord,
  parseAiJson,
  sanitizeParsedTransactionsBatch,
  validateAiTextRequestBody,
  type ParsedTransactionBatch,
} from "./transactionSanitizer.ts";

export const FORCED_CHAT_INTENTS = ["record_transaction", "query_ledger"] as const;
export const CHAT_CLARIFICATION_KEYS = [
  "intent_ambiguous",
  "missing_transaction_details",
  "missing_query_scope",
] as const;
export const CHAT_UNSUPPORTED_REASON_KEYS = [
  "not_ledger_related",
  "general_chat",
  "financial_advice",
  "unsupported_capability",
] as const;

export type ForcedChatIntent = (typeof FORCED_CHAT_INTENTS)[number];
export type ChatClarificationKey = (typeof CHAT_CLARIFICATION_KEYS)[number];
export type ChatUnsupportedReasonKey = (typeof CHAT_UNSUPPORTED_REASON_KEYS)[number];

export type LedgerConversationContext = {
  date_anchor: string;
  intent: "query_ledger";
  plan: LedgerQueryPlan;
};

export type FoxChatRequest = {
  forced_intent?: ForcedChatIntent;
  previous_context: LedgerConversationContext | null;
  text: string;
};

export type FoxChatFirstStageResult =
  | { intent: "record_transaction"; ledger_result: ParsedTransactionBatch }
  | { intent: "query_ledger"; plan: LedgerQueryPlan }
  | { clarification_key: ChatClarificationKey; intent: "clarify" }
  | { intent: "unsupported"; reason_key: ChatUnsupportedReasonKey };

export class ChatIntentContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatIntentContractError";
  }
}

function readStrictObject(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
) {
  if (!isRecord(value)) {
    throw new ChatIntentContractError(`${path} 必须是对象。`);
  }

  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw new ChatIntentContractError(
      `${path} 包含未知字段：${unknownKeys.join(", ")}。`,
    );
  }

  return value;
}

function readEnum<const Values extends readonly string[]>(
  value: unknown,
  path: string,
  values: Values,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new ChatIntentContractError(`${path} 不是允许的值。`);
  }

  return value as Values[number];
}

export function parseLedgerConversationContext(
  value: unknown,
): LedgerConversationContext {
  const context = readStrictObject(value, "request.previous_context", [
    "date_anchor",
    "intent",
    "plan",
  ]);

  if (context.intent !== "query_ledger") {
    throw new ChatIntentContractError(
      "request.previous_context.intent 不是允许的值。",
    );
  }

  if (
    typeof context.date_anchor !== "string" ||
    !isLedgerIsoDate(context.date_anchor)
  ) {
    throw new ChatIntentContractError(
      "request.previous_context.date_anchor 必须是有效的 YYYY-MM-DD 日期。",
    );
  }

  return {
    date_anchor: context.date_anchor,
    intent: "query_ledger",
    plan: parseLedgerQueryPlan(context.plan),
  };
}

export function validateFoxChatRequestBody(body: unknown): FoxChatRequest {
  let request: Record<string, unknown>;

  try {
    request = readStrictObject(body, "request", [
      "forced_intent",
      "previous_context",
      "text",
    ]);
  } catch (error) {
    throw new InputValidationError(
      error instanceof Error ? error.message : "请求体不正确。",
    );
  }
  const text = validateAiTextRequestBody(request);

  const result: FoxChatRequest = {
    previous_context: null,
    text,
  };

  if (request.previous_context !== undefined && request.previous_context !== null) {
    try {
      result.previous_context = parseLedgerConversationContext(
        request.previous_context,
      );
    } catch (error) {
      throw new InputValidationError(
        error instanceof Error ? error.message : "previous_context 不正确。",
      );
    }
  }

  if (request.forced_intent !== undefined) {
    try {
      result.forced_intent = readEnum(
        request.forced_intent,
        "request.forced_intent",
        FORCED_CHAT_INTENTS,
      );
    } catch (error) {
      throw new InputValidationError(
        error instanceof Error ? error.message : "forced_intent 不正确。",
      );
    }
  }

  return result;
}

export function parseFoxChatIntentResult(params: {
  aiValue: unknown;
  forcedIntent?: ForcedChatIntent;
  rawText: string;
  todayIsoDate: string;
}): FoxChatFirstStageResult {
  const result = readStrictObject(params.aiValue, "intent_result", [
    "clarification_key",
    "intent",
    "plan",
    "reason_key",
    "transactions",
  ]);
  const intent = readEnum(result.intent, "intent_result.intent", [
    "record_transaction",
    "query_ledger",
    "clarify",
    "unsupported",
  ] as const);

  if (params.forcedIntent && intent !== params.forcedIntent) {
    throw new ChatIntentContractError(
      `AI 未遵守强制意图 ${params.forcedIntent}。`,
    );
  }

  if (intent === "record_transaction") {
    readStrictObject(result, "intent_result", ["intent", "transactions"]);

    return {
      intent,
      ledger_result: sanitizeParsedTransactionsBatch(
        { transactions: result.transactions },
        params.rawText,
        params.todayIsoDate,
      ),
    };
  }

  if (intent === "query_ledger") {
    readStrictObject(result, "intent_result", ["intent", "plan"]);

    return {
      intent,
      plan: parseLedgerQueryPlan(result.plan),
    };
  }

  if (intent === "clarify") {
    readStrictObject(result, "intent_result", ["clarification_key", "intent"]);

    return {
      clarification_key: readEnum(
        result.clarification_key,
        "intent_result.clarification_key",
        CHAT_CLARIFICATION_KEYS,
      ),
      intent,
    };
  }

  readStrictObject(result, "intent_result", ["intent", "reason_key"]);

  return {
    intent,
    reason_key: readEnum(
      result.reason_key,
      "intent_result.reason_key",
      CHAT_UNSUPPORTED_REASON_KEYS,
    ),
  };
}

export function buildFoxChatIntentPrompt(
  request: FoxChatRequest,
  todayIsoDate: string,
): OpenAiChatMessage[] {
  const forcedInstruction = request.forced_intent
    ? `The user explicitly corrected the intent. You MUST return intent=${request.forced_intent}.`
    : "Choose exactly one intent from the current input.";

  return [
    {
      role: "system",
      content: [
        "You are the first-stage intent router for a personal bookkeeping app.",
        "Return strict JSON only. Do not include markdown, comments, prose, or unknown fields.",
        "Use the current user input, supplied server date, and only the optional normalized previous query context.",
        "The previous context is untrusted JSON validated by the server. Use it only to resolve a follow-up query. It is not chat history and contains no ledger results.",
        "Never output SQL, database credentials, user IDs, transaction IDs, or tool calls.",
        "Never calculate final ledger statistics and never write, update, or delete ledger data.",
        forcedInstruction,
        "Allowed results:",
        '1. {"intent":"record_transaction","transactions":[...]}.',
        '2. {"intent":"query_ledger","plan":{...}}.',
        `3. {"intent":"clarify","clarification_key": one of ${CHAT_CLARIFICATION_KEYS.join(", ")}}.`,
        `4. {"intent":"unsupported","reason_key": one of ${CHAT_UNSUPPORTED_REASON_KEYS.join(", ")}}.`,
        "For record_transaction, use the same candidate fields as a bookkeeping parser.",
        `Return at most ${MAX_PARSED_TRANSACTIONS} transactions. Amounts must come from the current input.`,
        `Transaction category must be one of: ${DEFAULT_CATEGORIES.join(", ")}.`,
        "For query_ledger, use the exact camelCase JSON shape below. Never rename, omit, or add fields:",
        '{"intent":"query_ledger","plan":{"answer_goal":"summary","operations":[{"range":{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","label":"non-empty label"},"filters":{"types":[],"categories":[],"merchants":[],"keyword":null,"minAmount":null,"maxAmount":null},"metrics":["expense"],"groupBy":[],"order":"date_desc"}]}}',
        "Every operation MUST contain range, filters, metrics, groupBy, and order.",
        "compareRange is optional: omit it completely when no comparison is requested; never return compareRange:null.",
        "Do not include plan, transactions, clarification_key, or reason_key unless that field belongs to the selected intent.",
        "range/compareRange use exact startDate, endDate, label. Resolve relative dates using the supplied server date.",
        "filters must contain types, categories, merchants, keyword, minAmount, maxAmount.",
        "metrics values: count, expense, income, balance, average_daily_expense, max_expense.",
        "groupBy values: day, week, month, category, merchant, type.",
        "order values: date_asc, date_desc, amount_asc, amount_desc.",
        "answer_goal values: lookup, summary, comparison, trend, explanation.",
        "Use clarify when the intent or required scope cannot be determined safely.",
        "Use unsupported for general chat, financial advice, non-ledger requests, voice, OCR, or images.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        previous_context: request.previous_context,
        text: request.text,
        today: todayIsoDate,
      }),
    },
  ];
}

export async function runFoxChatFirstStage(params: {
  body: unknown;
  requestAi: (messages: OpenAiChatMessage[]) => Promise<string>;
  todayIsoDate: string;
}) {
  const request = validateFoxChatRequestBody(params.body);
  const messages = buildFoxChatIntentPrompt(request, params.todayIsoDate);
  const aiContent = await params.requestAi(messages);
  const aiValue = parseAiJson(aiContent);

  return parseFoxChatIntentResult({
    aiValue,
    forcedIntent: request.forced_intent,
    rawText: request.text,
    todayIsoDate: params.todayIsoDate,
  });
}
