import { useEffect, useMemo, useRef, useState } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import {
  createConfirmTransactionDraft,
  normalizeAiConfidence,
  validateAiTransactionDraft,
} from "@/features/ai/aiCandidateRules";
import {
  createAiBatchInsertRequest,
  type AiBatchInsertRequest,
} from "@/features/ai/aiBatchSave";
import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
} from "@/features/ai/types";
import type { AiBatchTransactionInput } from "@/features/transactions/types";
import { useActiveLedger, useLedgerState } from "@/features/ledgers/LedgerProvider";
import { LedgerSelectField } from "@/features/ledgers/LedgerSelectField";
import {
  DEFAULT_CURRENCY,
  defaultCategories,
  toNullableText,
  transactionTypeOptions,
} from "@/features/transactions/transactionRules";
import { insertAiBatchTransactionsForUser } from "@/features/transactions/transactionsApi";
import { getErrorMessage } from "@/lib/errors";

type ConfirmTransactionBatchProps = {
  isOnline: boolean;
  onSaved: () => Promise<void>;
  onClear: () => void;
  onPendingChange: (isPending: boolean) => void;
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
  onPendingChange,
  onSaved,
  transactions,
  userId,
}: ConfirmTransactionBatchProps) {
  const activeLedger = useActiveLedger();
  const { ledgers } = useLedgerState();
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
  const [hasPendingBatch, setHasPendingBatch] = useState(false);
  const [ledgerId, setLedgerId] = useState(activeLedger.id);
  const pendingBatchRef = useRef<AiBatchInsertRequest | null>(null);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    setCandidates(initialCandidates);
    setMessage(null);
    setHasPendingBatch(false);
    setLedgerId(activeLedger.id);
    pendingBatchRef.current = null;
    onPendingChange(false);
  }, [activeLedger.id, initialCandidates, onPendingChange]);

  function updateDraft(index: number, nextDraft: Partial<ConfirmTransactionDraft>) {
    if (pendingBatchRef.current) {
      return;
    }

    setCandidates((current) =>
      current.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, draft: { ...candidate.draft, ...nextDraft } }
          : candidate,
      ),
    );
  }

  function removeCandidate(index: number) {
    if (pendingBatchRef.current) {
      return;
    }

    setCandidates((current) => current.filter((_, candidateIndex) => candidateIndex !== index));
  }

  async function handleSave() {
    if (saveInFlightRef.current) {
      return;
    }

    if (!isOnline) {
      setMessage("离线时不能保存 AI 候选。");
      return;
    }

    const selectedCandidates = candidates.filter((candidate) => candidate.selected);

    if (!pendingBatchRef.current && selectedCandidates.length === 0) {
      setMessage("请选择至少一条候选账单。");
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    setMessage(null);

    try {
      let pendingBatch = pendingBatchRef.current;

      if (!pendingBatch) {
        const payload = selectedCandidates.map<AiBatchTransactionInput>((candidate) => {
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
            ledger_id: ledgerId,
            merchant: toNullableText(candidate.draft.merchant),
            note: toNullableText(candidate.draft.note),
            payment_method: toNullableText(candidate.draft.payment_method),
            tag: toNullableText(candidate.source.tag),
            type: candidate.draft.type,
          };
        });

        pendingBatch = createAiBatchInsertRequest(payload);
        pendingBatchRef.current = pendingBatch;
        setHasPendingBatch(true);
        onPendingChange(true);
      }

      await insertAiBatchTransactionsForUser(userId, pendingBatch.transactions);
      await onSaved();
      onClear();
      onPendingChange(false);
    } catch (error) {
      setMessage(getErrorMessage(error, "保存 AI 候选失败。"));
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="candidate-list">
      <LedgerSelectField
        disabled={hasPendingBatch || isSaving}
        ledgers={ledgers}
        value={ledgerId}
        onChange={setLedgerId}
      />
      <div className="candidate-toolbar">
        <strong>候选账单</strong>
        <span>{candidates.filter((candidate) => candidate.selected).length} / {candidates.length}</span>
      </div>

      {candidates.map((candidate, index) => (
        <article className="candidate-card" key={candidate.id}>
          <label className="candidate-select">
            <input
              checked={candidate.selected}
              disabled={hasPendingBatch || isSaving}
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
                disabled={hasPendingBatch || isSaving}
                key={option.value}
                onClick={() => updateDraft(index, { type: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>

          <div className="form-grid two">
            <TextField
              disabled={hasPendingBatch || isSaving}
              label="金额"
              onChange={(value) => updateDraft(index, { amount: value })}
              value={candidate.draft.amount}
            />
            <label className="field">
              <span>分类</span>
              <select
                disabled={hasPendingBatch || isSaving}
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
            disabled={hasPendingBatch || isSaving}
            label="日期"
            onChange={(value) => updateDraft(index, { date: value })}
            type="date"
            value={candidate.draft.date}
          />
          <TextField
            disabled={hasPendingBatch || isSaving}
            label="商家"
            onChange={(value) => updateDraft(index, { merchant: value })}
            value={candidate.draft.merchant}
          />
          <TextField
            disabled={hasPendingBatch || isSaving}
            label="备注"
            onChange={(value) => updateDraft(index, { note: value })}
            value={candidate.draft.note}
          />
          <p className="candidate-raw">{candidate.source.raw_text}</p>
          <AppButton
            disabled={hasPendingBatch || isSaving}
            type="button"
            variant="secondary"
            onClick={() => removeCandidate(index)}
          >
            删除候选
          </AppButton>
        </article>
      ))}

      {message ? <p className="form-message danger">{message}</p> : null}
      {hasPendingBatch ? (
        <p className="form-message">本批账单 ID 已固定；重试不会生成新的账单。</p>
      ) : null}

      <div className="form-actions">
        <AppButton
          disabled={hasPendingBatch || isSaving}
          type="button"
          variant="secondary"
          onClick={onClear}
        >
          清空候选
        </AppButton>
        <AppButton disabled={!isOnline || isSaving} type="button" onClick={handleSave}>
          {isSaving ? "保存中..." : "确认保存"}
        </AppButton>
      </div>
    </div>
  );
}
