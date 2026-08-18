import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, Undo2 } from "lucide-react";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { StateBlock } from "@/components/ui/StateBlock";
import { ConfirmActionDialog } from "@/features/chat/ConfirmActionDialog";
import {
  DEFAULT_RECENT_AI_BATCH_LIMIT,
  listRecentAiBatches,
  type RecentAiBatch,
} from "@/features/chat/recentAiBatches";
import { SavedTransactionEditor } from "@/features/chat/SavedTransactionEditor";
import type { AiBatchManagement } from "@/features/chat/useAiBatchManagement";
import type { TransactionFormValues } from "@/features/transactions/TransactionForm";
import type { CachedTransaction } from "@/features/transactions/types";
import { getTransactionTypeLabel } from "@/features/transactions/transactionRules";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

type Confirmation =
  | { batch: RecentAiBatch; kind: "undo" }
  | { batch: RecentAiBatch; kind: "delete"; transaction: CachedTransaction };

type ActionMessage = {
  text: string;
  tone: "danger" | "success" | "warning";
};

type RecentAiBatchesPanelProps = {
  management: AiBatchManagement;
};

export function RecentAiBatchesPanel({ management }: RecentAiBatchesPanelProps) {
  const user = useAuthUser();
  const [visibleLimit, setVisibleLimit] = useState(DEFAULT_RECENT_AI_BATCH_LIMIT);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CachedTransaction | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const lastManagementTriggerRef = useRef<HTMLButtonElement | null>(null);
  const batchesQuery = useQuery({
    queryFn: () => listRecentAiBatches({ limit: visibleLimit, userId: user.id }),
    queryKey: queryKeys.recentAiBatchPage(user.id, visibleLimit),
  });
  const { actionsDisabled, busyAction, isOnline } = management;

  function restoreManagementFocus() {
    requestAnimationFrame(() => lastManagementTriggerRef.current?.focus());
  }

  async function submitTransactionEdit(values: TransactionFormValues) {
    if (!editingTransaction) {
      return;
    }

    const result = await management.updateSavedTransaction(
      editingTransaction.id,
      values,
    );

    if (!result) {
      return;
    }

    setEditingTransaction(null);
    setActionMessage({ text: "账单已修改。", tone: "success" });
    restoreManagementFocus();
  }

  async function confirmManagedAction() {
    if (!confirmation) {
      return;
    }

    const currentConfirmation = confirmation;
    setActionMessage(null);

    try {
      const result =
        currentConfirmation.kind === "undo"
          ? await management.undoSavedBatch(currentConfirmation.batch)
          : await management.deleteSavedTransaction(
              currentConfirmation.batch,
              currentConfirmation.transaction.id,
            );

      if (!result) {
        return;
      }

      setConfirmation(null);
      setActionMessage({
        text:
          currentConfirmation.kind === "undo"
            ? `已撤销这一批的 ${currentConfirmation.batch.transactionCount} 笔账单。`
            : "账单已删除，批次合计已按剩余账单重算。",
        tone: "success",
      });
      restoreManagementFocus();
    } catch (error) {
      setConfirmation(null);
      setActionMessage({
        text: getErrorMessage(error, "操作失败，请稍后重试。"),
        tone: "danger",
      });
      restoreManagementFocus();
    }
  }

  const page = batchesQuery.data;

  return (
    <section className="recent-ai-section" aria-labelledby="recent-ai-title">
      <header className="recent-ai-heading">
        <div>
          <span>已同步缓存</span>
          <h2 id="recent-ai-title">最近 AI 记账</h2>
        </div>
        <small>{page ? `共 ${page.totalCount} 批` : "从本地缓存读取"}</small>
      </header>

      {!isOnline ? (
        <p className="form-message">离线时可以查看批次，但不能修改、删除或撤销。</p>
      ) : null}

      {actionMessage ? (
        <p className={`form-message ${actionMessage.tone}`} role="status">
          {actionMessage.text}
        </p>
      ) : null}

      {batchesQuery.isLoading ? (
        <StateBlock title="读取最近批次">正在读取已同步缓存。</StateBlock>
      ) : null}
      {batchesQuery.error ? (
        <StateBlock title="最近批次读取失败" tone="danger">
          {getErrorMessage(batchesQuery.error, "无法读取最近 AI 批次。")}
        </StateBlock>
      ) : null}
      {!batchesQuery.isLoading && page?.batches.length === 0 ? (
        <p className="recent-ai-empty">还没有已同步的 AI 记账批次。</p>
      ) : null}

      <div className="recent-ai-list">
        {page?.batches.map((batch) => (
          <details className="recent-batch-card" key={batch.batchId}>
            <summary>
              <div>
                <strong>{batch.transactionCount} 笔账单</strong>
                <span>{formatBatchTime(batch.batchCreatedAt)}</span>
              </div>
              <div className="recent-batch-totals">
                <span>支出 {formatCurrency(batch.expense)}</span>
                <span>收入 {formatCurrency(batch.income)}</span>
              </div>
            </summary>

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
                      onClick={(event) => {
                        lastManagementTriggerRef.current = event.currentTarget;
                        setEditingTransaction(transaction);
                      }}
                    >
                      编辑
                    </AppButton>
                    <AppButton
                      disabled={actionsDisabled}
                      icon={<Trash2 size={15} />}
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        lastManagementTriggerRef.current = event.currentTarget;
                        setConfirmation({ batch, kind: "delete", transaction });
                      }}
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
              onClick={(event) => {
                lastManagementTriggerRef.current = event.currentTarget;
                setConfirmation({ batch, kind: "undo" });
              }}
            >
              撤销这一批
            </AppButton>
          </details>
        ))}
      </div>

      {page?.hasMore ? (
        <AppButton
          type="button"
          variant="secondary"
          onClick={() =>
            setVisibleLimit((current) => current + DEFAULT_RECENT_AI_BATCH_LIMIT)
          }
        >
          加载更多批次
        </AppButton>
      ) : null}

      {editingTransaction ? (
        <SavedTransactionEditor
          isSubmitting={busyAction === `edit:${editingTransaction.id}`}
          transaction={editingTransaction}
          onClose={() => {
            if (!busyAction) {
              setEditingTransaction(null);
              restoreManagementFocus();
            }
          }}
          onSubmit={submitTransactionEdit}
        />
      ) : null}

      {confirmation ? (
        <ConfirmActionDialog
          description={
            confirmation.kind === "undo"
              ? `将删除这一批当前剩余的 ${confirmation.batch.transactionCount} 笔正式账单。`
              : "删除后无法恢复；批次合计会按剩余账单重新计算。"
          }
          isBusy={busyAction !== null}
          title={confirmation.kind === "undo" ? "撤销整批账单？" : "删除这笔账单？"}
          onCancel={() => {
            setConfirmation(null);
            restoreManagementFocus();
          }}
          onConfirm={() => {
            void confirmManagedAction();
          }}
        />
      ) : null}
    </section>
  );
}

function formatBatchTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}
