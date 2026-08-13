import { useEffect, useRef } from "react";

import { LedgerResultCard } from "@/features/chat/LedgerResultCard";
import { LedgerQueryResultCard } from "@/features/chat/LedgerQueryResultCard";
import { AppButton } from "@/components/ui/AppButton";
import type { ChatMessage } from "@/features/chat/chatTypes";
import type { ForcedChatIntent } from "@shared/chatIntent";

type ChatMessageListProps = {
  isOnline: boolean;
  messages: ChatMessage[];
  onConfirmBatch: (messageId: string) => void;
  onCorrectIntent: (text: string, intent: ForcedChatIntent) => void;
  onOpenCandidate: (
    messageId: string,
    candidateId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onRemoveCandidate: (messageId: string, candidateId: string) => void;
  onOpenQueryTransactions: (messageId: string, operationIndex: number) => void;
  onRetryBatchSync: (messageId: string) => void;
};

export function ChatMessageList({
  isOnline,
  messages,
  onConfirmBatch,
  onCorrectIntent,
  onOpenCandidate,
  onRemoveCandidate,
  onOpenQueryTransactions,
  onRetryBatchSync,
}: ChatMessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const shouldFollowMessagesRef = useRef(true);

  useEffect(() => {
    if (!shouldFollowMessagesRef.current) {
      return;
    }

    const list = listRef.current;
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    list?.scrollTo?.({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      top: list.scrollHeight,
    });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="chat-empty">
        <strong>记一笔，或问问账本</strong>
        <p>
          记账只解析当前文字；问账会读取当前用户的云端相关统计，并向 AI 提供最多 500 条五字段明细。
        </p>
      </div>
    );
  }

  return (
    <div
      className="chat-message-list"
      ref={listRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        shouldFollowMessagesRef.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
    >
      {messages.map((message) => {
        if (message.type === "ledger_result") {
          return (
            <div className="chat-message assistant" key={message.id}>
              <LedgerResultCard
                batch={message.batch}
                isOnline={isOnline}
                messageId={message.id}
                onConfirm={onConfirmBatch}
                onOpenCandidate={onOpenCandidate}
                onRemoveCandidate={onRemoveCandidate}
                onRetrySync={onRetryBatchSync}
              />
            </div>
          );
        }

        if (message.type === "query_result") {
          return (
            <div className="chat-message assistant" key={message.id}>
              <LedgerQueryResultCard
                result={message.result}
                onOpenTransactions={(operationIndex) =>
                  onOpenQueryTransactions(message.id, operationIndex)
                }
              />
            </div>
          );
        }

        if (message.type === "intent_notice") {
          return (
            <div className="chat-message assistant intent-notice" key={message.id}>
              <span>{message.text}</span>
              <div className="intent-correction-actions">
                <AppButton
                  disabled={!isOnline}
                  type="button"
                  variant="secondary"
                  onClick={() => onCorrectIntent(message.originalText, "record_transaction")}
                >
                  我是想记账
                </AppButton>
                <AppButton
                  disabled={!isOnline}
                  type="button"
                  variant="secondary"
                  onClick={() => onCorrectIntent(message.originalText, "query_ledger")}
                >
                  我是想问账
                </AppButton>
              </div>
            </div>
          );
        }

        if (message.type === "parsing") {
          return (
            <div
              aria-live="polite"
              className="chat-message assistant parsing"
              key={message.id}
              role="status"
            >
              <span className="thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>狐狐正在理解这次输入…</span>
            </div>
          );
        }

        return (
          <div
            className={`chat-message ${message.role} ${message.type}`}
            key={message.id}
          >
            {message.text}
          </div>
        );
      })}
    </div>
  );
}
