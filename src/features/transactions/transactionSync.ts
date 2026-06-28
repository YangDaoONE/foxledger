import { getNetworkOnlineState } from "@/lib/networkStatus";

import {
  markSyncFailed,
  replaceCachedTransactionsForUser,
} from "@/features/transactions/localTransactions";
import type { CachedTransaction } from "@/features/transactions/types";
import type { CacheSyncMeta } from "@/lib/localDb";
import {
  normalizeRemoteCacheRow,
  TRANSACTION_CACHE_SELECT,
} from "@/features/transactions/transactionsApi";
import { supabase } from "@/lib/supabase";

const REMOTE_SYNC_PAGE_SIZE = 500;
const REMOTE_SYNC_MAX_PAGES = 20;
const REMOTE_SYNC_PAGE_TIMEOUT_MS = 20000;
export const REMOTE_SYNC_MAX_ROWS = REMOTE_SYNC_PAGE_SIZE * REMOTE_SYNC_MAX_PAGES;

type RemoteRequestError = {
  name?: string;
  message?: string;
};

type RemoteCacheRow = Parameters<typeof normalizeRemoteCacheRow>[0];

const activeSyncs = new Map<string, Promise<CacheSyncMeta>>();

export async function syncTransactionsCacheFromRemote(userId: string) {
  const active = activeSyncs.get(userId);

  if (active) {
    return active;
  }

  const syncPromise = syncTransactionsCacheFromRemoteInternal(userId).finally(() => {
    if (activeSyncs.get(userId) === syncPromise) {
      activeSyncs.delete(userId);
    }
  });

  activeSyncs.set(userId, syncPromise);
  return syncPromise;
}

async function syncTransactionsCacheFromRemoteInternal(userId: string) {
  if (!getNetworkOnlineState()) {
    const message = "当前离线，无法同步缓存。";
    await markSyncFailed(userId, message);
    throw new Error(message);
  }

  const transactions: CachedTransaction[] = [];

  for (let pageIndex = 0; pageIndex < REMOTE_SYNC_MAX_PAGES; pageIndex += 1) {
    const from = pageIndex * REMOTE_SYNC_PAGE_SIZE;
    const to = from + REMOTE_SYNC_PAGE_SIZE - 1;
    const { data, error } = await fetchRemoteTransactionsPage(userId, from, to).catch(
      async (error: unknown) => {
        const message = getRemoteRequestErrorMessage(toRemoteRequestError(error));
        await markSyncFailed(userId, message);
        throw new Error(message);
      },
    );

    if (error) {
      const message = getRemoteRequestErrorMessage(error);
      await markSyncFailed(userId, message);
      throw new Error(message);
    }

    try {
      const rows = (((data ?? []) as unknown) as RemoteCacheRow[]).map((row) =>
        normalizeRemoteCacheRow(row, userId),
      );
      transactions.push(...rows);

      if (rows.length < REMOTE_SYNC_PAGE_SIZE) {
        return replaceCachedTransactionsForUser({ transactions, userId });
      }
    } catch (error) {
      const message = "远端账单数据格式异常，本次未替换缓存。";
      await markSyncFailed(userId, message);
      throw error instanceof Error ? new Error(`${message}${error.message}`) : new Error(message);
    }
  }

  const message = `账单数量超过 ${REMOTE_SYNC_MAX_ROWS} 条，本次未替换缓存。`;
  await markSyncFailed(userId, message);
  throw new Error(message);
}

async function fetchRemoteTransactionsPage(userId: string, from: number, to: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_SYNC_PAGE_TIMEOUT_MS);

  try {
    return await supabase
      .from("transactions")
      .select(TRANSACTION_CACHE_SELECT)
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
      .abortSignal(controller.signal);
  } catch (error) {
    if (isAbortError(error)) {
      return {
        data: null,
        error: {
          message: `同步请求超时，超过 ${Math.round(REMOTE_SYNC_PAGE_TIMEOUT_MS / 1000)} 秒未返回。`,
          name: "AbortError",
        },
      };
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): error is RemoteRequestError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as RemoteRequestError;
  const message = maybeError.message?.toLowerCase() ?? "";
  return maybeError.name === "AbortError" || message.includes("abort");
}

function toRemoteRequestError(error: unknown): RemoteRequestError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  if (error && typeof error === "object") {
    return error as RemoteRequestError;
  }

  return { message: String(error) };
}

export function getRemoteRequestErrorMessage(error: RemoteRequestError) {
  const message = error.message?.toLowerCase() ?? "";

  if (error.name === "AbortError" || message.includes("timeout") || message.includes("超时")) {
    return "同步请求超时，请检查网络后重试。";
  }

  if (message.includes("jwt") || message.includes("session") || message.includes("auth")) {
    return "登录状态可能已失效，请重新登录后再同步。";
  }

  if (message.includes("permission") || message.includes("rls")) {
    return "当前账号没有读取账单的权限，请确认权限配置后重试。";
  }

  return "同步请求失败，请检查网络后重试。";
}
