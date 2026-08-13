import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  from: vi.fn(),
  markSyncFailed: vi.fn(),
  replaceCachedTransactionsForUser: vi.fn(),
}));

vi.mock("@/features/transactions/localTransactions", () => ({
  markSyncFailed: mocks.markSyncFailed,
  replaceCachedTransactionsForUser: mocks.replaceCachedTransactionsForUser,
}));

vi.mock("@/lib/networkStatus", () => ({
  getNetworkOnlineState: () => true,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from },
}));

import { syncTransactionsCacheFromRemote } from "@/features/transactions/transactionSync";

afterEach(() => {
  vi.clearAllMocks();
});

function createRemoteQuery(result: unknown) {
  const query = {
    abortSignal: mocks.abortSignal,
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  mocks.abortSignal.mockResolvedValue(result);
  mocks.from.mockReturnValue(query);
  return query;
}

describe("全量同步缓存边界", () => {
  it("远端页失败时记录失败但不替换上次完整缓存", async () => {
    createRemoteQuery({
      data: null,
      error: { message: "permission denied for table transactions" },
    });
    mocks.markSyncFailed.mockResolvedValue(undefined);

    await expect(
      syncTransactionsCacheFromRemote("failure-user"),
    ).rejects.toThrow("当前账号没有读取账单的权限");
    expect(mocks.markSyncFailed).toHaveBeenCalledOnce();
    expect(mocks.replaceCachedTransactionsForUser).not.toHaveBeenCalled();
  });

  it("成功页把 ai_batch_id 一并交给原子缓存替换", async () => {
    const aiBatchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    createRemoteQuery({
      data: [
        {
          ai_batch_id: aiBatchId,
          amount: "12.50",
          category: "餐饮",
          created_at: "2026-08-13T01:00:00.000Z",
          currency: "CNY",
          date: "2026-08-13",
          id: "transaction-1",
          merchant: null,
          note: null,
          payment_method: null,
          source: "ai",
          type: "expense",
          updated_at: "2026-08-13T01:00:00.000Z",
          user_id: "success-user",
        },
      ],
      error: null,
    });
    mocks.replaceCachedTransactionsForUser.mockResolvedValue({
      last_error: null,
      last_successful_sync_at: "2026-08-13T01:00:00.000Z",
      row_count: 1,
      sync_state: "synced",
      updated_at: "2026-08-13T01:00:00.000Z",
      user_id: "success-user",
    });

    await syncTransactionsCacheFromRemote("success-user");

    expect(mocks.replaceCachedTransactionsForUser).toHaveBeenCalledWith({
      transactions: [expect.objectContaining({ ai_batch_id: aiBatchId })],
      userId: "success-user",
    });
  });
});
