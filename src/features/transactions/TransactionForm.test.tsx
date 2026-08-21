import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionForm } from "@/features/transactions/TransactionForm";

const ledgerOneId = "33333333-3333-4333-8333-333333333333";
const ledgerTwoId = "44444444-4444-4444-8444-444444444444";
const ledgers = [
  {
    cache_key: `user-1:${ledgerOneId}`,
    created_at: "2026-08-22T01:00:00.000Z",
    id: ledgerOneId,
    name: "默认账本",
    updated_at: "2026-08-22T01:00:00.000Z",
    user_id: "user-1",
  },
  {
    cache_key: `user-1:${ledgerTwoId}`,
    created_at: "2026-08-22T02:00:00.000Z",
    id: ledgerTwoId,
    name: "旅行账本",
    updated_at: "2026-08-22T02:00:00.000Z",
    user_id: "user-1",
  },
];

describe("手动记账目标账本", () => {
  it("默认当前账本，也允许提交到非当前账本", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TransactionForm
        defaultLedgerId={ledgerOneId}
        isSubmitting={false}
        ledgers={ledgers}
        submitLabel="保存账单"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("记入账本")).toHaveValue(ledgerOneId);
    fireEvent.change(screen.getByLabelText("记入账本"), {
      target: { value: ledgerTwoId },
    });
    fireEvent.change(screen.getByLabelText("金额"), {
      target: { value: "32" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存账单" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: "32", ledger_id: ledgerTwoId }),
      ),
    );
  });

  it("AI 正式账单编辑只展示所属账本，不允许移动", () => {
    render(
      <TransactionForm
        defaultLedgerId={ledgerOneId}
        initialTransaction={{
          ai_batch_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          amount: 32,
          cache_key: "user-1:transaction-1",
          category: "餐饮",
          created_at: "2026-08-22T01:00:00.000Z",
          currency: "CNY",
          date: "2026-08-22",
          id: "transaction-1",
          ledger_id: ledgerTwoId,
          merchant: null,
          note: null,
          payment_method: null,
          source: "ai",
          type: "expense",
          updated_at: "2026-08-22T01:00:00.000Z",
          user_id: "user-1",
        }}
        isSubmitting={false}
        ledgerReadOnly
        ledgers={ledgers}
        submitLabel="保存修改"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("旅行账本")).toBeInTheDocument();
    expect(screen.queryByLabelText("记入账本")).not.toBeInTheDocument();
  });
});
