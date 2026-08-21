import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RecentAiBatch } from "@/features/chat/recentAiBatches";
import { SavedBatchDetailSheet } from "@/features/chat/SavedBatchDetailSheet";

const ledgerId = "33333333-3333-4333-8333-333333333333";

const batch: RecentAiBatch = {
  balance: -50,
  batchCreatedAt: "2026-08-18T01:00:00.000Z",
  batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  expense: 50,
  income: 0,
  ledgerId,
  latestCreatedAt: "2026-08-18T01:01:00.000Z",
  transactionCount: 2,
  transactions: [
    {
      ai_batch_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      amount: 32,
      cache_key: "user-1:transaction-1",
      category: "餐饮",
      created_at: "2026-08-18T01:00:00.000Z",
      currency: "CNY",
      date: "2026-08-18",
      id: "transaction-1",
      ledger_id: ledgerId,
      merchant: "麦当劳",
      note: null,
      payment_method: null,
      source: "ai",
      type: "expense",
      updated_at: "2026-08-18T01:00:00.000Z",
      user_id: "user-1",
    },
    {
      ai_batch_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      amount: 18,
      cache_key: "user-1:transaction-2",
      category: "交通",
      created_at: "2026-08-18T01:01:00.000Z",
      currency: "CNY",
      date: "2026-08-18",
      id: "transaction-2",
      ledger_id: ledgerId,
      merchant: "滴滴",
      note: null,
      payment_method: null,
      source: "ai",
      type: "expense",
      updated_at: "2026-08-18T01:01:00.000Z",
      user_id: "user-1",
    },
  ],
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof SavedBatchDetailSheet>> = {}) {
  const props: React.ComponentProps<typeof SavedBatchDetailSheet> = {
    actionsDisabled: false,
    batch,
    error: null,
    isLoading: false,
    isOnline: true,
    isRetrying: false,
    message: null,
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onRetrySync: vi.fn(),
    onUndo: vi.fn(),
    ...overrides,
  };

  render(<SavedBatchDetailSheet {...props} />);
  return props;
}

describe("保存后的正式批次详情", () => {
  it("从正式批次数据显示当前摘要并开放单笔管理", () => {
    const props = renderSheet();

    expect(screen.getByRole("heading", { name: "正式账单详情" })).toBeInTheDocument();
    expect(screen.getByLabelText("本次正式账单摘要")).toHaveTextContent("2 笔");
    expect(screen.getByText("麦当劳")).toBeInTheDocument();
    expect(screen.getByText("滴滴")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭正式账单详情" })).toHaveFocus();

    fireEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "撤销这一批" }));

    expect(props.onEdit).toHaveBeenCalledWith("transaction-1");
    expect(props.onDelete).toHaveBeenCalledWith("transaction-2");
    expect(props.onUndo).toHaveBeenCalledTimes(1);
  });

  it("离线或缓存过期时仍可查看，但所有正式写操作禁用", () => {
    renderSheet({ actionsDisabled: true, isOnline: false });

    expect(screen.getByText(/当前离线，可以查看已同步详情/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "编辑" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "删除" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "撤销这一批" })).toBeDisabled();
  });

  it("正式批次未进入缓存时不回退候选数据，只提供重新同步", () => {
    const props = renderSheet({ batch: null });

    expect(screen.getByText("暂未找到这批账单")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新同步" }));
    expect(props.onRetrySync).toHaveBeenCalledTimes(1);
  });
});
