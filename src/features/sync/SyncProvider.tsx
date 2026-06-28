import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthUser } from "@/auth/AuthProvider";
import { getCachedSyncMeta } from "@/features/transactions/localTransactions";
import { syncTransactionsCacheFromRemote } from "@/features/transactions/transactionSync";
import type { CacheSyncMeta } from "@/lib/localDb";
import { useNetworkStatus } from "@/lib/networkStatus";

type SyncContextValue = {
  isOnline: boolean;
  isSyncing: boolean;
  refreshAfterWrite: () => Promise<void>;
  syncError: string | null;
  syncMeta: CacheSyncMeta | null;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);
const autoSyncedUsers = new Set<string>();

export function SyncProvider({ children }: { children: ReactNode }) {
  const user = useAuthUser();
  const userId = user.id;
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  const syncMetaQuery = useQuery({
    queryFn: () => getCachedSyncMeta(userId),
    queryKey: ["syncMeta", userId],
  });

  const syncMutation = useMutation({
    mutationFn: () => syncTransactionsCacheFromRemote(userId),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["syncMeta", userId] });
      await queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", userId] });
      await queryClient.invalidateQueries({ queryKey: ["monthlySummary", userId] });
    },
  });
  const syncMutationRef = useRef(syncMutation);

  useEffect(() => {
    syncMutationRef.current = syncMutation;
  }, [syncMutation]);

  const syncNow = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    await syncMutationRef.current.mutateAsync();
  }, [isOnline]);

  const refreshAfterWrite = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    if (autoSyncedUsers.has(userId)) {
      return;
    }

    autoSyncedUsers.add(userId);
    syncMutationRef.current.mutate();
  }, [isOnline, userId]);

  const value: SyncContextValue = {
    isOnline,
    isSyncing: syncMutation.isPending,
    refreshAfterWrite,
    syncError:
      syncMutation.error instanceof Error
        ? syncMutation.error.message
        : syncMetaQuery.data?.last_error ?? null,
    syncMeta: syncMetaQuery.data ?? null,
    syncNow,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncState() {
  const value = useContext(SyncContext);

  if (!value) {
    throw new Error("useSyncState must be used inside SyncProvider.");
  }

  return value;
}
