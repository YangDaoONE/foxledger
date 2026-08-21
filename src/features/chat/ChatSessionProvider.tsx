import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import { useAuthUser } from "@/auth/AuthProvider";
import {
  chatReducer,
  createChatCandidateBatch,
  createInitialChatState,
} from "@/features/chat/chatReducer";
import { createChatBatchInsertRequest } from "@/features/chat/chatBatchSave";
import { canConfirmCandidateBatch } from "@/features/chat/batchCalculations";
import type { ChatState } from "@/features/chat/chatTypes";
import {
  MAX_FOX_CHAT_INPUT_CHARS,
  sendFoxChatMessage,
} from "@/features/chat/foxChatApi";
import type { ConfirmTransactionDraft } from "@/features/ai/types";
import { useLedgerState } from "@/features/ledgers/LedgerProvider";
import { useSyncState } from "@/features/sync/SyncProvider";
import {
  AiBatchSaveStateError,
  insertAiBatchTransactionsForUser,
} from "@/features/transactions/transactionsApi";
import { getErrorMessage } from "@/lib/errors";
import { getNetworkOnlineState } from "@/lib/networkStatus";
import type { ForcedChatIntent } from "@shared/chatIntent";

type ChatSessionContextValue = {
  beginBatchUndo: (batchId: string) => void;
  failBatchUndo: (batchId: string, error: string) => void;
  completeCandidateReview: (messageId: string, candidateId: string) => void;
  confirmBatch: (messageId: string) => Promise<void>;
  markBatchUndone: (batchId: string) => void;
  removeCandidate: (messageId: string, candidateId: string) => void;
  retryBatchSync: (messageId: string) => Promise<void>;
  sendMessage: (text: string, forcedIntent?: ForcedChatIntent) => Promise<void>;
  state: ChatState;
  updateBatchLedger: (messageId: string, ledgerId: string) => void;
  updateCandidate: (
    messageId: string,
    candidateId: string,
    patch: Partial<ConfirmTransactionDraft>,
  ) => void;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

const clarificationMessages = {
  intent_ambiguous: "我还不确定你是想记账还是问账，请选择后重试这句话。",
  missing_query_scope: "问账还缺少明确范围，请补充时间、分类或想看的指标。",
  missing_transaction_details: "记账信息还不完整，请补充金额和用途，或选择意图后重试。",
} as const;

const unsupportedMessages = {
  financial_advice: "狐狐可以整理账本事实，但不能提供具体投资产品或专业投资建议。",
  general_chat: "狐狐目前专注于记账和账本问答。",
  not_ledger_related: "这次输入似乎与记账或账本问题无关。",
  unsupported_capability: "狐狐目前只处理文字记账和账本问答，暂不支持图片、语音或其他操作。",
} as const;

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const user = useAuthUser();
  const { activeLedgerId, ledgers } = useLedgerState();
  const { refreshAfterWrite } = useSyncState();
  const [state, dispatch] = useReducer(chatReducer, user.id, createInitialChatState);
  const userIdRef = useRef(user.id);
  const parseInFlightRef = useRef(false);
  const stateRef = useRef(state);
  const writeInFlightRef = useRef(new Set<string>());
  const activeLedgerIdRef = useRef(activeLedgerId);
  const ledgerIdsRef = useRef(new Set(ledgers.map((ledger) => ledger.id)));

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    activeLedgerIdRef.current = activeLedgerId;
    ledgerIdsRef.current = new Set(ledgers.map((ledger) => ledger.id));
  }, [activeLedgerId, ledgers]);

  useEffect(() => {
    userIdRef.current = user.id;
    parseInFlightRef.current = false;
    writeInFlightRef.current.clear();
    dispatch({ type: "reset", userId: user.id });
  }, [user.id]);

  const sendMessage = useCallback(async (
    text: string,
    forcedIntent?: ForcedChatIntent,
  ) => {
    const trimmed = text.trim();

    if (!trimmed || parseInFlightRef.current) {
      return;
    }

    const userId = userIdRef.current;
    const ledgerId = activeLedgerIdRef.current;
    const createdAt = new Date().toISOString();
    const errorMessageId = crypto.randomUUID();

    if (!getNetworkOnlineState()) {
      dispatch({
        errorMessage: {
          createdAt,
          id: errorMessageId,
          role: "assistant",
          text: "离线时不能使用狐狐记账或问账，请联网后再试。",
          type: "error",
        },
        type: "parse_failed",
        userId,
      });
      return;
    }

    if (!ledgerId || !ledgerIdsRef.current.has(ledgerId)) {
      dispatch({
        errorMessage: {
          createdAt,
          id: errorMessageId,
          role: "assistant",
          text: "当前没有可用账本，请先同步或选择账本。",
          type: "error",
        },
        type: "parse_failed",
        userId,
      });
      return;
    }

    if (trimmed.length > MAX_FOX_CHAT_INPUT_CHARS) {
      dispatch({
        errorMessage: {
          createdAt,
          id: errorMessageId,
          role: "assistant",
          text: `输入不能超过 ${MAX_FOX_CHAT_INPUT_CHARS} 字。`,
          type: "error",
        },
        type: "parse_failed",
        userId,
      });
      return;
    }

    parseInFlightRef.current = true;
    dispatch({
      parsingMessage: {
        createdAt,
        id: crypto.randomUUID(),
        role: "assistant",
        type: "parsing",
      },
      type: "parse_started",
      userId,
      userMessage: {
        createdAt,
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
        type: "text",
      },
    });

    try {
      const result = await sendFoxChatMessage({
        ...(forcedIntent ? { forcedIntent } : {}),
        ledgerId,
        previousContext:
          stateRef.current.previousContextLedgerId === ledgerId
            ? stateRef.current.previousContext
            : null,
        text: trimmed,
      });

      if (userIdRef.current !== userId) {
        return;
      }

      if (result.intent === "record_transaction") {
        if (result.ledger_result.transactions.length === 0) {
          dispatch({
            errorMessage: {
              createdAt: new Date().toISOString(),
              id: crypto.randomUUID(),
              role: "assistant",
              text: "没有识别到账单，请补充金额和用途后再试。",
              type: "error",
            },
            type: "parse_failed",
            userId,
          });
          return;
        }

        dispatch({
          resultMessage: {
            batch: createChatCandidateBatch(
              result.ledger_result.transactions,
              result.ledger_result.truncated,
              ledgerId,
            ),
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
            role: "assistant",
            type: "ledger_result",
          },
          type: "parse_succeeded",
          userId,
        });
        return;
      }

      if (result.intent === "query_ledger") {
        dispatch({
          previousContext: result.context,
          previousContextLedgerId: ledgerId,
          resultMessage: {
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
            ledgerId,
            result,
            role: "assistant",
            type: "query_result",
          },
          type: "parse_succeeded",
          userId,
        });
        return;
      }

      const text =
        result.intent === "clarify"
          ? clarificationMessages[result.clarification_key]
          : unsupportedMessages[result.reason_key];
      dispatch({
        resultMessage: {
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          originalText: trimmed,
          role: "assistant",
          text,
          type: "intent_notice",
        },
        type: "parse_succeeded",
        userId,
      });
    } catch (error) {
      if (userIdRef.current === userId) {
        dispatch({
          errorMessage: {
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
            role: "assistant",
            text: getErrorMessage(error, "狐狐暂时没有理解，请稍后重试。"),
            type: "error",
          },
          type: "parse_failed",
          userId,
        });
      }
    } finally {
      if (userIdRef.current === userId) {
        parseInFlightRef.current = false;
      }
    }
  }, []);

  const updateCandidate = useCallback(
    (
      messageId: string,
      candidateId: string,
      patch: Partial<ConfirmTransactionDraft>,
    ) => {
      dispatch({ candidateId, messageId, patch, type: "update_candidate" });
    },
    [],
  );

  const completeCandidateReview = useCallback(
    (messageId: string, candidateId: string) => {
      dispatch({ candidateId, messageId, type: "complete_candidate_review" });
    },
    [],
  );

  const removeCandidate = useCallback((messageId: string, candidateId: string) => {
    dispatch({ candidateId, messageId, type: "remove_candidate" });
  }, []);

  const updateBatchLedger = useCallback((messageId: string, ledgerId: string) => {
    if (!ledgerIdsRef.current.has(ledgerId)) {
      return;
    }

    dispatch({ ledgerId, messageId, type: "update_batch_ledger" });
  }, []);

  const confirmBatch = useCallback(async (messageId: string) => {
    if (writeInFlightRef.current.has(messageId) || !getNetworkOnlineState()) {
      return;
    }

    const message = stateRef.current.messages.find(
      (item) => item.id === messageId && item.type === "ledger_result",
    );

    if (!message || message.type !== "ledger_result") {
      return;
    }

    if (!ledgerIdsRef.current.has(message.batch.ledgerId)) {
      return;
    }

    const isFirstAttempt =
      canConfirmCandidateBatch(message.batch) && !message.batch.saveRequest;
    const isRetry =
      message.batch.status === "error" &&
      message.batch.canRetrySave &&
      message.batch.saveRequest !== null;

    if (!isFirstAttempt && !isRetry) {
      return;
    }

    const request =
      message.batch.saveRequest ?? createChatBatchInsertRequest(message.batch);
    const userId = userIdRef.current;
    writeInFlightRef.current.add(messageId);
    dispatch({ messageId, request, type: "request_save" });

    try {
      const result = await insertAiBatchTransactionsForUser(
        userId,
        request.transactions,
      );

      if (userIdRef.current !== userId) {
        return;
      }

      dispatch({
        batchId: result.batchId,
        messageId,
        transactionIds: result.transactionIds,
        type: "save_succeeded",
        userId,
      });

      try {
        await refreshAfterWrite();

        if (userIdRef.current === userId) {
          dispatch({ messageId, type: "sync_succeeded", userId });
        }
      } catch (syncError) {
        if (userIdRef.current === userId) {
          dispatch({
            error: getErrorMessage(syncError, "本地缓存暂时没有刷新成功。"),
            messageId,
            type: "sync_failed",
            userId,
          });
        }
      }
    } catch (error) {
      if (userIdRef.current === userId) {
        dispatch({
          canRetry: !(error instanceof AiBatchSaveStateError),
          error: getErrorMessage(error, "保存 AI 候选失败。"),
          messageId,
          type: "save_failed",
          userId,
        });
      }
    } finally {
      writeInFlightRef.current.delete(messageId);
    }
  }, [refreshAfterWrite]);

  const retryBatchSync = useCallback(async (messageId: string) => {
    if (writeInFlightRef.current.has(messageId) || !getNetworkOnlineState()) {
      return;
    }

    const userId = userIdRef.current;
    writeInFlightRef.current.add(messageId);

    try {
      await refreshAfterWrite();

      if (userIdRef.current === userId) {
        dispatch({ messageId, type: "sync_succeeded", userId });
      }
    } catch (error) {
      if (userIdRef.current === userId) {
        dispatch({
          error: getErrorMessage(error, "本地缓存暂时没有刷新成功。"),
          messageId,
          type: "sync_failed",
          userId,
        });
      }
    } finally {
      writeInFlightRef.current.delete(messageId);
    }
  }, [refreshAfterWrite]);

  const markBatchUndone = useCallback((batchId: string) => {
    dispatch({ batchId, type: "mark_batch_undone" });
  }, []);

  const beginBatchUndo = useCallback((batchId: string) => {
    dispatch({ batchId, type: "request_batch_undo" });
  }, []);

  const failBatchUndo = useCallback((batchId: string, error: string) => {
    dispatch({ batchId, error, type: "batch_undo_failed" });
  }, []);

  const value = useMemo<ChatSessionContextValue>(
    () => ({
      beginBatchUndo,
      completeCandidateReview,
      confirmBatch,
      failBatchUndo,
      markBatchUndone,
      removeCandidate,
      retryBatchSync,
      sendMessage,
      state,
      updateBatchLedger,
      updateCandidate,
    }),
    [
      completeCandidateReview,
      beginBatchUndo,
      confirmBatch,
      failBatchUndo,
      markBatchUndone,
      removeCandidate,
      retryBatchSync,
      sendMessage,
      state,
      updateBatchLedger,
      updateCandidate,
    ],
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession() {
  const value = useContext(ChatSessionContext);

  if (!value) {
    throw new Error("useChatSession must be used inside ChatSessionProvider.");
  }

  return value;
}
