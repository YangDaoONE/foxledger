import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FoxChatQueryClientResult } from "@/features/chat/foxChatApi";
import { LedgerQueryResultCard } from "@/features/chat/LedgerQueryResultCard";

function createResult(): FoxChatQueryClientResult {
  const range = {
    endDate: "2026-08-31",
    label: "本月餐饮",
    startDate: "2026-08-01",
  };
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
        range,
      },
    ],
  };

  return {
    answer: {
      evidenceRefs: ["operations.0.aiDetails.0"],
      metricRefs: ["operations.0.stats.summary.expense"],
      suggestion: "可以打开依据核对商家。",
      text: "本月餐饮支出 ¥32.00。",
    },
    answer_error: null,
    answer_status: "ready",
    context: { date_anchor: "2026-08-13", intent: "query_ledger", plan },
    intent: "query_ledger",
    operations: [
      {
        aiDetailCount: 1,
        aiDetails: [
          {
            amount: 32,
            category: "餐饮",
            date: "2026-08-13",
            merchant: "小狐餐厅",
            type: "expense",
          },
        ],
        aiDetailsTruncated: false,
        matchedTransactionCount: 1,
        stats: {
          averageDailyExpense: 1.03,
          categorySpend: [{ amount: 32, category: "餐饮" }],
          dailySpend: [{ amount: 32, date: "2026-08-13" }],
          merchantSpend: [{ amount: 32, count: 1, merchant: "小狐餐厅" }],
          maxExpenseAmount: 32,
          range,
          summary: { balance: -32, expense: 32, income: 0 },
          transactionCount: 1,
          typeBreakdown: [{ amount: 32, count: 1, type: "expense" }],
        },
      },
    ],
    plan,
  };
}

describe("问账结果卡", () => {
  it("展示可信范围、筛选、统计、AI 明细口径，并由代码展开依据", () => {
    render(<LedgerQueryResultCard onOpenTransactions={vi.fn()} result={createResult()} />);

    expect(screen.getByText("本月餐饮支出 ¥32.00。")).toBeInTheDocument();
    expect(screen.getByText("2026-08-01 至 2026-08-31")).toBeInTheDocument();
    expect(screen.getByText(/分类：餐饮/)).toBeInTheDocument();
    expect(screen.getByText(/正式统计覆盖 1 条匹配数据/)).toBeInTheDocument();
    expect(screen.queryByText("小狐餐厅")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看依据" }));
    expect(screen.getByText("小狐餐厅")).toBeInTheDocument();
    expect(screen.getByText("回答引用")).toBeInTheDocument();
  });

  it("筛选跳转由父级接管，不执行任何写操作", () => {
    const onOpenTransactions = vi.fn();
    render(
      <LedgerQueryResultCard
        onOpenTransactions={onOpenTransactions}
        result={createResult()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开匹配账单" }));
    expect(onOpenTransactions).toHaveBeenCalledWith(0);
  });
});
