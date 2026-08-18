import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecentAiBatch } from "@/features/chat/recentAiBatches";

const mocks = vi.hoisted(() => ({
  deleteTransaction: vi.fn(),
  deleteTransactionsByIds: vi.fn(),
  getRecentAiBatch: vi.fn(),
  insertAiBatchTransactionsForUser: vi.fn(),
  isOnline: true,
  listRecentAiBatches: vi.fn(),
  refreshAfterWrite: vi.fn(),
  sendFoxChatMessage: vi.fn(),
  updateTransaction: vi.fn(),
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuthUser: () => ({ id: "user-1" }),
}));

vi.mock("@/features/chat/foxChatApi", () => ({
  MAX_FOX_CHAT_INPUT_CHARS: 3000,
  sendFoxChatMessage: mocks.sendFoxChatMessage,
}));

vi.mock("@/features/sync/SyncProvider", () => ({
  useSyncState: () => ({
    isOnline: mocks.isOnline,
    isSyncing: false,
    refreshAfterWrite: mocks.refreshAfterWrite,
    syncError: null,
    syncMeta: { last_successful_sync_at: "2026-08-18T00:00:00.000Z" },
  }),
}));

vi.mock("@/lib/networkStatus", () => ({
  getNetworkOnlineState: () => true,
}));

vi.mock("@/features/transactions/transactionsApi", () => ({
  AiBatchSaveStateError: class AiBatchSaveStateError extends Error {},
  deleteTransaction: mocks.deleteTransaction,
  deleteTransactionsByIds: mocks.deleteTransactionsByIds,
  insertAiBatchTransactionsForUser: mocks.insertAiBatchTransactionsForUser,
  updateTransaction: mocks.updateTransaction,
}));

vi.mock("@/features/chat/recentAiBatches", () => ({
  DEFAULT_RECENT_AI_BATCH_LIMIT: 20,
  getRecentAiBatch: mocks.getRecentAiBatch,
  listRecentAiBatches: mocks.listRecentAiBatches,
}));

import { ChatSessionProvider } from "@/features/chat/ChatSessionProvider";
import { ChatPage } from "@/routes/ChatPage";

describe("ChatPage 候选闭环", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOnline = true;
    mocks.getRecentAiBatch.mockResolvedValue(null);
    mocks.listRecentAiBatches.mockResolvedValue({
      batches: [],
      hasMore: false,
      totalCount: 0,
    });
    mocks.refreshAfterWrite.mockResolvedValue(undefined);
  });

  it("补全 clarification 候选并完成核对前不调用交易写 API", async () => {
    mocks.sendFoxChatMessage.mockResolvedValue({
      intent: "record_transaction",
      ledger_result: {
        max_input_chars: 3000,
        max_transactions: 50,
        transactions: [
          {
            account: null,
            ai_confidence: 0.5,
            amount: null,
            category: "餐饮",
            currency: "CNY",
            date: "2026-08-13",
            merchant: null,
            needs_clarification: true,
            note: null,
            payment_method: null,
            raw_text: "午饭",
            source: "ai",
            tag: null,
            type: "expense",
          },
        ],
        truncated: false,
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ChatSessionProvider>
          <ChatPage />
        </ChatSessionProvider>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "记一笔，也可以问问账本" }),
    ).toBeInTheDocument();
    const privacySummary = screen.getByText("数据与隐私");
    const privacyDetails = privacySummary.closest("details");
    expect(privacyDetails).not.toHaveAttribute("open");
    fireEvent.click(privacySummary);
    expect(privacyDetails).toHaveAttribute("open");
    expect(screen.getByText(/只解析你当前发送的文字/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("告诉狐狐要记的账或要问的账"), {
      target: { value: "午饭" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送给狐狐" }));

    await screen.findByText("需要核对");
    expect(screen.getByText("存在未补全或未核对候选，整批确认保持阻断。")).toBeInTheDocument();

    const detailTrigger = screen.getByRole("button", { name: /查看或编辑/ });
    fireEvent.click(detailTrigger);
    expect(screen.getByRole("button", { name: "关闭候选详情" })).toHaveFocus();
    fireEvent.change(screen.getByLabelText("金额"), { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: "完成核对" }));

    await waitFor(() => expect(screen.getByText("可以确认")).toBeInTheDocument());
    await waitFor(() => expect(detailTrigger).toHaveFocus());
    expect(screen.getByText("候选已核对，确认后才会写入账本。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认记账" })).toBeEnabled();
    expect(mocks.insertAiBatchTransactionsForUser).not.toHaveBeenCalled();
  });

  it("移除尚未保存的全部候选后明确结束本次记账，不再提示核对", async () => {
    mocks.sendFoxChatMessage.mockResolvedValue({
      intent: "record_transaction",
      ledger_result: {
        max_input_chars: 3000,
        max_transactions: 50,
        transactions: [createParsedTransaction()],
        truncated: false,
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ChatSessionProvider>
          <ChatPage />
        </ChatSessionProvider>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("告诉狐狐要记的账或要问的账"), {
      target: { value: "午饭 32" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送给狐狐" }));
    await screen.findByText("可以确认");

    fireEvent.click(screen.getByRole("button", { name: "移除 麦当劳 候选" }));

    expect(screen.getByText("已全部移除")).toBeInTheDocument();
    expect(screen.getByText("这次没有要记录的账单，无需核对。")).toBeInTheDocument();
    expect(screen.queryByText("需要核对")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认记账" })).not.toBeInTheDocument();
    expect(mocks.insertAiBatchTransactionsForUser).not.toHaveBeenCalled();
  });

  it("保存后可从原聊天卡管理 Dexie 正式批次，并按剩余真实行撤销", async () => {
    const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    let formalBatch: RecentAiBatch | null = createFormalBatch(batchId);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mocks.sendFoxChatMessage.mockResolvedValue({
      intent: "record_transaction",
      ledger_result: {
        max_input_chars: 3000,
        max_transactions: 50,
        transactions: [
          createParsedTransaction({ amount: 32, category: "餐饮", merchant: "麦当劳" }),
          createParsedTransaction({
            amount: 18,
            category: "交通",
            merchant: "滴滴",
            raw_text: "打车 18",
          }),
        ],
        truncated: false,
      },
    });
    mocks.insertAiBatchTransactionsForUser.mockImplementation(
      async (
        _userId: string,
        transactions: Array<{ ai_batch_id: string; id: string }>,
      ) => {
        const savedBatchId = transactions[0].ai_batch_id;

        if (formalBatch) {
          formalBatch = {
            ...formalBatch,
            batchId: savedBatchId,
            transactions: formalBatch.transactions.map((transaction) => ({
              ...transaction,
              ai_batch_id: savedBatchId,
            })),
          };
        }

        return {
          batchId: savedBatchId,
          coordinated: false,
          transactionIds: transactions.map((transaction) => transaction.id),
        };
      },
    );
    mocks.getRecentAiBatch.mockImplementation(async () => formalBatch);
    mocks.listRecentAiBatches.mockImplementation(async () => ({
      batches: formalBatch ? [formalBatch] : [],
      hasMore: false,
      totalCount: formalBatch ? 1 : 0,
    }));
    mocks.updateTransaction.mockImplementation(
      async (_userId: string, transactionId: string, values: { amount: string }) => {
        if (!formalBatch) {
          return;
        }

        formalBatch = recalculateFormalBatch({
          ...formalBatch,
          transactions: formalBatch.transactions.map((transaction) =>
            transaction.id === transactionId
              ? { ...transaction, amount: Number(values.amount) }
              : transaction,
          ),
        });
      },
    );
    mocks.deleteTransaction.mockImplementation(
      async (_userId: string, transactionId: string) => {
        if (!formalBatch) {
          return;
        }

        const transactions = formalBatch.transactions.filter(
          (transaction) => transaction.id !== transactionId,
        );
        formalBatch = transactions.length
          ? recalculateFormalBatch({ ...formalBatch, transactions })
          : null;
      },
    );
    mocks.deleteTransactionsByIds.mockImplementation(
      async (_userId: string, transactionIds: string[]) => {
        const deletedCount = formalBatch?.transactions.filter((transaction) =>
          transactionIds.includes(transaction.id),
        ).length ?? 0;
        formalBatch = null;
        return deletedCount;
      },
    );
    mocks.refreshAfterWrite.mockImplementation(async () => {
      await queryClient.invalidateQueries({ queryKey: ["recentAiBatches", "user-1"] });
    });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <ChatSessionProvider>
          <ChatPage />
        </ChatSessionProvider>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("告诉狐狐要记的账或要问的账"), {
      target: { value: "午饭 32，打车 18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送给狐狐" }));
    await screen.findByText("2 笔候选");
    const merchantCandidateButton = screen.getByRole("button", {
      name: "查看或编辑 麦当劳 候选",
    });
    const candidateCard = merchantCandidateButton.closest<HTMLElement>(
      ".ledger-result-card",
    );
    expect(candidateCard).not.toBeNull();
    expect(within(candidateCard!).getByText("麦当劳")).toBeInTheDocument();
    expect(
      within(candidateCard!).getByText("餐饮 · 支出 · 2026-08-18"),
    ).toBeInTheDocument();
    expect(within(candidateCard!).queryByText(/expense/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认记账" }));

    await screen.findByRole("button", { name: "详情" });
    expect(screen.getByText("已经记好了，共 2 笔。")).toBeInTheDocument();

    mocks.isOnline = false;
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ChatSessionProvider>
          <ChatPage />
        </ChatSessionProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "详情" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(await screen.findByRole("heading", { name: "正式账单详情" })).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "编辑" })[0],
    ).toBeDisabled();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "撤销这一批" }),
    ).toBeDisabled();

    mocks.isOnline = true;
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ChatSessionProvider>
          <ChatPage />
        </ChatSessionProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "编辑" })[0],
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("金额"), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await screen.findByText("账单已修改。");
    expect(screen.getByLabelText("本次正式账单摘要")).toHaveTextContent("¥53.00");
    expect(screen.getAllByText("¥53.00").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "删除" })[1],
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await screen.findByText("账单已删除，批次合计已按剩余账单重算。");
    expect(screen.getByLabelText("本次正式账单摘要")).toHaveTextContent("1 笔");

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "撤销这一批",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() => expect(screen.getByText("整批已撤销")).toBeInTheDocument());
    expect(mocks.deleteTransactionsByIds).toHaveBeenCalledWith("user-1", [
      "transaction-1",
    ]);
    expect(screen.queryByRole("heading", { name: "正式账单详情" })).not.toBeInTheDocument();
  });
});

function createParsedTransaction(overrides: Record<string, unknown> = {}) {
  return {
    account: null,
    ai_confidence: 0.9,
    amount: 32,
    category: "餐饮",
    currency: "CNY",
    date: "2026-08-18",
    merchant: "麦当劳",
    needs_clarification: false,
    note: null,
    payment_method: null,
    raw_text: "午饭 32",
    source: "ai",
    tag: null,
    type: "expense",
    ...overrides,
  };
}

function createFormalBatch(batchId: string): RecentAiBatch {
  return recalculateFormalBatch({
    balance: -50,
    batchCreatedAt: "2026-08-18T01:00:00.000Z",
    batchId,
    expense: 50,
    income: 0,
    latestCreatedAt: "2026-08-18T01:01:00.000Z",
    transactionCount: 2,
    transactions: [
      createCachedTransaction(batchId, "transaction-1", 32, "餐饮", "麦当劳"),
      createCachedTransaction(batchId, "transaction-2", 18, "交通", "滴滴"),
    ],
  });
}

function createCachedTransaction(
  batchId: string,
  id: string,
  amount: number,
  category: string,
  merchant: string,
) {
  return {
    ai_batch_id: batchId,
    amount,
    cache_key: `user-1:${id}`,
    category,
    created_at: id === "transaction-1"
      ? "2026-08-18T01:00:00.000Z"
      : "2026-08-18T01:01:00.000Z",
    currency: "CNY" as const,
    date: "2026-08-18",
    id,
    merchant,
    note: null,
    payment_method: null,
    source: "ai" as const,
    type: "expense" as const,
    updated_at: "2026-08-18T01:01:00.000Z",
    user_id: "user-1",
  };
}

function recalculateFormalBatch(batch: RecentAiBatch): RecentAiBatch {
  const expense = batch.transactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );

  return {
    ...batch,
    balance: -expense,
    expense,
    transactionCount: batch.transactions.length,
  };
}
