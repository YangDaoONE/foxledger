import { useCallback, useMemo, useRef, useState } from "react";

import { BatchDetailSheet } from "@/features/chat/BatchDetailSheet";
import { ChatComposer } from "@/features/chat/ChatComposer";
import { ChatMessageList } from "@/features/chat/ChatMessageList";
import { FoxMascot, type FoxMascotState } from "@/features/chat/FoxMascot";
import { RecentAiBatchesPanel } from "@/features/chat/RecentAiBatchesPanel";
import { useChatSession } from "@/features/chat/ChatSessionProvider";
import { useSyncState } from "@/features/sync/SyncProvider";

type SelectedCandidate = {
  candidateId: string;
  messageId: string;
};

export function ChatPage() {
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
  const [isListening, setIsListening] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SelectedCandidate | null>(null);
  const lastDetailTriggerRef = useRef<HTMLButtonElement | null>(null);
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

  const closeDetails = useCallback(() => {
    setSelectedCandidate(null);
    requestAnimationFrame(() => lastDetailTriggerRef.current?.focus());
  }, []);

  const mascotState = useMemo<FoxMascotState>(() => {
    if (state.isParsing) {
      return "thinking";
    }

    const latestResult = [...state.messages]
      .reverse()
      .find((message) => message.type === "ledger_result");

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
      aria-busy={state.isParsing || hasBusyBatch}
    >
      <section className="chat-hero">
        <FoxMascot state={mascotState} />
        <div>
          <p>狐狐对话记账</p>
          <h2>告诉我这一笔</h2>
          <span>我会先整理成候选，核对前不会写入账本。</span>
        </div>
      </section>

      {!isOnline ? (
        <p className="form-message danger" role="status">
          当前离线，只能查看本次页面内已有候选，不能继续解析或保存。
        </p>
      ) : null}

      <ChatMessageList
        isOnline={isOnline}
        messages={state.messages}
        onConfirmBatch={(messageId) => void confirmBatch(messageId)}
        onOpenCandidate={(messageId, candidateId, trigger) => {
          lastDetailTriggerRef.current = trigger;
          setSelectedCandidate({ candidateId, messageId });
        }}
        onRemoveCandidate={(messageId, candidateId) => {
          removeCandidate(messageId, candidateId);

          if (
            selectedCandidate?.messageId === messageId &&
            selectedCandidate.candidateId === candidateId
          ) {
            closeDetails();
          }
        }}
        onRetryBatchSync={(messageId) => void retryBatchSync(messageId)}
      />

      <RecentAiBatchesPanel />

      <ChatComposer
        isOnline={isOnline}
        isParsing={state.isParsing}
        onListeningChange={setIsListening}
        onSend={sendMessage}
      />

      {selected ? (
        <BatchDetailSheet
          candidate={selected.candidate}
          onClose={closeDetails}
          onCompleteReview={() => {
            completeCandidateReview(selected.messageId, selected.candidate.id);
            closeDetails();
          }}
          onRemove={() => {
            removeCandidate(selected.messageId, selected.candidate.id);
            closeDetails();
          }}
          onUpdate={(patch) =>
            updateCandidate(selected.messageId, selected.candidate.id, patch)
          }
        />
      ) : null}
    </div>
  );
}
