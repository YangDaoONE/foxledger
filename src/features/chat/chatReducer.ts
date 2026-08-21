import { createConfirmTransactionDraft } from "@/features/ai/aiCandidateRules";
import type { ParsedTransaction } from "@/features/ai/types";
import type { AiBatchInsertRequest } from "@/features/ai/aiBatchSave";
import {
  canConfirmCandidateBatch,
  getCandidateBatchStatus,
} from "@/features/chat/batchCalculations";
import type {
  ChatCandidateBatch,
  ChatMessage,
  ChatState,
} from "@/features/chat/chatTypes";
import type { LedgerConversationContext } from "@shared/chatIntent";

export type ChatAction =
  | { type: "reset"; userId: string }
  | {
      parsingMessage: ChatMessage;
      type: "parse_started";
      userId: string;
      userMessage: ChatMessage;
    }
  | {
      previousContext?: LedgerConversationContext;
      previousContextLedgerId?: string;
      resultMessage: ChatMessage;
      type: "parse_succeeded";
      userId: string;
    }
  | {
      errorMessage: ChatMessage;
      type: "parse_failed";
      userId: string;
    }
  | {
      candidateId: string;
      messageId: string;
      patch: Partial<ChatCandidateBatch["candidates"][number]["draft"]>;
      type: "update_candidate";
    }
  | {
      candidateId: string;
      messageId: string;
      type: "complete_candidate_review";
    }
  | { candidateId: string; messageId: string; type: "remove_candidate" }
  | { ledgerId: string; messageId: string; type: "update_batch_ledger" }
  | {
      messageId: string;
      request: AiBatchInsertRequest;
      type: "request_save";
    }
  | {
      batchId: string;
      messageId: string;
      transactionIds: string[];
      type: "save_succeeded";
      userId: string;
    }
  | {
      canRetry: boolean;
      error: string;
      messageId: string;
      type: "save_failed";
      userId: string;
    }
  | {
      error: string;
      messageId: string;
      type: "sync_failed";
      userId: string;
    }
  | { messageId: string; type: "sync_succeeded"; userId: string }
  | { batchId: string; type: "request_batch_undo" }
  | { batchId: string; error: string; type: "batch_undo_failed" }
  | { batchId: string; type: "mark_batch_undone" };

export function createInitialChatState(userId: string): ChatState {
  return {
    isParsing: false,
    messages: [],
    previousContext: null,
    previousContextLedgerId: null,
    userId,
  };
}

export function createChatCandidateBatch(
  transactions: ParsedTransaction[],
  truncated: boolean,
  ledgerId: string,
  createId: () => string = () => crypto.randomUUID(),
): ChatCandidateBatch {
  const candidates = transactions.map((transaction) => ({
    draft: createConfirmTransactionDraft(transaction),
    id: createId(),
    requiresReview: transaction.needs_clarification,
    source: transaction,
  }));

  return {
    canRetrySave: false,
    candidates,
    error: null,
    id: createId(),
    ledgerId,
    saveRequest: null,
    status: getCandidateBatchStatus(candidates),
    statusBeforeUndo: null,
    transactionIds: [],
    truncated,
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "reset") {
    return createInitialChatState(action.userId);
  }

  if ("userId" in action && action.userId !== state.userId) {
    return state;
  }

  if (action.type === "parse_started") {
    if (state.isParsing) {
      return state;
    }

    return {
      ...state,
      isParsing: true,
      messages: [...state.messages, action.userMessage, action.parsingMessage],
    };
  }

  if (action.type === "parse_succeeded") {
    return {
      ...state,
      isParsing: false,
      messages: [
        ...state.messages.filter((message) => message.type !== "parsing"),
        action.resultMessage,
      ],
      previousContext: action.previousContext ?? state.previousContext,
      previousContextLedgerId:
        action.previousContextLedgerId ?? state.previousContextLedgerId,
    };
  }

  if (action.type === "parse_failed") {
    return {
      ...state,
      isParsing: false,
      messages: [
        ...state.messages.filter((message) => message.type !== "parsing"),
        action.errorMessage,
      ],
    };
  }

  if (action.type === "request_save") {
    return updateBatchMessage(state, action.messageId, (batch) => {
      const isFirstAttempt = canConfirmCandidateBatch(batch) && !batch.saveRequest;
      const isRetry =
        batch.status === "error" && batch.canRetrySave && batch.saveRequest !== null;

      if (!isFirstAttempt && !isRetry) {
        return batch;
      }

      return {
        ...batch,
        canRetrySave: false,
        error: null,
        saveRequest: batch.saveRequest ?? action.request,
        status: "saving",
      };
    });
  }

  if (action.type === "save_succeeded") {
    return updateBatchMessage(state, action.messageId, (batch) => {
      if (
        batch.status !== "saving" ||
        batch.saveRequest?.batchId !== action.batchId
      ) {
        return batch;
      }

      return {
        ...batch,
        canRetrySave: false,
        error: null,
        status: "saved",
        transactionIds: [...action.transactionIds],
      };
    });
  }

  if (action.type === "save_failed") {
    return updateBatchMessage(state, action.messageId, (batch) =>
      batch.status === "saving"
        ? {
            ...batch,
            canRetrySave: action.canRetry,
            error: action.error,
            status: "error",
          }
        : batch,
    );
  }

  if (action.type === "sync_failed") {
    return updateBatchMessage(state, action.messageId, (batch) =>
      batch.status === "saved"
        ? { ...batch, error: action.error, status: "sync_warning" }
        : batch,
    );
  }

  if (action.type === "sync_succeeded") {
    return updateBatchMessage(state, action.messageId, (batch) =>
      batch.status === "sync_warning"
        ? { ...batch, error: null, status: "saved" }
        : batch,
    );
  }

  if (
    action.type === "request_batch_undo" ||
    action.type === "batch_undo_failed" ||
    action.type === "mark_batch_undone"
  ) {
    return {
      ...state,
      messages: state.messages.map((message) => {
        if (
          message.type !== "ledger_result" ||
          message.batch.saveRequest?.batchId !== action.batchId
        ) {
          return message;
        }

        if (
          action.type === "request_batch_undo" &&
          (message.batch.status === "saved" ||
            message.batch.status === "sync_warning")
        ) {
          return {
            ...message,
            batch: {
              ...message.batch,
              error: null,
              status: "undoing" as const,
              statusBeforeUndo: message.batch.status,
            },
          };
        }

        if (
          action.type === "batch_undo_failed" &&
          message.batch.status === "undoing"
        ) {
          return {
            ...message,
            batch: {
              ...message.batch,
              error: action.error,
              status: message.batch.statusBeforeUndo ?? "saved",
              statusBeforeUndo: null,
            },
          };
        }

        if (
          action.type !== "mark_batch_undone" ||
          (message.batch.status !== "undoing" &&
            message.batch.status !== "saved" &&
            message.batch.status !== "sync_warning")
        ) {
          return message;
        }

        return {
          ...message,
          batch: {
            ...message.batch,
            error: null,
            status: "undone" as const,
            statusBeforeUndo: null,
          },
        };
      }),
    };
  }

  if (action.type === "update_candidate") {
    return updateEditableBatch(state, action.messageId, (batch) => ({
      ...batch,
      candidates: batch.candidates.map((candidate) =>
        candidate.id === action.candidateId
          ? { ...candidate, draft: { ...candidate.draft, ...action.patch } }
          : candidate,
      ),
    }));
  }

  if (action.type === "update_batch_ledger") {
    return updateEditableBatch(state, action.messageId, (batch) => ({
      ...batch,
      ledgerId: action.ledgerId,
    }));
  }

  if (action.type === "complete_candidate_review") {
    return updateEditableBatch(state, action.messageId, (batch) => ({
      ...batch,
      candidates: batch.candidates.map((candidate) =>
        candidate.id === action.candidateId
          ? { ...candidate, requiresReview: false }
          : candidate,
      ),
    }));
  }

  if (action.type === "remove_candidate") {
    return updateEditableBatch(state, action.messageId, (batch) => ({
      ...batch,
      candidates: batch.candidates.filter(
        (candidate) => candidate.id !== action.candidateId,
      ),
    }));
  }

  return state;
}

function updateEditableBatch(
  state: ChatState,
  messageId: string,
  update: (batch: ChatCandidateBatch) => ChatCandidateBatch,
) {
  return updateBatchMessage(state, messageId, (batch) => {
    if (batch.status !== "draft" && batch.status !== "needs_attention") {
      return batch;
    }

    const nextBatch = update(batch);
    return {
      ...nextBatch,
      status: getCandidateBatchStatus(nextBatch.candidates),
    };
  });
}

function updateBatchMessage(
  state: ChatState,
  messageId: string,
  update: (batch: ChatCandidateBatch) => ChatCandidateBatch,
): ChatState {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === messageId && message.type === "ledger_result"
        ? { ...message, batch: update(message.batch) }
        : message,
    ),
  };
}
