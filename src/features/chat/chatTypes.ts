import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
} from "@/features/ai/types";
import type { AiBatchInsertRequest } from "@/features/ai/aiBatchSave";

export type ChatMessageType = "error" | "ledger_result" | "parsing" | "text";
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

export type ChatMessage =
  | ChatLedgerResultMessage
  | ChatParsingMessage
  | ChatTextMessage;

export type ChatState = {
  isParsing: boolean;
  messages: ChatMessage[];
  userId: string;
};
