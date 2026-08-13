import { X } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import { validateConfirmTransactionDraft } from "@/features/ai/aiCandidateRules";
import type { ConfirmTransactionDraft } from "@/features/ai/types";
import type { ChatCandidate } from "@/features/chat/chatTypes";
import { useModalDialog } from "@/features/chat/useModalDialog";
import {
  defaultCategories,
  transactionTypeOptions,
} from "@/features/transactions/transactionRules";

type BatchDetailSheetProps = {
  candidate: ChatCandidate;
  onClose: () => void;
  onCompleteReview: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<ConfirmTransactionDraft>) => void;
};

export function BatchDetailSheet({
  candidate,
  onClose,
  onCompleteReview,
  onRemove,
  onUpdate,
}: BatchDetailSheetProps) {
  const { dialogRef, initialFocusRef } = useModalDialog({ onClose });
  const validationMessages = validateConfirmTransactionDraft(candidate.draft);

  return (
    <div
      className="batch-sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="candidate-sheet-title"
        aria-modal="true"
        className="batch-sheet"
        ref={dialogRef}
        role="dialog"
      >
        <header className="batch-sheet-header">
          <div>
            <span>候选详情</span>
            <h2 id="candidate-sheet-title">核对这笔账单</h2>
          </div>
          <AppButton
            aria-label="关闭候选详情"
            icon={<X size={17} />}
            ref={initialFocusRef}
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            关闭
          </AppButton>
        </header>

        <div className="form-stack">
          <div className="chip-row" aria-label="账单类型">
            {transactionTypeOptions.map((option) => (
              <Chip
                active={candidate.draft.type === option.value}
                key={option.value}
                onClick={() => onUpdate({ type: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>

          <div className="form-grid two">
            <TextField
              inputMode="decimal"
              label="金额"
              onChange={(amount) => onUpdate({ amount })}
              value={candidate.draft.amount}
            />
            <label className="field">
              <span>分类</span>
              <select
                value={candidate.draft.category}
                onChange={(event) => onUpdate({ category: event.target.value })}
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
            onChange={(date) => onUpdate({ date })}
            type="date"
            value={candidate.draft.date}
          />
          <TextField
            label="商家"
            onChange={(merchant) => onUpdate({ merchant })}
            value={candidate.draft.merchant}
          />
          <TextField
            label="支付方式"
            onChange={(payment_method) => onUpdate({ payment_method })}
            value={candidate.draft.payment_method}
          />
          <TextField
            label="备注"
            onChange={(note) => onUpdate({ note })}
            value={candidate.draft.note}
          />

          <p className="candidate-raw">本次输入片段：{candidate.source.raw_text}</p>

          {validationMessages.length > 0 ? (
            <div className="error-list" role="alert">
              {validationMessages.map((message) => <p key={message}>{message}</p>)}
            </div>
          ) : null}

          {candidate.requiresReview ? (
            <p className="form-message">
              狐狐标记了不确定项。请检查上面的字段，然后点击“完成核对”。
            </p>
          ) : (
            <p className="form-message">这笔候选已完成核对。</p>
          )}
        </div>

        <div className="form-actions batch-sheet-actions">
          <AppButton type="button" variant="danger" onClick={onRemove}>
            移除候选
          </AppButton>
          <AppButton
            disabled={validationMessages.length > 0 || !candidate.requiresReview}
            type="button"
            onClick={onCompleteReview}
          >
            {candidate.requiresReview ? "完成核对" : "已核对"}
          </AppButton>
        </div>
      </section>
    </div>
  );
}
