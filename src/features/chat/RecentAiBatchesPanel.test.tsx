import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecentAiBatchPage } from "@/features/chat/recentAiBatches";
import type { CachedTransaction } from "@/features/transactions/types";

const mocks = vi.hoisted(() => ({
  beginBatchUndo: vi.fn(),
  deleteTransaction: vi.fn(),
  deleteTransactionsByIds: vi.fn(),
  failBatchUndo: vi.fn(),
  isOnline: true,
  listRecentAiBatches: vi.fn(),
  markBatchUndone: vi.fn(),
  refreshAfterWrite: vi.fn(),
  updateTransaction: vi.fn(),
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuthUser: () => ({ id: "user-1" }),
}));

vi.mock("@/features/chat/ChatSessionProvider", () => ({
  useChatSession: () => ({
    beginBatchUndo: mocks.beginBatchUndo,
    failBatchUndo: mocks.failBatchUndo,
    markBatchUndone: mocks.markBatchUndone,
  }),
}));

vi.mock("@/features/chat/recentAiBatches", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/chat/recentAiBatches")>();
  return {
    ...original,
    listRecentAiBatches: mocks.listRecentAiBatches,
  };
});

vi.mock("@/features/sync/SyncProvider", () => ({
  useSyncState: () => ({
    isOnline: mocks.isOnline,
    isSyncing: false,
    refreshAfterWrite: mocks.refreshAfterWrite,
  }),
}));

vi.mock("@/features/transactions/transactionsApi", () => ({
  deleteTransaction: mocks.deleteTransaction,
  deleteTransactionsByIds: mocks.deleteTransactionsByIds,
  updateTransaction: mocks.updateTransaction,
}));

import { RecentAiBatchesPanel } from "@/features/chat/RecentAiBatchesPanel";

const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createTransaction(id: string, amount = 32): CachedTransaction {
  return {
    ai_batch_id: batchId,
    amount,
    cache_key: `user-1:${id}`,
    category: "餐饮",
    created_at: "2026-08-13T01:00:00.000Z",
    currency: "CNY",
    date: "2026-08-13",
    id,
    merchant: "小狐餐厅",
    note: null,
    payment_method: null,
    source: "ai",
    type: "expense",
    updated_at: "2026-08-13T01:00:00.000Z",
    user_id: "user-1",
  };
}

function createPage(transactions = [createTransaction("transaction-1")]): RecentAiBatchPage {
  const expense = transactions.reduce((total, transaction) => total + transaction.amount, 0);
  return {
    batches: [
      {
        balance: -expense,
        batchCreatedAt: transactions[0].created_at,
        batchId,
        expense,
        income: 0,
        latestCreatedAt: transactions[transactions.length - 1].created_at,
        transactionCount: transactions.length,
        transactions,
      },
    ],
    hasMore: false,
    totalCount: 1,
  };
}

function renderPanel(page = createPage()) {
  mocks.listRecentAiBatches.mockResolvedValue(page);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RecentAiBatchesPanel />
    </QueryClientProvider>,
  );
}

describe("最近 AI 批次保存后管理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOnline = true;
    mocks.deleteTransaction.mockResolvedValue(undefined);
    mocks.deleteTransactionsByIds.mockResolvedValue(1);
    mocks.refreshAfterWrite.mockResolvedValue(undefined);
    mocks.updateTransaction.mockResolvedValue(undefined);
  });

  it("离线允许查看，但禁用编辑、删除和整批撤销", async () => {
    mocks.isOnline = false;
    renderPanel();

    expect(await screen.findByText("离线时可以查看批次，但不能修改、删除或撤销。")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "编辑" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "撤销这一批" })).toBeDisabled();
  });

  it("正式单笔编辑复用当前用户约束，远端成功后刷新缓存", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("金额"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(mocks.updateTransaction).toHaveBeenCalledTimes(1));
    expect(mocks.updateTransaction).toHaveBeenCalledWith(
      "user-1",
      "transaction-1",
      expect.objectContaining({ amount: "40" }),
    );
    await waitFor(() => expect(mocks.refreshAfterWrite).toHaveBeenCalledTimes(1));
  });

  it("单笔删除要求二次确认，然后刷新并由剩余缓存重算", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "删除" }));
    expect(screen.getByRole("heading", { name: "删除这笔账单？" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() =>
      expect(mocks.deleteTransaction).toHaveBeenCalledWith("user-1", "transaction-1"),
    );
    expect(mocks.refreshAfterWrite).toHaveBeenCalledTimes(1);
  });

  it("确认弹层圈定焦点，Escape 关闭后焦点回到触发按钮", async () => {
    renderPanel();
    const deleteButton = await screen.findByRole("button", { name: "删除" });
    fireEvent.click(deleteButton);

    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "删除这笔账单？" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(deleteButton).toHaveFocus());
  });

  it("部分删除后的整批撤销只提交当前剩余真实行", async () => {
    renderPanel(createPage([createTransaction("remaining-transaction", 6)]));
    fireEvent.click(await screen.findByRole("button", { name: "撤销这一批" }));
    expect(screen.getByText("将删除这一批当前剩余的 1 笔正式账单。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() =>
      expect(mocks.deleteTransactionsByIds).toHaveBeenCalledWith("user-1", [
        "remaining-transaction",
      ]),
    );
    expect(mocks.markBatchUndone).toHaveBeenCalledWith(batchId);
    expect(mocks.beginBatchUndo).toHaveBeenCalledWith(batchId);
  });

  it("远端删除成功但同步失败时锁定管理操作，重试只做同步", async () => {
    mocks.refreshAfterWrite
      .mockRejectedValueOnce(new Error("sync failed"))
      .mockResolvedValueOnce(undefined);
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "删除" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    expect(
      await screen.findByText(/账单已删除，批次合计已按剩余账单重算。.*本地缓存暂时没有刷新成功/),
    ).toBeInTheDocument();
    expect(mocks.deleteTransaction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "重新同步" }));

    await waitFor(() => expect(mocks.refreshAfterWrite).toHaveBeenCalledTimes(2));
    expect(mocks.deleteTransaction).toHaveBeenCalledTimes(1);
  });

  it("整批远端删除失败时撤销 undoing 状态，不误标为已撤销", async () => {
    mocks.deleteTransactionsByIds.mockRejectedValueOnce(new Error("delete failed"));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "撤销这一批" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    expect(await screen.findByText("delete failed")).toBeInTheDocument();
    expect(mocks.beginBatchUndo).toHaveBeenCalledWith(batchId);
    expect(mocks.failBatchUndo).toHaveBeenCalledWith(batchId, "delete failed");
    expect(mocks.markBatchUndone).not.toHaveBeenCalled();
  });
});
