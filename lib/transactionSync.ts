import {
  readSyncMeta,
  recordSyncFailure,
  replaceCachedTransactions,
  type SyncMeta,
} from "@/lib/localDb";
import { listAllRemoteTransactionsForCurrentUser } from "@/lib/transactions";

export type TransactionSyncResult = {
  meta: SyncMeta | null;
  syncedCount: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "同步账单失败。";
}

export async function getCachedSyncMeta(userId: string): Promise<SyncMeta | null> {
  return readSyncMeta(userId);
}

export async function syncTransactionsFromRemote(userId: string): Promise<TransactionSyncResult> {
  try {
    const remoteTransactions = await listAllRemoteTransactionsForCurrentUser();
    const hasMismatchedUser = remoteTransactions.some((transaction) => transaction.user_id !== userId);

    if (hasMismatchedUser) {
      throw new Error("同步结果包含非当前用户账单，已停止写入本地缓存。");
    }

    const meta = await replaceCachedTransactions(userId, remoteTransactions);

    return {
      meta,
      syncedCount: remoteTransactions.length,
    };
  } catch (error) {
    await recordSyncFailure(userId, getErrorMessage(error)).catch(() => null);
    throw error;
  }
}
