import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParsedTransactionBatch } from "@/features/ai/types";

const mocks = vi.hoisted(() => ({
  insertAiBatchTransactionsForUser: vi.fn(),
  refreshAfterWrite: vi.fn(),
  sendFoxChatMessage: vi.fn(),
  userId: "user-1",
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuthUser: () => ({ id: mocks.userId }),
}));

vi.mock("@/features/chat/foxChatApi", () => ({
  MAX_FOX_CHAT_INPUT_CHARS: 3000,
  sendFoxChatMessage: mocks.sendFoxChatMessage,
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

function createQueryResult(label = "本月") {
  const plan = {
    answer_goal: "summary" as const,
    operations: [
      {
        filters: {
          categories: ["餐饮"],
          keyword: null,
          maxAmount: null,
          merchants: [],
          minAmount: null,
          types: ["expense" as const],
        },
        groupBy: ["category" as const],
        metrics: ["expense" as const],
        order: "amount_desc" as const,
        range: {
          endDate: "2026-08-31",
          label,
          startDate: "2026-08-01",
        },
      },
    ],
  };

  return {
    answer: {
      evidenceRefs: [],
      metricRefs: ["operations.0.stats.summary.expense"],
      suggestion: null,
      text: "本月餐饮支出 ¥32.00。",
    },
    answer_error: null,
    answer_status: "ready" as const,
    context: { date_anchor: "2026-08-13", intent: "query_ledger" as const, plan },
    intent: "query_ledger" as const,
    operations: [],
    plan,
  };
}

describe("ChatSessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = "user-1";
    mocks.sendFoxChatMessage.mockResolvedValue({
      intent: "record_transaction",
      ledger_result: parseResult,
    });
    mocks.refreshAfterWrite.mockResolvedValue(undefined);
    mocks.insertAiBatchTransactionsForUser.mockImplementation(
      async (_userId: string, transactions: Array<{ ai_batch_id: string; id: string }>) => ({
        batchId: transactions[0].ai_batch_id,
        coordinated: false,
        transactionIds: transactions.map((transaction) => transaction.id),
      }),
    );
  });

  it("每次只发送当前输入和严格内存上下文，不发送历史消息或缓存", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));
    await waitFor(() => expect(mocks.sendFoxChatMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("message-count")).toHaveTextContent("2"));

    fireEvent.click(screen.getByRole("button", { name: "发送地铁" }));
    await waitFor(() => expect(mocks.sendFoxChatMessage).toHaveBeenCalledTimes(2));

    expect(mocks.sendFoxChatMessage.mock.calls).toEqual([
      [{ previousContext: null, text: "午饭 32" }],
      [{ previousContext: null, text: "地铁 6" }],
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

  it("连续追问只携带上一轮服务端返回的 normalized context", async () => {
    const firstResult = createQueryResult();
    mocks.sendFoxChatMessage
      .mockResolvedValueOnce(firstResult)
      .mockResolvedValueOnce(createQueryResult("上月"));
    render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));
    await waitFor(() => expect(mocks.sendFoxChatMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("message-count")).toHaveTextContent("2"));
    fireEvent.click(screen.getByRole("button", { name: "发送地铁" }));
    await waitFor(() => expect(mocks.sendFoxChatMessage).toHaveBeenCalledTimes(2));

    expect(mocks.sendFoxChatMessage.mock.calls[1][0]).toEqual({
      previousContext: firstResult.context,
      text: "地铁 6",
    });
    expect(localStorage.getItem("fox-chat-context")).toBeNull();
  });

  it("空解析只显示确定性错误，不创建空结果卡", async () => {
    mocks.sendFoxChatMessage.mockResolvedValue({
      intent: "record_transaction",
      ledger_result: { ...parseResult, transactions: [] },
    });
    render(
      <ChatSessionProvider>
        <SessionProbe />
      </ChatSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送午饭" }));

    await waitFor(() => expect(screen.getByTestId("message-count")).toHaveTextContent("2"));
    expect(mocks.sendFoxChatMessage).toHaveBeenCalledWith({
      previousContext: null,
      text: "午饭 32",
    });
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
