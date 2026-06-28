import { useEffect, useMemo, useState } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import {
  createConfirmTransactionDraft,
  normalizeAiConfidence,
  validateAiTransactionDraft,
} from "@/features/ai/aiCandidateRules";
import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
} from "@/features/ai/types";
import type { TransactionWritePayload } from "@/features/transactions/types";
import {
  DEFAULT_CURRENCY,
  defaultCategories,
  transactionTypeOptions,
} from "@/features/transactions/transactionRules";
import { insertTransactions } from "@/features/transactions/transactionsApi";
import { toNullableText } from "@/features/transactions/transactionRules";

type ConfirmTransactionBatchProps = {
  isOnline: boolean;
  onSaved: () => Promise<void>;
  onClear: () => void;
  transactions: ParsedTransaction[];
  userId: string;
};

type CandidateState = {
  draft: ConfirmTransactionDraft;
  id: string;
  selected: boolean;
  source: ParsedTransaction;
};

export function ConfirmTransactionBatch({
  isOnline,
  onClear,
  onSaved,
  transactions,
  userId,
}: ConfirmTransactionBatchProps) {
  const initialCandidates = useMemo<CandidateState[]>(
    () =>
      transactions.map((transaction, index) => ({
        draft: createConfirmTransactionDraft(transaction),
        id: `${index}:${transaction.raw_text}`,
        selected: !transaction.needs_clarification,
        source: transaction,
      })),
    [transactions],
  );
  const [candidates, setCandidates] = useState(initialCandidates);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCandidates(initialCandidates);
    setMessage(null);
  }, [initialCandidates]);

  function updateDraft(index: number, nextDraft: Partial<ConfirmTransactionDraft>) {
    setCandidates((current) =>
      current.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, draft: { ...candidate.draft, ...nextDraft } }
          : candidate,
      ),
    );
  }

  function removeCandidate(index: number) {
    setCandidates((current) => current.filter((_, candidateIndex) => candidateIndex !== index));
  }

  async function handleSave() {
    if (!isOnline) {
      setMessage("离线时不能保存 AI 候选。");
      return;
    }

    const selectedCandidates = candidates.filter((candidate) => candidate.selected);

    if (selectedCandidates.length === 0) {
      setMessage("请选择至少一条候选账单。");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const payload = selectedCandidates.map<TransactionWritePayload>((candidate) => {
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
          merchant: toNullableText(candidate.draft.merchant),
          note: toNullableText(candidate.draft.note),
          payment_method: toNullableText(candidate.draft.payment_method),
          raw_text: candidate.source.raw_text,
          source: "ai",
          tag: toNullableText(candidate.source.tag),
          type: candidate.draft.type,
          user_id: userId,
        };
      });

      await insertTransactions(payload);
      await onSaved();
      onClear();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存 AI 候选失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="candidate-list">
      <div className="candidate-toolbar">
        <strong>候选账单</strong>
        <span>{candidates.filter((candidate) => candidate.selected).length} / {candidates.length}</span>
      </div>

      {candidates.map((candidate, index) => (
        <article className="candidate-card" key={candidate.id}>
          <label className="candidate-select">
            <input
              checked={candidate.selected}
              onChange={(event) =>
                setCandidates((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, selected: event.target.checked } : item,
                  ),
                )
              }
              type="checkbox"
            />
            <span>保存</span>
          </label>

          <div className="chip-row">
            {transactionTypeOptions.map((option) => (
              <Chip
                active={candidate.draft.type === option.value}
                key={option.value}
                onClick={() => updateDraft(index, { type: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>

          <div className="form-grid two">
            <TextField
              label="金额"
              onChange={(value) => updateDraft(index, { amount: value })}
              value={candidate.draft.amount}
            />
            <label className="field">
              <span>分类</span>
              <select
                value={candidate.draft.category}
                onChange={(event) => updateDraft(index, { category: event.target.value })}
              >
                {defaultCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <TextField
            label="日期"
            onChange={(value) => updateDraft(index, { date: value })}
            type="date"
            value={candidate.draft.date}
          />
          <TextField
            label="商家"
            onChange={(value) => updateDraft(index, { merchant: value })}
            value={candidate.draft.merchant}
          />
          <TextField
            label="备注"
            onChange={(value) => updateDraft(index, { note: value })}
            value={candidate.draft.note}
          />
          <p className="candidate-raw">{candidate.source.raw_text}</p>
          <AppButton type="button" variant="secondary" onClick={() => removeCandidate(index)}>
            删除候选
          </AppButton>
        </article>
      ))}

      {message ? <p className="form-message danger">{message}</p> : null}

      <div className="form-actions">
        <AppButton type="button" variant="secondary" onClick={onClear}>
          清空候选
        </AppButton>
        <AppButton disabled={!isOnline || isSaving} type="button" onClick={handleSave}>
          {isSaving ? "保存中..." : "确认保存"}
        </AppButton>
      </div>
    </div>
  );
}
