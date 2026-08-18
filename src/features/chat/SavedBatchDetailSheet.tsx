import { Pencil, RotateCw, Trash2, Undo2, X } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { StateBlock } from "@/components/ui/StateBlock";
import type { RecentAiBatch } from "@/features/chat/recentAiBatches";
import { useModalDialog } from "@/features/chat/useModalDialog";
import { getTransactionTypeLabel } from "@/features/transactions/transactionRules";
import { formatCurrency } from "@/lib/format";

type SavedBatchDetailSheetProps = {
  actionsDisabled: boolean;
  batch: RecentAiBatch | null;
  error: string | null;
  isLoading: boolean;
  isOnline: boolean;
  isRetrying: boolean;
  message: { text: string; tone: "danger" | "success" } | null;
  onClose: () => void;
  onDelete: (transactionId: string) => void;
  onEdit: (transactionId: string) => void;
  onRetrySync: () => void;
  onUndo: () => void;
};

export function SavedBatchDetailSheet({
  actionsDisabled,
  batch,
  error,
  isLoading,
  isOnline,
  isRetrying,
  message,
  onClose,
  onDelete,
  onEdit,
  onRetrySync,
  onUndo,
}: SavedBatchDetailSheetProps) {
  const { dialogRef, initialFocusRef } = useModalDialog({ onClose });

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
        aria-labelledby="saved-batch-detail-title"
        aria-modal="true"
        className="batch-sheet saved-batch-detail-sheet"
        ref={dialogRef}
        role="dialog"
      >
        <header className="batch-sheet-header">
          <div>
            <span>本次记账</span>
            <h2 id="saved-batch-detail-title">正式账单详情</h2>
          </div>
          <AppButton
            aria-label="关闭正式账单详情"
            icon={<X size={17} />}
            ref={initialFocusRef}
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            关闭
          </AppButton>
        </header>

        {!isOnline ? (
          <p className="form-message">
            当前离线，可以查看已同步详情，但不能编辑、删除或撤销。
          </p>
        ) : null}

        {message ? (
          <p className={`form-message ${message.tone}`} role="status">
            {message.text}
          </p>
        ) : null}

        {isLoading ? (
          <StateBlock title="读取正式账单">正在读取已同步缓存。</StateBlock>
        ) : error ? (
          <StateBlock title="正式详情读取失败" tone="danger">
            {error}
          </StateBlock>
        ) : !batch ? (
          <StateBlock title="暂未找到这批账单">
            本地缓存中暂时没有这批正式账单，请重新同步后再试。
          </StateBlock>
        ) : (
          <>
            <div className="saved-batch-summary" aria-label="本次正式账单摘要">
              <span>
                账单数<strong>{batch.transactionCount} 笔</strong>
              </span>
              <span>
                支出<strong>{formatCurrency(batch.expense)}</strong>
              </span>
              <span>
                收入<strong>{formatCurrency(batch.income)}</strong>
              </span>
            </div>

            <div className="recent-batch-transactions">
              {batch.transactions.map((transaction) => (
                <article className="recent-transaction-row" key={transaction.id}>
                  <div>
                    <strong>{transaction.merchant || transaction.category}</strong>
                    <span>
                      {transaction.date} · {getTransactionTypeLabel(transaction.type)} · {transaction.category}
                    </span>
                  </div>
                  <strong>{formatCurrency(transaction.amount)}</strong>
                  <div className="recent-transaction-actions">
                    <AppButton
                      disabled={actionsDisabled}
                      icon={<Pencil size={15} />}
                      type="button"
                      variant="ghost"
                      onClick={() => onEdit(transaction.id)}
                    >
                      编辑
                    </AppButton>
                    <AppButton
                      disabled={actionsDisabled}
                      icon={<Trash2 size={15} />}
                      type="button"
                      variant="ghost"
                      onClick={() => onDelete(transaction.id)}
                    >
                      删除
                    </AppButton>
                  </div>
                </article>
              ))}
            </div>

            <AppButton
              disabled={actionsDisabled}
              icon={<Undo2 size={16} />}
              type="button"
              variant="danger"
              onClick={onUndo}
            >
              撤销这一批
            </AppButton>
          </>
        )}

        {!isLoading && (!batch || error) ? (
          <AppButton
            disabled={!isOnline || isRetrying}
            icon={<RotateCw size={16} />}
            type="button"
            onClick={onRetrySync}
          >
            {isRetrying ? "同步中" : "重新同步"}
          </AppButton>
        ) : null}
      </section>
    </div>
  );
}
