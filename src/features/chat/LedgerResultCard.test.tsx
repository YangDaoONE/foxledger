import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/app/queryKeys";
import type { ChatCandidateBatch } from "@/features/chat/chatTypes";
import { LedgerResultCard } from "@/features/chat/LedgerResultCard";
import type { RecentAiBatch } from "@/features/chat/recentAiBatches";

const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ledgerId = "33333333-3333-4333-8333-333333333333";
const otherLedgerId = "44444444-4444-4444-8444-444444444444";
const ledgers = [
  {
    cache_key: `user-1:${ledgerId}`,
    created_at: "2026-08-21T00:00:00.000Z",
    id: ledgerId,
    name: "默认账本",
    updated_at: "2026-08-21T00:00:00.000Z",
    user_id: "user-1",
  },
  {
    cache_key: `user-1:${otherLedgerId}`,
    created_at: "2026-08-21T00:00:00.000Z",
    id: otherLedgerId,
    name: "旅行账本",
    updated_at: "2026-08-21T00:00:00.000Z",
    user_id: "user-1",
  },
];

function createBatch(
  status: ChatCandidateBatch["status"],
): ChatCandidateBatch {
  return {
    canRetrySave: false,
    candidates: [
      {
        draft: {
          amount: "65",
          category: "餐饮",
          date: "2026-08-21",
          merchant: "小狐餐厅",
          note: "",
          payment_method: "",
          type: "expense",
        },
        id: "candidate-1",
        requiresReview: false,
        source: {
          account: null,
          ai_confidence: 0.9,
          amount: 65,
          category: "餐饮",
          currency: "CNY",
          date: "2026-08-21",
          merchant: "小狐餐厅",
          needs_clarification: false,
          note: null,
          payment_method: null,
          raw_text: "吃饭 65",
          source: "ai",
          tag: null,
          type: "expense",
        },
      },
    ],
    error: status === "error" ? "远端保存失败" : null,
    id: "chat-batch-1",
    ledgerId,
    saveRequest: {
      batchId,
      transactions: [],
    },
    status,
    statusBeforeUndo: null,
    transactionIds: ["transaction-1"],
    truncated: false,
  };
}

function createSavedBatch(overrides: Partial<RecentAiBatch> = {}): RecentAiBatch {
  return {
    balance: -65,
    batchCreatedAt: "2026-08-21T01:00:00.000Z",
    batchId,
    expense: 65,
    income: 0,
    ledgerId,
    latestCreatedAt: "2026-08-21T01:00:00.000Z",
    transactionCount: 2,
    transactions: [],
    ...overrides,
  };
}

function renderCard(
  batch: ChatCandidateBatch,
  savedBatch: RecentAiBatch | null = null,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  const onOpenSavedBatch = vi.fn();
  const onUpdateLedger = vi.fn();

  if (savedBatch) {
    queryClient.setQueryData(
      queryKeys.recentAiBatch("user-1", ledgerId, batchId),
      savedBatch,
    );
  }

  render(
    <QueryClientProvider client={queryClient}>
      <LedgerResultCard
        batch={batch}
        hasStaleBatchCache={false}
        isBatchCacheSyncing={false}
        isOnline
        ledgers={ledgers}
        messageId="message-1"
        onConfirm={vi.fn()}
        onOpenCandidate={vi.fn()}
        onOpenSavedBatch={onOpenSavedBatch}
        onRemoveCandidate={vi.fn()}
        onRetrySync={vi.fn()}
        onUpdateLedger={onUpdateLedger}
        userId="user-1"
      />
    </QueryClientProvider>,
  );

  return { onOpenSavedBatch, onUpdateLedger };
}

describe("已保存记账结果", () => {
  it("未保存候选可以整批改记到非当前账本", () => {
    const { onUpdateLedger } = renderCard(createBatch("draft"));

    fireEvent.change(screen.getByLabelText("记入账本"), {
      target: { value: otherLedgerId },
    });
    expect(onUpdateLedger).toHaveBeenCalledWith("message-1", otherLedgerId);
  });

  it("重新挂载时直接显示紧凑摘要，展开后继续使用现有正式详情入口", () => {
    const { onOpenSavedBatch } = renderCard(
      createBatch("saved"),
      createSavedBatch(),
    );
    const toggle = screen.getByRole("button", {
      name: /展开本次记账结果：已记录 2 笔 · 支出 ¥65\.00/,
    });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "详情" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "详情" }));

    expect(onOpenSavedBatch).toHaveBeenCalledWith(
      batchId,
      ledgerId,
      expect.any(HTMLButtonElement),
    );
  });

  it.each([
    [createSavedBatch(), "已记录 2 笔 · 支出 ¥65.00"],
    [
      createSavedBatch({ balance: 8000, expense: 0, income: 8000, transactionCount: 1 }),
      "已记录 1 笔 · 收入 ¥8,000.00",
    ],
    [
      createSavedBatch({ balance: 7880, expense: 120, income: 8000, transactionCount: 3 }),
      "已记录 3 笔 · 支出 ¥120.00 · 收入 ¥8,000.00",
    ],
    [
      createSavedBatch({ balance: 0, expense: 0, income: 0, transactionCount: 2 }),
      "已记录 2 笔",
    ],
  ])("按正式批次内容生成紧凑文案 %#", (savedBatch, expected) => {
    renderCard(createBatch("saved"), savedBatch);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("sync_warning 与 error 继续完整展开并保留恢复操作", () => {
    const first = renderCard(createBatch("sync_warning"));

    expect(screen.queryByRole("button", { name: /本次记账结果/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新同步" })).toBeInTheDocument();

    first.onOpenSavedBatch.mockClear();
    renderCard(createBatch("error"));

    expect(screen.getByText("远端保存失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新同步并核对" })).toBeInTheDocument();
  });

  it("撤销后只显示紧凑状态，不再暴露不存在的正式详情", () => {
    renderCard(createBatch("undone"));

    expect(screen.getByText("这次记录已撤销")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "详情" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /本次记账结果/ })).not.toBeInTheDocument();
  });
});
