import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, RotateCw, Trash2, Undo2 } from "lucide-react";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { StateBlock } from "@/components/ui/StateBlock";
import { useChatSession } from "@/features/chat/ChatSessionProvider";
import { ConfirmActionDialog } from "@/features/chat/ConfirmActionDialog";
import {
  DEFAULT_RECENT_AI_BATCH_LIMIT,
  listRecentAiBatches,
  type RecentAiBatch,
} from "@/features/chat/recentAiBatches";
import { SavedTransactionEditor } from "@/features/chat/SavedTransactionEditor";
import { useSyncState } from "@/features/sync/SyncProvider";
import type { TransactionFormValues } from "@/features/transactions/TransactionForm";
import type { CachedTransaction } from "@/features/transactions/types";
import {
  deleteTransaction,
  deleteTransactionsByIds,
  updateTransaction,
} from "@/features/transactions/transactionsApi";
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

export function RecentAiBatchesPanel() {
  const user = useAuthUser();
  const { beginBatchUndo, failBatchUndo, markBatchUndone } = useChatSession();
  const { isOnline, isSyncing, refreshAfterWrite } = useSyncState();
  const [visibleLimit, setVisibleLimit] = useState(DEFAULT_RECENT_AI_BATCH_LIMIT);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CachedTransaction | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [hasStaleCacheAfterWrite, setHasStaleCacheAfterWrite] = useState(false);
  const lastManagementTriggerRef = useRef<HTMLButtonElement | null>(null);
  const batchesQuery = useQuery({
    queryFn: () => listRecentAiBatches({ limit: visibleLimit, userId: user.id }),
    queryKey: queryKeys.recentAiBatchPage(user.id, visibleLimit),
  });
  const actionsDisabled =
    !isOnline || isSyncing || busyAction !== null || hasStaleCacheAfterWrite;

  function restoreManagementFocus() {
    requestAnimationFrame(() => lastManagementTriggerRef.current?.focus());
  }

  async function runManagedWrite(
    actionKey: string,
    remoteWrite: () => Promise<unknown>,
    successText: string,
    undoneBatchId?: string,
  ) {
    if (actionsDisabled) {
      return;
    }

    setBusyAction(actionKey);
    setActionMessage(null);
    let remoteSucceeded = false;

    if (undoneBatchId) {
      beginBatchUndo(undoneBatchId);
    }

    try {
      await remoteWrite();
      remoteSucceeded = true;
      setConfirmation(null);
      setEditingTransaction(null);
      restoreManagementFocus();

      if (undoneBatchId) {
        markBatchUndone(undoneBatchId);
      }

      try {
        await refreshAfterWrite();
        setActionMessage({ text: successText, tone: "success" });
      } catch (syncError) {
        setHasStaleCacheAfterWrite(true);
        setActionMessage({
          text: `${successText}，但本地缓存暂时没有刷新成功。${getErrorMessage(
            syncError,
            "请重新同步。",
          )}`,
          tone: "warning",
        });
      }
    } catch (error) {
      if (!remoteSucceeded) {
        const message = getErrorMessage(error, "操作失败，请稍后重试。");
        setConfirmation(null);
        restoreManagementFocus();

        if (undoneBatchId) {
          failBatchUndo(undoneBatchId, message);
        }

        setActionMessage({
          text: message,
          tone: "danger",
        });
        throw error;
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function retryCacheSync() {
    if (!isOnline || busyAction !== null) {
      return;
    }

    setBusyAction("retry-sync");

    try {
      await refreshAfterWrite();
      setHasStaleCacheAfterWrite(false);
      setActionMessage({ text: "本地缓存已重新同步。", tone: "success" });
    } catch (error) {
      setActionMessage({
        text: `本地缓存仍未刷新成功。${getErrorMessage(error, "请稍后重试。")}`,
        tone: "warning",
      });
    } finally {
      setBusyAction(null);
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

      {hasStaleCacheAfterWrite ? (
        <AppButton
          disabled={!isOnline || busyAction !== null}
          icon={<RotateCw size={16} />}
          type="button"
          onClick={() => void retryCacheSync()}
        >
          重新同步
        </AppButton>
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
          onSubmit={(values: TransactionFormValues) =>
            runManagedWrite(
              `edit:${editingTransaction.id}`,
              () => updateTransaction(user.id, editingTransaction.id, values),
              "账单已修改。",
            )
          }
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
            if (confirmation.kind === "undo") {
              void runManagedWrite(
                `undo:${confirmation.batch.batchId}`,
                () =>
                  deleteTransactionsByIds(
                    user.id,
                    confirmation.batch.transactions.map((transaction) => transaction.id),
                  ),
                `已撤销这一批的 ${confirmation.batch.transactionCount} 笔账单。`,
                confirmation.batch.batchId,
              ).catch(() => undefined);
            } else {
              void runManagedWrite(
                `delete:${confirmation.transaction.id}`,
                () => deleteTransaction(user.id, confirmation.transaction.id),
                "账单已删除，批次合计已按剩余账单重算。",
              ).catch(() => undefined);
            }
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
