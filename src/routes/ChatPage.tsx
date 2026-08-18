import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RotateCw } from "lucide-react";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { BatchDetailSheet } from "@/features/chat/BatchDetailSheet";
import { ChatComposer } from "@/features/chat/ChatComposer";
import { ChatMessageList } from "@/features/chat/ChatMessageList";
import { ConfirmActionDialog } from "@/features/chat/ConfirmActionDialog";
import { FoxMascot, type FoxMascotState } from "@/features/chat/FoxMascot";
import { useChatSession } from "@/features/chat/ChatSessionProvider";
import { createLedgerQueryNavigation } from "@/features/chat/ledgerQueryNavigation";
import { RecentAiBatchesPanel } from "@/features/chat/RecentAiBatchesPanel";
import { getRecentAiBatch } from "@/features/chat/recentAiBatches";
import { SavedBatchDetailSheet } from "@/features/chat/SavedBatchDetailSheet";
import { SavedTransactionEditor } from "@/features/chat/SavedTransactionEditor";
import { useAiBatchManagement } from "@/features/chat/useAiBatchManagement";
import { useSyncState } from "@/features/sync/SyncProvider";
import type { TransactionFormValues } from "@/features/transactions/TransactionForm";
import { getErrorMessage } from "@/lib/errors";

type SelectedCandidate = {
  candidateId: string;
  messageId: string;
};

type SavedBatchDialog =
  | { batchId: string; kind: "delete"; transactionId: string }
  | { batchId: string; kind: "detail" }
  | { batchId: string; kind: "edit"; transactionId: string }
  | { batchId: string; kind: "undo" }
  | null;

type SavedBatchActionMessage = {
  text: string;
  tone: "danger" | "success";
};

export function ChatPage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const {
    completeCandidateReview,
    confirmBatch,
    removeCandidate,
    retryBatchSync,
    sendMessage,
    state,
    updateCandidate,
  } = useChatSession();
  const { isOnline } = useSyncState();
  const batchManagement = useAiBatchManagement();
  const [isListening, setIsListening] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SelectedCandidate | null>(null);
  const [savedBatchDialog, setSavedBatchDialog] = useState<SavedBatchDialog>(null);
  const [savedBatchActionMessage, setSavedBatchActionMessage] =
    useState<SavedBatchActionMessage | null>(null);
  const lastCandidateTriggerRef = useRef<HTMLButtonElement | null>(null);
  const lastSavedBatchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savedBatchId = savedBatchDialog?.batchId ?? "";
  const savedBatchQuery = useQuery({
    enabled: Boolean(savedBatchId),
    queryFn: () => getRecentAiBatch(user.id, savedBatchId),
    queryKey: queryKeys.recentAiBatch(user.id, savedBatchId),
  });
  const savedBatch = savedBatchQuery.data ?? null;
  const selectedSavedTransaction =
    savedBatchDialog && "transactionId" in savedBatchDialog
      ? savedBatch?.transactions.find(
          (transaction) => transaction.id === savedBatchDialog.transactionId,
        ) ?? null
      : null;
  const selected = useMemo(() => {
    if (!selectedCandidate) {
      return null;
    }

    const message = state.messages.find(
      (item) => item.id === selectedCandidate.messageId && item.type === "ledger_result",
    );

    if (!message || message.type !== "ledger_result") {
      return null;
    }

    const candidate = message.batch.candidates.find(
      (item) => item.id === selectedCandidate.candidateId,
    );

    return candidate ? { candidate, messageId: message.id } : null;
  }, [selectedCandidate, state.messages]);

  const closeCandidateDetails = useCallback(() => {
    setSelectedCandidate(null);
    requestAnimationFrame(() => lastCandidateTriggerRef.current?.focus());
  }, []);

  const closeSavedBatchFlow = useCallback(() => {
    setSavedBatchDialog(null);
    setSavedBatchActionMessage(null);
    requestAnimationFrame(() => lastSavedBatchTriggerRef.current?.focus());
  }, []);

  function returnToSavedBatchDetail(batchId: string) {
    setSavedBatchDialog({ batchId, kind: "detail" });
  }

  async function submitSavedTransactionEdit(values: TransactionFormValues) {
    if (!selectedSavedTransaction || !savedBatchDialog) {
      return;
    }

    const result = await batchManagement.updateSavedTransaction(
      selectedSavedTransaction.id,
      values,
    );

    if (!result) {
      return;
    }

    if (result.cacheStatus === "stale") {
      closeSavedBatchFlow();
      return;
    }

    setSavedBatchActionMessage({ text: "账单已修改。", tone: "success" });
    returnToSavedBatchDetail(savedBatchDialog.batchId);
  }

  async function confirmSavedBatchAction() {
    if (!savedBatchDialog || !savedBatch) {
      return;
    }

    const currentDialog = savedBatchDialog;

    try {
      const result =
        currentDialog.kind === "undo"
          ? await batchManagement.undoSavedBatch(savedBatch)
          : currentDialog.kind === "delete" && selectedSavedTransaction
            ? await batchManagement.deleteSavedTransaction(
                savedBatch,
                selectedSavedTransaction.id,
              )
            : null;

      if (!result) {
        return;
      }

      if (
        result.cacheStatus === "stale" ||
        currentDialog.kind === "undo" ||
        savedBatch.transactionCount === 1
      ) {
        closeSavedBatchFlow();
        return;
      }

      setSavedBatchActionMessage({
        text: "账单已删除，批次合计已按剩余账单重算。",
        tone: "success",
      });
      returnToSavedBatchDetail(currentDialog.batchId);
    } catch (error) {
      setSavedBatchActionMessage({
        text: getErrorMessage(error, "操作失败，请稍后重试。"),
        tone: "danger",
      });
      returnToSavedBatchDetail(currentDialog.batchId);
    }
  }

  const mascotState = useMemo<FoxMascotState>(() => {
    if (state.isParsing) {
      return "thinking";
    }

    const latestResult = [...state.messages]
      .reverse()
      .find(
        (message) =>
          message.type === "ledger_result" || message.type === "query_result",
      );

    if (latestResult?.type === "ledger_result") {
      if (
        latestResult.batch.status === "saving" ||
        latestResult.batch.status === "undoing"
      ) {
        return "thinking";
      }

      if (
        latestResult.batch.status === "needs_attention" ||
        latestResult.batch.status === "sync_warning" ||
        latestResult.batch.status === "error"
      ) {
        return "confused";
      }
    }

    if (isListening) {
      return "listening";
    }

    return latestResult ? "happy" : "normal";
  }, [isListening, state.isParsing, state.messages]);
  const hasBusyBatch = state.messages.some(
    (message) =>
      message.type === "ledger_result" &&
      (message.batch.status === "saving" || message.batch.status === "undoing"),
  );

  return (
    <div
      className={`chat-page ${isListening ? "composer-active" : ""}`}
      aria-busy={state.isParsing || hasBusyBatch || batchManagement.busyAction !== null}
    >
      <section className="chat-hero">
        <FoxMascot state={mascotState} />
        <div>
          <p>狐狐</p>
          <h2>记一笔，也可以问问账本</h2>
          <span>告诉我今天花了什么，或者直接问自己的收支。</span>
        </div>
      </section>

      <details className="chat-privacy-details">
        <summary>数据与隐私</summary>
        <div>
          <p>
            记账时，狐狐只解析你当前发送的文字，确认后才写入账本。问账时，服务端只在你的登录权限内读取与问题相关的云端账单，由代码计算正式数字；AI 只接收受限统计和必要明细，不会自动修改账单。
          </p>
          <p>
            必要明细最多 500 条，只包含日期、类型、金额、分类和商家；不会发送本地缓存、备注、账户、支付方式、原文、用户 ID 或交易 ID。
          </p>
          <button
            className="chat-privacy-link"
            type="button"
            onClick={() => void navigate({ to: "/settings" })}
          >
            查看设置页完整说明
          </button>
        </div>
      </details>

      {!isOnline ? (
        <p className="form-message danger" role="status">
          当前离线，只能查看本次页面内已有候选，不能继续解析或保存。
        </p>
      ) : null}

      {batchManagement.hasStaleCacheAfterWrite ? (
        <div className="batch-management-warning" role="alert">
          <span>
            正式账单操作已完成，但本地缓存待同步。
            {batchManagement.staleCacheMessage
              ? ` ${batchManagement.staleCacheMessage}`
              : ""}
          </span>
          <AppButton
            disabled={!isOnline || batchManagement.busyAction !== null}
            icon={<RotateCw size={16} />}
            type="button"
            onClick={() => void batchManagement.retryCacheSync()}
          >
            {batchManagement.busyAction === "retry-sync" ? "同步中" : "重新同步"}
          </AppButton>
        </div>
      ) : null}

      <ChatMessageList
        hasStaleBatchCache={batchManagement.hasStaleCacheAfterWrite}
        isBatchCacheSyncing={batchManagement.isSyncing}
        isOnline={isOnline}
        messages={state.messages}
        onConfirmBatch={(messageId) => void confirmBatch(messageId)}
        onCorrectIntent={(text, intent) => void sendMessage(text, intent)}
        onOpenCandidate={(messageId, candidateId, trigger) => {
          lastCandidateTriggerRef.current = trigger;
          setSavedBatchDialog(null);
          setSelectedCandidate({ candidateId, messageId });
        }}
        onOpenSavedBatch={(batchId, trigger) => {
          lastSavedBatchTriggerRef.current = trigger;
          setSelectedCandidate(null);
          setSavedBatchActionMessage(null);
          setSavedBatchDialog({ batchId, kind: "detail" });
        }}
        onRemoveCandidate={(messageId, candidateId) => {
          removeCandidate(messageId, candidateId);

          if (
            selectedCandidate?.messageId === messageId &&
            selectedCandidate.candidateId === candidateId
          ) {
            closeCandidateDetails();
          }
        }}
        onOpenQueryTransactions={(messageId, operationIndex) => {
          const message = state.messages.find(
            (item) => item.id === messageId && item.type === "query_result",
          );

          if (!message || message.type !== "query_result") {
            return;
          }

          const operation = message.result.plan.operations[operationIndex];

          if (!operation) {
            return;
          }

          void navigate({
            search: createLedgerQueryNavigation(operation).search,
            to: "/transactions",
          });
        }}
        onRetryBatchSync={(messageId) => void retryBatchSync(messageId)}
        userId={user.id}
      />

      <RecentAiBatchesPanel management={batchManagement} />

      <ChatComposer
        isOnline={isOnline}
        isParsing={state.isParsing}
        onListeningChange={setIsListening}
        onSend={sendMessage}
      />

      {selected ? (
        <BatchDetailSheet
          candidate={selected.candidate}
          onClose={closeCandidateDetails}
          onCompleteReview={() => {
            completeCandidateReview(selected.messageId, selected.candidate.id);
            closeCandidateDetails();
          }}
          onRemove={() => {
            removeCandidate(selected.messageId, selected.candidate.id);
            closeCandidateDetails();
          }}
          onUpdate={(patch) =>
            updateCandidate(selected.messageId, selected.candidate.id, patch)
          }
        />
      ) : null}

      {savedBatchDialog?.kind === "detail" ? (
        <SavedBatchDetailSheet
          actionsDisabled={batchManagement.actionsDisabled}
          batch={savedBatch}
          error={
            savedBatchQuery.error
              ? getErrorMessage(savedBatchQuery.error, "无法读取这批正式账单。")
              : null
          }
          isLoading={savedBatchQuery.isPending}
          isOnline={isOnline}
          isRetrying={batchManagement.busyAction === "retry-sync"}
          message={savedBatchActionMessage}
          onClose={closeSavedBatchFlow}
          onDelete={(transactionId) => {
            setSavedBatchActionMessage(null);
            setSavedBatchDialog({
              batchId: savedBatchDialog.batchId,
              kind: "delete",
              transactionId,
            });
          }}
          onEdit={(transactionId) => {
            setSavedBatchActionMessage(null);
            setSavedBatchDialog({
              batchId: savedBatchDialog.batchId,
              kind: "edit",
              transactionId,
            });
          }}
          onRetrySync={() => void batchManagement.retryCacheSync()}
          onUndo={() => {
            setSavedBatchActionMessage(null);
            setSavedBatchDialog({ batchId: savedBatchDialog.batchId, kind: "undo" });
          }}
        />
      ) : null}

      {savedBatchDialog?.kind === "edit" && selectedSavedTransaction ? (
        <SavedTransactionEditor
          isSubmitting={
            batchManagement.busyAction === `edit:${selectedSavedTransaction.id}`
          }
          transaction={selectedSavedTransaction}
          onClose={() => returnToSavedBatchDetail(savedBatchDialog.batchId)}
          onSubmit={submitSavedTransactionEdit}
        />
      ) : null}

      {savedBatchDialog &&
      (savedBatchDialog.kind === "delete" || savedBatchDialog.kind === "undo") &&
      savedBatch ? (
        <ConfirmActionDialog
          description={
            savedBatchDialog.kind === "undo"
              ? `将删除这一批当前剩余的 ${savedBatch.transactionCount} 笔正式账单。`
              : "删除后无法恢复；本次记账的合计会按剩余账单重新计算。"
          }
          isBusy={batchManagement.busyAction !== null}
          title={savedBatchDialog.kind === "undo" ? "撤销整批账单？" : "删除这笔账单？"}
          onCancel={() => returnToSavedBatchDetail(savedBatchDialog.batchId)}
          onConfirm={() => void confirmSavedBatchAction()}
        />
      ) : null}
    </div>
  );
}
