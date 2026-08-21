import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SyncProvider, useSyncState } from "@/features/sync/SyncProvider";
import type { CacheSyncMeta } from "@/lib/localDb";

const mocks = vi.hoisted(() => ({
  getCachedSyncMeta: vi.fn(),
  syncTransactionsCacheFromRemote: vi.fn(),
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuthUser: () => ({ id: "user-1" }),
}));

vi.mock("@/features/transactions/localTransactions", () => ({
  getCachedSyncMeta: mocks.getCachedSyncMeta,
}));

vi.mock("@/features/transactions/transactionSync", () => ({
  syncTransactionsCacheFromRemote: mocks.syncTransactionsCacheFromRemote,
}));

vi.mock("@/lib/networkStatus", () => ({
  useNetworkStatus: () => true,
}));

function SyncStateProbe() {
  const { isSyncing, syncMeta } = useSyncState();

  return (
    <>
      <span data-testid="is-syncing">{String(isSyncing)}</span>
      <span data-testid="row-count">{syncMeta?.row_count ?? "none"}</span>
    </>
  );
}

describe("SyncProvider", () => {
  beforeEach(() => {
    mocks.getCachedSyncMeta.mockResolvedValue(null);
  });

  it("页面查询刷新未完成时也会结束同步状态", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const neverFinishes = new Promise<void>(() => undefined);
    vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(neverFinishes);

    const syncMeta: CacheSyncMeta = {
      last_error: null,
      last_successful_sync_at: "2026-08-13T07:00:00.000Z",
      row_count: 3,
      sync_state: "synced",
      updated_at: "2026-08-13T07:00:00.000Z",
      user_id: "user-1",
    };
    let finishSync!: (meta: CacheSyncMeta) => void;
    mocks.syncTransactionsCacheFromRemote.mockImplementation(
      () =>
        new Promise<CacheSyncMeta>((resolve) => {
          finishSync = resolve;
        }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <SyncProvider>
          <SyncStateProbe />
        </SyncProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("is-syncing")).toHaveTextContent("true"));

    await act(async () => {
      finishSync(syncMeta);
    });

    await waitFor(() => expect(screen.getByTestId("is-syncing")).toHaveTextContent("false"));
    expect(screen.getByTestId("row-count")).toHaveTextContent("3");
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(6);
  });
});
