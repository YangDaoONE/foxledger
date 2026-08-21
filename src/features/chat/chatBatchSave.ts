import {
  normalizeAiConfidence,
  validateAiTransactionDraft,
} from "@/features/ai/aiCandidateRules";
import {
  createAiBatchInsertRequest,
  type AiBatchInsertRequest,
} from "@/features/ai/aiBatchSave";
import type { ChatCandidateBatch } from "@/features/chat/chatTypes";
import type { AiBatchTransactionInput } from "@/features/transactions/types";
import {
  DEFAULT_CURRENCY,
  toNullableText,
} from "@/features/transactions/transactionRules";

export function createChatBatchInsertRequest(
  batch: ChatCandidateBatch,
  uuidFactory?: () => string,
): AiBatchInsertRequest {
  const transactions = batch.candidates.map<AiBatchTransactionInput>((candidate) => {
    const { amount, category } = validateAiTransactionDraft(
      candidate.source,
      candidate.draft,
    );

    return {
      account: toNullableText(candidate.source.account),
      ai_confidence: normalizeAiConfidence(candidate.source.ai_confidence),
      amount,
      category,
      currency: DEFAULT_CURRENCY,
      date: candidate.draft.date,
      ledger_id: batch.ledgerId,
      merchant: toNullableText(candidate.draft.merchant),
      note: toNullableText(candidate.draft.note),
      payment_method: toNullableText(candidate.draft.payment_method),
      tag: toNullableText(candidate.source.tag),
      type: candidate.draft.type,
    };
  });

  return createAiBatchInsertRequest(transactions, uuidFactory);
}
