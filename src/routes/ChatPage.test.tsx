import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertAiBatchTransactionsForUser: vi.fn(),
  refreshAfterWrite: vi.fn(),
  sendFoxChatMessage: vi.fn(),
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
    isOnline: true,
    isSyncing: false,
    refreshAfterWrite: mocks.refreshAfterWrite,
  }),
}));

vi.mock("@/lib/networkStatus", () => ({
  getNetworkOnlineState: () => true,
}));

vi.mock("@/features/transactions/transactionsApi", () => ({
  AiBatchSaveStateError: class AiBatchSaveStateError extends Error {},
  deleteTransaction: vi.fn(),
  deleteTransactionsByIds: vi.fn(),
  insertAiBatchTransactionsForUser: mocks.insertAiBatchTransactionsForUser,
  updateTransaction: vi.fn(),
}));

vi.mock("@/features/chat/recentAiBatches", () => ({
  DEFAULT_RECENT_AI_BATCH_LIMIT: 20,
  listRecentAiBatches: vi.fn().mockResolvedValue({
    batches: [],
    hasMore: false,
    totalCount: 0,
  }),
}));

import { ChatSessionProvider } from "@/features/chat/ChatSessionProvider";
import { ChatPage } from "@/routes/ChatPage";

describe("ChatPage 候选闭环", () => {
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
});
