import {
  deleteManualTransactionDraft,
  readManualTransactionDraft,
  saveManualTransactionDraft,
  type ManualTransactionDraftCache,
} from "@/lib/localDb";
import { getLocalDateInputValue } from "@/lib/date";
import type { TransactionType } from "@/types/transaction";

export type ManualTransactionDraftValues = {
  type: TransactionType;
  amount: string;
  category: string;
  date: string;
  merchant: string;
  payment_method: string;
  note: string;
};

export const emptyManualTransactionDraft: ManualTransactionDraftValues = {
  type: "expense",
  amount: "",
  category: "其他",
  date: getLocalDateInputValue(),
  merchant: "",
  payment_method: "",
  note: "",
};

export function hasManualTransactionDraftContent(draft: ManualTransactionDraftValues) {
  return Boolean(
    draft.amount.trim() ||
      draft.category !== "其他" ||
      draft.date !== getLocalDateInputValue() ||
      draft.merchant.trim() ||
      draft.payment_method.trim() ||
      draft.note.trim() ||
      draft.type !== "expense",
  );
}

export async function readManualDraft(userId: string): Promise<ManualTransactionDraftValues | null> {
  const draft = await readManualTransactionDraft(userId);

  if (!draft) {
    return null;
  }

  return {
    type: draft.type,
    amount: draft.amount,
    category: draft.category,
    date: draft.date,
    merchant: draft.merchant,
    payment_method: draft.payment_method,
    note: draft.note,
  };
}

export async function saveManualDraft(userId: string, draft: ManualTransactionDraftValues) {
  const nextDraft: ManualTransactionDraftCache = {
    user_id: userId,
    ...draft,
    updated_at: new Date().toISOString(),
  };

  await saveManualTransactionDraft(nextDraft);
}

export async function clearManualDraft(userId: string) {
  await deleteManualTransactionDraft(userId);
}
