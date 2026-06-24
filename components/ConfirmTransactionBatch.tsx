"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Info,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { createAiTransactions } from "@/lib/aiTransactions";
import {
  createConfirmTransactionDraft,
  defaultCategories,
  isTransactionType,
  transactionTypeOptions,
  validateConfirmTransactionDraft,
} from "@/lib/transactionDrafts";
import type {
  ConfirmTransactionDraft,
  ParsedTransaction,
  ParsedTransactionBatch,
} from "@/types/transaction";

type CandidateState = {
  id: string;
  transaction: ParsedTransaction;
  draft: ConfirmTransactionDraft;
  selected: boolean;
};

type ConfirmTransactionBatchProps = {
  batch: ParsedTransactionBatch;
  isOnline: boolean;
  onSaved: (savedCount: number) => void;
};

function createCandidateStates(transactions: ParsedTransaction[]): CandidateState[] {
  return transactions.map((transaction, index) => ({
    id: `${index}-${transaction.raw_text}-${transaction.amount ?? "unknown"}`,
    transaction,
    draft: createConfirmTransactionDraft(transaction),
    selected: true,
  }));
}

function formatConfidence(value: number | null) {
  if (value === null) {
    return "未提供";
  }

  return `${Math.round(value * 100)}%`;
}

function getCandidateMessages(candidate: CandidateState) {
  return validateConfirmTransactionDraft(candidate.draft);
}

function canSaveCandidate(candidate: CandidateState) {
  return candidate.selected && getCandidateMessages(candidate).length === 0;
}

export function ConfirmTransactionBatch({ batch, isOnline, onSaved }: ConfirmTransactionBatchProps) {
  const [candidates, setCandidates] = useState<CandidateState[]>(() =>
    createCandidateStates(batch.transactions),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveableCandidates = useMemo(
    () => candidates.filter((candidate) => canSaveCandidate(candidate)),
    [candidates],
  );
  const selectedCount = useMemo(
    () => candidates.filter((candidate) => candidate.selected).length,
    [candidates],
  );
  const blockedSelectedCount = Math.max(selectedCount - saveableCandidates.length, 0);
  const canSave = isOnline && saveableCandidates.length > 0 && !isSaving;

  function updateCandidateDraft(id: string, updates: Partial<ConfirmTransactionDraft>) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, draft: { ...candidate.draft, ...updates } }
          : candidate,
      ),
    );
  }

  function toggleCandidate(id: string) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, selected: !candidate.selected }
          : candidate,
      ),
    );
  }

  function deleteCandidate(id: string) {
    setCandidates((current) => current.filter((candidate) => candidate.id !== id));
  }

  async function handleSave() {
    if (!canSave) {
      if (!isOnline) {
        setErrorMessage("联网后才能保存 AI 候选账单。");
      }
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const result = await createAiTransactions(
        saveableCandidates.map((candidate) => ({
          parsedTransaction: candidate.transaction,
          draft: candidate.draft,
        })),
      );
      setSuccessMessage(`保存成功：${result.count} 笔账单。`);
      onSaved(result.count);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <article className="confirm-card" aria-label="AI 批量解析结果为空">
        <div className="confirm-card-title">
          <Info size={18} aria-hidden="true" />
          <div>
            <p>AI 解析结果</p>
            <h3>没有可确认的候选账单</h3>
          </div>
        </div>
        <p className="confirm-note">请调整输入内容后重新解析。</p>
      </article>
    );
  }

  return (
    <div className="batch-confirm" aria-label="AI 批量解析确认列表">
      <div className="batch-confirm-summary">
        <div className="confirm-card-title">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <p>AI 解析结果</p>
            <h3>候选账单 {candidates.length} 条</h3>
          </div>
        </div>
        <p className="confirm-note">
          已选择 {selectedCount} 条，可保存 {saveableCandidates.length} 条。
          {batch.truncated ? ` 已按上限保留前 ${batch.max_transactions} 条。` : ""}
        </p>
      </div>

      {blockedSelectedCount > 0 ? (
        <p className="form-message error">有 {blockedSelectedCount} 条已选择候选仍需补充，暂不会保存。</p>
      ) : null}
      {!isOnline ? <p className="form-message error">联网后才能保存 AI 候选账单。</p> : null}
      {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
      {successMessage ? <p className="form-message success">{successMessage}</p> : null}

      <div className="batch-candidate-list">
        {candidates.map((candidate, index) => {
          const messages = getCandidateMessages(candidate);

          return (
            <article className="confirm-card batch-candidate" key={candidate.id}>
              <div className="batch-candidate-header">
                <div className="confirm-card-title">
                  {candidate.transaction.needs_clarification ? (
                    <AlertTriangle size={18} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={18} aria-hidden="true" />
                  )}
                  <div>
                    <p>候选 {index + 1}</p>
                    <h3>{candidate.selected ? "已选择" : "未选择"}</h3>
                  </div>
                </div>
                <div className="batch-candidate-actions">
                  <button
                    aria-label={candidate.selected ? "取消选择该候选" : "选择该候选"}
                    aria-pressed={candidate.selected}
                    className="small-icon-button"
                    disabled={isSaving}
                    title={candidate.selected ? "取消选择" : "选择"}
                    type="button"
                    onClick={() => toggleCandidate(candidate.id)}
                  >
                    {candidate.selected ? (
                      <CheckSquare size={17} aria-hidden="true" />
                    ) : (
                      <Square size={17} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    aria-label="删除该候选"
                    className="small-icon-button danger"
                    disabled={isSaving}
                    title="删除"
                    type="button"
                    onClick={() => deleteCandidate(candidate.id)}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="manual-grid two-columns">
                <label className="manual-field">
                  <span>类型</span>
                  <select
                    value={candidate.draft.type}
                    onChange={(event) => {
                      const nextType = event.target.value;
                      if (isTransactionType(nextType)) {
                        updateCandidateDraft(candidate.id, { type: nextType });
                      }
                    }}
                  >
                    {transactionTypeOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="manual-field">
                  <span>金额</span>
                  <input
                    inputMode="decimal"
                    placeholder="例如：38 或 -38"
                    type="number"
                    value={candidate.draft.amount}
                    onChange={(event) =>
                      updateCandidateDraft(candidate.id, { amount: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="manual-grid two-columns">
                <label className="manual-field">
                  <span>分类</span>
                  <select
                    value={candidate.draft.category}
                    onChange={(event) =>
                      updateCandidateDraft(candidate.id, { category: event.target.value })
                    }
                  >
                    {defaultCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="manual-field">
                  <span>日期</span>
                  <input
                    type="date"
                    value={candidate.draft.date}
                    onChange={(event) =>
                      updateCandidateDraft(candidate.id, { date: event.target.value })
                    }
                  />
                </label>
              </div>

              <label className="manual-field">
                <span>商家</span>
                <input
                  placeholder="可选"
                  type="text"
                  value={candidate.draft.merchant}
                  onChange={(event) =>
                    updateCandidateDraft(candidate.id, { merchant: event.target.value })
                  }
                />
              </label>

              <label className="manual-field">
                <span>支付方式</span>
                <input
                  placeholder="可选"
                  type="text"
                  value={candidate.draft.payment_method}
                  onChange={(event) =>
                    updateCandidateDraft(candidate.id, { payment_method: event.target.value })
                  }
                />
              </label>

              <label className="manual-field">
                <span>备注</span>
                <textarea
                  placeholder="可选"
                  rows={2}
                  value={candidate.draft.note}
                  onChange={(event) =>
                    updateCandidateDraft(candidate.id, { note: event.target.value })
                  }
                />
              </label>

              {messages.length > 0 ? (
                <div className="form-message error">
                  {messages.map((message) => (
                    <p className="compact-message" key={message}>
                      {message}
                    </p>
                  ))}
                </div>
              ) : null}
              {candidate.transaction.needs_clarification && messages.length === 0 ? (
                <p className="form-message success">已补全必要信息，可以保存。</p>
              ) : null}

              <dl className="confirm-readonly">
                <div>
                  <dt>置信度</dt>
                  <dd>{formatConfidence(candidate.transaction.ai_confidence)}</dd>
                </div>
                <div>
                  <dt>原文片段</dt>
                  <dd>{candidate.transaction.raw_text}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      <button
        className="primary-button manual-submit"
        type="button"
        disabled={!canSave}
        onClick={handleSave}
      >
        <Save size={18} aria-hidden="true" />
        {isSaving ? "保存中" : isOnline ? `确认保存 ${saveableCandidates.length} 笔` : "联网后可保存"}
      </button>
    </div>
  );
}
