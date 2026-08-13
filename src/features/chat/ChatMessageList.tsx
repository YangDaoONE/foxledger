import { useEffect, useRef } from "react";

import { LedgerResultCard } from "@/features/chat/LedgerResultCard";
import type { ChatMessage } from "@/features/chat/chatTypes";

type ChatMessageListProps = {
  isOnline: boolean;
  messages: ChatMessage[];
  onConfirmBatch: (messageId: string) => void;
  onOpenCandidate: (
    messageId: string,
    candidateId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onRemoveCandidate: (messageId: string, candidateId: string) => void;
  onRetryBatchSync: (messageId: string) => void;
};

export function ChatMessageList({
  isOnline,
  messages,
  onConfirmBatch,
  onOpenCandidate,
  onRemoveCandidate,
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
        <strong>说说刚刚发生的账单</strong>
        <p>狐狐只会解析你这次发送的文字，不会读取历史账单或统计。</p>
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
