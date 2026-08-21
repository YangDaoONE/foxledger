import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
} from "@/features/ai/types";
import type { AiBatchInsertRequest } from "@/features/ai/aiBatchSave";
import type { FoxChatQueryClientResult } from "@/features/chat/foxChatApi";
import type { LedgerConversationContext } from "@shared/chatIntent";

export type ChatMessageType =
  | "error"
  | "intent_notice"
  | "ledger_result"
  | "parsing"
  | "query_result"
  | "text";
export type ChatRole = "assistant" | "system" | "user";

export type AiBatchStatus =
  | "draft"
  | "needs_attention"
  | "saving"
  | "saved"
  | "sync_warning"
  | "undoing"
  | "undone"
  | "error";

export type ChatCandidate = {
  draft: ConfirmTransactionDraft;
  id: string;
  requiresReview: boolean;
  source: ParsedTransaction;
};

export type ChatCandidateBatch = {
  canRetrySave: boolean;
  candidates: ChatCandidate[];
  error: string | null;
  id: string;
  ledgerId: string;
  saveRequest: AiBatchInsertRequest | null;
  status: AiBatchStatus;
  statusBeforeUndo: "saved" | "sync_warning" | null;
  transactionIds: string[];
  truncated: boolean;
};

type ChatMessageBase = {
  createdAt: string;
  id: string;
  role: ChatRole;
  type: ChatMessageType;
};

export type ChatTextMessage = ChatMessageBase & {
  role: "assistant" | "system" | "user";
  text: string;
  type: "error" | "text";
};

export type ChatParsingMessage = ChatMessageBase & {
  role: "assistant";
  type: "parsing";
};

export type ChatLedgerResultMessage = ChatMessageBase & {
  batch: ChatCandidateBatch;
  role: "assistant";
  type: "ledger_result";
};

export type ChatQueryResultMessage = ChatMessageBase & {
  ledgerId: string;
  result: FoxChatQueryClientResult;
  role: "assistant";
  type: "query_result";
};

export type ChatIntentNoticeMessage = ChatMessageBase & {
  originalText: string;
  role: "assistant";
  text: string;
  type: "intent_notice";
};

export type ChatMessage =
  | ChatIntentNoticeMessage
  | ChatLedgerResultMessage
  | ChatParsingMessage
  | ChatQueryResultMessage
  | ChatTextMessage;

export type ChatState = {
  isParsing: boolean;
  messages: ChatMessage[];
  previousContext: LedgerConversationContext | null;
  previousContextLedgerId: string | null;
  userId: string;
};
