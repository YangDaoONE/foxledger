import {
  validateConfirmTransactionDraft,
} from "@/features/ai/aiCandidateRules";
import type {
  AiBatchStatus,
  ChatCandidate,
  ChatCandidateBatch,
} from "@/features/chat/chatTypes";

export type CandidateBatchSummary = {
  balance: number;
  expense: number;
  expenseCount: number;
  income: number;
  incomeCount: number;
  transactionCount: number;
  transferCount: number;
};

export function getCandidateIssues(candidate: ChatCandidate) {
  const issues = validateConfirmTransactionDraft(candidate.draft);

  if (candidate.requiresReview) {
    issues.unshift("这笔候选需要你核对后才能确认。");
  }

  return issues;
}

export function getCandidateBatchStatus(
  candidates: ChatCandidate[],
): Extract<AiBatchStatus, "draft" | "needs_attention"> {
  if (
    candidates.length === 0 ||
    candidates.some((candidate) => getCandidateIssues(candidate).length > 0)
  ) {
    return "needs_attention";
  }

  return "draft";
}

export function canConfirmCandidateBatch(batch: ChatCandidateBatch) {
  return (
    batch.status === "draft" &&
    batch.candidates.length > 0 &&
    batch.candidates.every((candidate) => getCandidateIssues(candidate).length === 0)
  );
}

export function summarizeCandidateBatch(
  candidates: ChatCandidate[],
): CandidateBatchSummary {
  return candidates.reduce<CandidateBatchSummary>(
    (summary, candidate) => {
      const amount = Math.abs(Number(candidate.draft.amount));
      const safeAmount = Number.isFinite(amount) ? amount : 0;

      summary.transactionCount += 1;

      if (candidate.draft.type === "expense") {
        summary.expense += safeAmount;
        summary.expenseCount += 1;
      } else if (candidate.draft.type === "income") {
        summary.income += safeAmount;
        summary.incomeCount += 1;
      } else {
        summary.transferCount += 1;
      }

      summary.balance = summary.income - summary.expense;
      return summary;
    },
    {
      balance: 0,
      expense: 0,
      expenseCount: 0,
      income: 0,
      incomeCount: 0,
      transactionCount: 0,
      transferCount: 0,
    },
  );
}
