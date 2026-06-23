"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { createAiTransaction } from "@/lib/aiTransactions";
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
} from "@/types/transaction";

type ConfirmTransactionProps = {
  transaction: ParsedTransaction;
  onSaved: () => void;
};

function formatConfidence(value: number | null) {
  if (value === null) {
    return "未提供";
  }

  return `${Math.round(value * 100)}%`;
}

export function ConfirmTransaction({ transaction, onSaved }: ConfirmTransactionProps) {
  const [draft, setDraft] = useState<ConfirmTransactionDraft>(() =>
    createConfirmTransactionDraft(transaction),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const validationMessages = useMemo(() => validateConfirmTransactionDraft(draft), [draft]);
  const canSave = !transaction.needs_clarification && validationMessages.length === 0 && !isSaving;

  async function handleSave() {
    if (!canSave) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      await createAiTransaction(transaction, draft);
      setSuccessMessage("保存成功");
      onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (transaction.needs_clarification) {
    return (
      <article className="confirm-card" aria-label="AI 解析需要补充信息">
        <div className="confirm-card-title">
          <Info size={18} aria-hidden="true" />
          <div>
            <p>需要补充</p>
            <h3>AI 没有找到明确金额</h3>
          </div>
        </div>
        <p className="confirm-note">请补充金额后重新解析。本阶段不做多轮对话，也不会直接入库。</p>
        <dl className="confirm-readonly">
          <div>
            <dt>原文</dt>
            <dd>{transaction.raw_text}</dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd>{transaction.source}</dd>
          </div>
        </dl>
      </article>
    );
  }

  return (
    <article className="confirm-card" aria-label="AI 解析确认卡片">
      <div className="confirm-card-title">
        <CheckCircle2 size={18} aria-hidden="true" />
        <div>
          <p>AI 解析结果</p>
          <h3>确认后下一阶段保存</h3>
        </div>
      </div>

      <div className="manual-grid two-columns">
        <label className="manual-field">
          <span>类型</span>
          <select
            value={draft.type}
            onChange={(event) => {
              const nextType = event.target.value;
              if (isTransactionType(nextType)) {
                setDraft((value) => ({ ...value, type: nextType }));
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
            name="confirm-amount"
            placeholder="例如：38 或 -38"
            type="number"
            value={draft.amount}
            onChange={(event) => setDraft((value) => ({ ...value, amount: event.target.value }))}
          />
        </label>
      </div>

      <div className="manual-grid two-columns">
        <label className="manual-field">
          <span>分类</span>
          <select
            value={draft.category}
            onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))}
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
            value={draft.date}
            onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))}
          />
        </label>
      </div>

      <label className="manual-field">
        <span>商家</span>
        <input
          placeholder="可选"
          type="text"
          value={draft.merchant}
          onChange={(event) => setDraft((value) => ({ ...value, merchant: event.target.value }))}
        />
      </label>

      <label className="manual-field">
        <span>支付方式</span>
        <input
          placeholder="可选"
          type="text"
          value={draft.payment_method}
          onChange={(event) =>
            setDraft((value) => ({ ...value, payment_method: event.target.value }))
          }
        />
      </label>

      <label className="manual-field">
        <span>备注</span>
        <textarea
          placeholder="可选"
          rows={2}
          value={draft.note}
          onChange={(event) => setDraft((value) => ({ ...value, note: event.target.value }))}
        />
      </label>

      {validationMessages.length > 0 ? (
        <div className="form-message error">
          {validationMessages.map((message) => (
            <p className="compact-message" key={message}>
              {message}
            </p>
          ))}
        </div>
      ) : null}
      {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
      {successMessage ? <p className="form-message success">{successMessage}</p> : null}

      <dl className="confirm-readonly">
        <div>
          <dt>币种</dt>
          <dd>{transaction.currency}</dd>
        </div>
        <div>
          <dt>标签</dt>
          <dd>{transaction.tag ?? "未提供"}</dd>
        </div>
        <div>
          <dt>账户</dt>
          <dd>{transaction.account ?? "未提供"}</dd>
        </div>
        <div>
          <dt>置信度</dt>
          <dd>{formatConfidence(transaction.ai_confidence)}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{transaction.source}</dd>
        </div>
        <div>
          <dt>原文</dt>
          <dd>{transaction.raw_text}</dd>
        </div>
      </dl>

      <button className="primary-button manual-submit" type="button" disabled={!canSave} onClick={handleSave}>
        {isSaving ? "保存中" : "确认保存"}
      </button>
    </article>
  );
}
