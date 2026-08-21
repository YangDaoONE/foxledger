import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthUser } from "@/auth/AuthProvider";
import { useChatSession } from "@/features/chat/ChatSessionProvider";
import type { RecentAiBatch } from "@/features/chat/recentAiBatches";
import { useSyncState } from "@/features/sync/SyncProvider";
import type { TransactionFormValues } from "@/features/transactions/TransactionForm";
import {
  deleteTransaction as deleteRemoteTransaction,
  deleteTransactionsByIds,
  updateTransaction as updateRemoteTransaction,
} from "@/features/transactions/transactionsApi";
import { getErrorMessage } from "@/lib/errors";

export type ManagedBatchWriteResult = {
  cacheStatus: "stale" | "synced";
};

export type AiBatchManagement = {
  actionsDisabled: boolean;
  busyAction: string | null;
  deleteSavedTransaction: (
    batch: RecentAiBatch,
    transactionId: string,
  ) => Promise<ManagedBatchWriteResult | null>;
  hasStaleCacheAfterWrite: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  retryCacheSync: () => Promise<void>;
  staleCacheMessage: string | null;
  undoSavedBatch: (
    batch: RecentAiBatch,
  ) => Promise<ManagedBatchWriteResult | null>;
  updateSavedTransaction: (
    transactionId: string,
    values: TransactionFormValues,
  ) => Promise<ManagedBatchWriteResult | null>;
};

type ManagedWriteOptions = {
  actionKey: string;
  onRemoteFailure?: (message: string) => void;
  onRemoteStart?: () => void;
  onRemoteSuccess?: () => void;
  remoteWrite: () => Promise<unknown>;
};

export function useAiBatchManagement(): AiBatchManagement {
  const user = useAuthUser();
  const { beginBatchUndo, failBatchUndo, markBatchUndone } = useChatSession();
  const {
    isOnline,
    isSyncing,
    refreshAfterWrite,
    syncError,
    syncMeta,
  } = useSyncState();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [hasStaleCacheAfterWrite, setHasStaleCacheAfterWrite] = useState(false);
  const [staleCacheMessage, setStaleCacheMessage] = useState<string | null>(null);
  const activeActionRef = useRef(false);
  const staleSyncBaselineRef = useRef<string | null>(null);
  const lastSuccessfulSyncAt = syncMeta?.last_successful_sync_at ?? null;
  const actionsDisabled =
    !isOnline || isSyncing || busyAction !== null || hasStaleCacheAfterWrite;

  useEffect(() => {
    if (
      !hasStaleCacheAfterWrite ||
      isSyncing ||
      syncError ||
      lastSuccessfulSyncAt === staleSyncBaselineRef.current
    ) {
      return;
    }

    setHasStaleCacheAfterWrite(false);
    setStaleCacheMessage(null);
    staleSyncBaselineRef.current = null;
  }, [hasStaleCacheAfterWrite, isSyncing, lastSuccessfulSyncAt, syncError]);

  const runManagedWrite = useCallback(async ({
    actionKey,
    onRemoteFailure,
    onRemoteStart,
    onRemoteSuccess,
    remoteWrite,
  }: ManagedWriteOptions): Promise<ManagedBatchWriteResult | null> => {
    if (
      !isOnline ||
      isSyncing ||
      hasStaleCacheAfterWrite ||
      activeActionRef.current
    ) {
      return null;
    }

    activeActionRef.current = true;
    setBusyAction(actionKey);
    onRemoteStart?.();

    try {
      try {
        await remoteWrite();
      } catch (error) {
        const message = getErrorMessage(error, "操作失败，请稍后重试。");
        onRemoteFailure?.(message);
        throw error;
      }

      onRemoteSuccess?.();

      try {
        await refreshAfterWrite();
        return { cacheStatus: "synced" };
      } catch (error) {
        staleSyncBaselineRef.current = lastSuccessfulSyncAt;
        setHasStaleCacheAfterWrite(true);
        setStaleCacheMessage(
          getErrorMessage(
            error,
            "请重新同步后继续管理。",
          ),
        );
        return { cacheStatus: "stale" };
      }
    } finally {
      activeActionRef.current = false;
      setBusyAction(null);
    }
  }, [hasStaleCacheAfterWrite, isOnline, isSyncing, lastSuccessfulSyncAt, refreshAfterWrite]);

  const updateSavedTransaction = useCallback(
    (transactionId: string, values: TransactionFormValues) =>
      runManagedWrite({
        actionKey: `edit:${transactionId}`,
        remoteWrite: () =>
          updateRemoteTransaction(user.id, transactionId, values, {
            allowLedgerMove: false,
          }),
      }),
    [runManagedWrite, user.id],
  );

  const deleteSavedTransaction = useCallback(
    (batch: RecentAiBatch, transactionId: string) =>
      runManagedWrite({
        actionKey: `delete:${transactionId}`,
        onRemoteSuccess:
          batch.transactionCount === 1
            ? () => markBatchUndone(batch.batchId)
            : undefined,
        remoteWrite: () => deleteRemoteTransaction(user.id, transactionId),
      }),
    [markBatchUndone, runManagedWrite, user.id],
  );

  const undoSavedBatch = useCallback(
    (batch: RecentAiBatch) =>
      runManagedWrite({
        actionKey: `undo:${batch.batchId}`,
        onRemoteFailure: (message) => failBatchUndo(batch.batchId, message),
        onRemoteStart: () => beginBatchUndo(batch.batchId),
        onRemoteSuccess: () => markBatchUndone(batch.batchId),
        remoteWrite: () =>
          deleteTransactionsByIds(
            user.id,
            batch.transactions.map((transaction) => transaction.id),
          ),
      }),
    [beginBatchUndo, failBatchUndo, markBatchUndone, runManagedWrite, user.id],
  );

  const retryCacheSync = useCallback(async () => {
    if (!isOnline || isSyncing || activeActionRef.current) {
      return;
    }

    activeActionRef.current = true;
    setBusyAction("retry-sync");

    try {
      await refreshAfterWrite();
      setHasStaleCacheAfterWrite(false);
      setStaleCacheMessage(null);
      staleSyncBaselineRef.current = null;
    } catch (error) {
      setHasStaleCacheAfterWrite(true);
      setStaleCacheMessage(
        getErrorMessage(error, "本地缓存仍未刷新成功，请稍后重试。"),
      );
    } finally {
      activeActionRef.current = false;
      setBusyAction(null);
    }
  }, [isOnline, isSyncing, refreshAfterWrite]);

  return useMemo(
    () => ({
      actionsDisabled,
      busyAction,
      deleteSavedTransaction,
      hasStaleCacheAfterWrite,
      isOnline,
      isSyncing,
      retryCacheSync,
      staleCacheMessage,
      undoSavedBatch,
      updateSavedTransaction,
    }),
    [
      actionsDisabled,
      busyAction,
      deleteSavedTransaction,
      hasStaleCacheAfterWrite,
      isOnline,
      isSyncing,
      retryCacheSync,
      staleCacheMessage,
      undoSavedBatch,
      updateSavedTransaction,
    ],
  );
}
