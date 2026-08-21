import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertTransactionsForUser: vi.fn(),
}));

vi.mock("@/features/transactions/transactionsApi", () => ({
  insertTransactionsForUser: mocks.insertTransactionsForUser,
}));

import { ImportTransactions } from "@/features/import/ImportTransactions";

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

describe("CSV 目标账本", () => {
  it("可以导入到非当前账本且所有合法行使用同一 ledger_id", async () => {
    mocks.insertTransactionsForUser.mockResolvedValue(["transaction-1"]);
    const onImported = vi.fn().mockResolvedValue(undefined);
    render(
      <ImportTransactions
        defaultLedgerId={ledgerOneId}
        isOnline
        ledgers={ledgers}
        onImported={onImported}
        userId="user-1"
      />,
    );
    fireEvent.change(screen.getByLabelText("导入到"), {
      target: { value: ledgerTwoId },
    });
    const file = new File(
      ["date,amount,type\n2026-08-22,32,expense"],
      "transactions.csv",
      { type: "text/csv" },
    );
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("date,amount,type\n2026-08-22,32,expense"),
    });
    fireEvent.change(screen.getByLabelText("选择 CSV 文件"), {
      target: { files: [file] },
    });

    fireEvent.click(await screen.findByRole("button", { name: "确认导入" }));
    await waitFor(() =>
      expect(mocks.insertTransactionsForUser).toHaveBeenCalledWith(
        "user-1",
        [expect.objectContaining({ ledger_id: ledgerTwoId })],
      ),
    );
    expect(onImported).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("导入到")).toHaveValue(ledgerTwoId);
  });
});
