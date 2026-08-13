import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParsedTransactionBatch } from "@/features/ai/types";

const mocks = vi.hoisted(() => ({
  insertAiBatchTransactionsForUser: vi.fn(),
  parseTransactionsWithAi: vi.fn(),
  refreshAfterWrite: vi.fn(),
  userId: "user-1",
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuthUser: () => ({ id: mocks.userId }),
}));

vi.mock("@/features/ai/parseTransactionApi", () => ({
  MAX_PARSE_INPUT_CHARS: 3000,
  parseTransactionsWithAi: mocks.parseTransactionsWithAi,
}));

vi.mock("@/features/sync/SyncProvider", () => ({
  useSyncState: () => ({ refreshAfterWrite: mocks.refreshAfterWrite }),
}));

vi.mock("@/features/transactions/transactionsApi", () => ({
  AiBatchSaveStateError: class AiBatchSaveStateError extends Error {},
  insertAiBatchTransactionsForUser: mocks.insertAiBatchTransactionsForUser,
}));

vi.mock("@/lib/networkStatus", () => ({
  getNetworkOnlineState: () => true,
}));

import {
  ChatSessionProvider,
  useChatSession,
} from "@/features/chat/ChatSessionProvider";

const parseResult: ParsedTransactionBatch = {
  max_input_chars: 3000,
  max_transactions: 50,
  transactions: [
    {
      account: null,
      ai_confidence: 0.9,
      amount: 32,
      category: "餐饮",
      currency: "CNY",
      date: "2026-08-13",
      merchant: null,
      needs_clarification: false,
      note: null,
      payment_method: null,
      raw_text: "午饭 32",
      source: "ai",
      tag: null,
      type: "expense",
    },
  ],
  truncated: false,
};

function SessionProbe() {
  const { confirmBatch, retryBatchSync, sendMessage, state } = useChatSession();
  const result = state.messages.find((message) => message.type === "ledger_result");

  return (
    <>
      <button type="button" onClick={() => void sendMessage("午饭 32")}>发送午饭</button>
      <button type="button" onClick={() => void sendMessage("地铁 6")}>发送地铁</button>
      <button
        disabled={!result}
        type="button"
        onClick={() => result && void confirmBatch(result.id)}
      >
        确认批次
      </button>
      <button
        disabled={!result}
        type="button"
        onClick={() => result && void retryBatchSync(result.id)}
      >
        重试同步
      </button>
      <output data-testid="message-count">{state.messages.length}</output>
      <output data-testid="batch-status">
        {result?.type === "ledger_result" ? result.batch.status : "none"}
      </output>
      <output data-testid="user-id">{state.userId}</output>
    </>
  );
}

describe("ChatSessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = "user-1";
    mocks.parseTransactionsWithAi.mockResolvedValue(parseResult);
    mocks.refreshAfterWrite.mockResolvedValue(undefined);
    mocks.insertAiBatchTransactionsForUser.mockImplementation(
      async (_userId: string, transactions: Array<{ ai_batch_id: string; id: string }>) => ({
        batchId: transactions[0].ai_batch_id,
        coordinated: false,
        transactionIds: transactions.map((transaction) => transaction.id),
      }),
    );
  });

  it("每次只把当前输入文本交给 parser，不发送历史消息或缓存", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));
    await waitFor(() => expect(mocks.parseTransactionsWithAi).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("message-count")).toHaveTextContent("2"));

    fireEvent.click(screen.getByRole("button", { name: "发送地铁" }));
    await waitFor(() => expect(mocks.parseTransactionsWithAi).toHaveBeenCalledTimes(2));

    expect(mocks.parseTransactionsWithAi.mock.calls).toEqual([
      ["午饭 32"],
      ["地铁 6"],
    ]);
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("用户隔离键变化时立即清空内存会话", async () => {
    const view = render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));
    await waitFor(() => expect(screen.getByTestId("message-count")).toHaveTextContent("2"));

    mocks.userId = "user-2";
    await act(async () => {
      view.rerender(
        <ChatSessionProvider>
          <SessionProbe />
        </ChatSessionProvider>,
      );
    });

    await waitFor(() => expect(screen.getByTestId("user-id")).toHaveTextContent("user-2"));
    expect(screen.getByTestId("message-count")).toHaveTextContent("0");
  });

  it("空解析只显示确定性错误，不创建空结果卡", async () => {
    mocks.parseTransactionsWithAi.mockResolvedValue({
      ...parseResult,
      transactions: [],
    });
    render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));

    await waitFor(() => expect(screen.getByTestId("message-count")).toHaveTextContent("2"));
    expect(mocks.parseTransactionsWithAi).toHaveBeenCalledWith("午饭 32");
  });

  it("远端保存成功但缓存刷新失败时不重复写入，只重试同步", async () => {
    mocks.refreshAfterWrite.mockRejectedValueOnce(new Error("sync failed"));
    render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));
    await waitFor(() => expect(screen.getByTestId("batch-status")).toHaveTextContent("draft"));
    fireEvent.click(screen.getByRole("button", { name: "确认批次" }));

    await waitFor(() =>
      expect(screen.getByTestId("batch-status")).toHaveTextContent("sync_warning"),
    );
    expect(mocks.insertAiBatchTransactionsForUser).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(screen.getByTestId("batch-status")).toHaveTextContent("saved"));
    expect(mocks.refreshAfterWrite).toHaveBeenCalledTimes(2);
    expect(mocks.insertAiBatchTransactionsForUser).toHaveBeenCalledTimes(1);
  });

  it("可重试保存沿用首次生成的 batch 与 transaction IDs", async () => {
    const requests: Array<Array<{ ai_batch_id: string; id: string }>> = [];
    mocks.insertAiBatchTransactionsForUser
      .mockImplementationOnce(async (_userId, transactions) => {
        requests.push(transactions);
        throw new Error("temporary failure");
      })
      .mockImplementationOnce(async (_userId, transactions) => {
        requests.push(transactions);
        return {
          batchId: transactions[0].ai_batch_id,
          coordinated: false,
          transactionIds: transactions.map((transaction: { id: string }) => transaction.id),
        };
      });
    render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));
    await waitFor(() => expect(screen.getByTestId("batch-status")).toHaveTextContent("draft"));
    fireEvent.click(screen.getByRole("button", { name: "确认批次" }));
    await waitFor(() => expect(screen.getByTestId("batch-status")).toHaveTextContent("error"));
    fireEvent.click(screen.getByRole("button", { name: "确认批次" }));
    await waitFor(() => expect(screen.getByTestId("batch-status")).toHaveTextContent("saved"));

    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
  });
});
