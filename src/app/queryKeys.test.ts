import { describe, expect, it } from "vitest";

import { queryKeys } from "@/app/queryKeys";

const ledgerOneId = "33333333-3333-4333-8333-333333333333";
const ledgerTwoId = "44444444-4444-4444-8444-444444444444";

describe("账本作用域 query keys", () => {
  it("账单、统计、首页汇总和 AI 批次都包含 ledgerId", () => {
    const keyPairs = [
      [
        queryKeys.transactionPage("user-1", ledgerOneId, "filters", 20),
        queryKeys.transactionPage("user-1", ledgerTwoId, "filters", 20),
      ],
      [
        queryKeys.statsRange("user-1", ledgerOneId, "month", undefined, undefined),
        queryKeys.statsRange("user-1", ledgerTwoId, "month", undefined, undefined),
      ],
      [
        queryKeys.monthlySummary("user-1", ledgerOneId, "2026-08-01", "2026-08-31"),
        queryKeys.monthlySummary("user-1", ledgerTwoId, "2026-08-01", "2026-08-31"),
      ],
      [
        queryKeys.recentAiBatchPage("user-1", ledgerOneId, 20),
        queryKeys.recentAiBatchPage("user-1", ledgerTwoId, 20),
      ],
    ];

    for (const [first, second] of keyPairs) {
      expect(first).not.toEqual(second);
      expect(first).toContain(ledgerOneId);
      expect(second).toContain(ledgerTwoId);
    }
  });

  it("保留按用户失效全部账本数据的稳定前缀", () => {
    expect(queryKeys.transactions("user-1")).toEqual(["transactions", "user-1"]);
    expect(queryKeys.stats("user-1")).toEqual(["stats", "user-1"]);
    expect(queryKeys.recentAiBatches("user-1")).toEqual([
      "recentAiBatches",
      "user-1",
    ]);
  });
});
