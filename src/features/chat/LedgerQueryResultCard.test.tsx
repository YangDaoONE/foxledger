import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FoxChatQueryClientResult } from "@/features/chat/foxChatApi";
import {
  getPrimaryQueryMetrics,
  LedgerQueryResultCard,
} from "@/features/chat/LedgerQueryResultCard";
import type { LedgerQueryOperation } from "@shared/ledgerContracts";

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

function expandResult() {
  fireEvent.click(screen.getByRole("button", { name: /展开问账结果/ }));
  return document.querySelector<HTMLElement>(".ledger-query-card")!;
}

describe("问账结果卡", () => {
  it("默认只展示直接答案，展开后按需展示指标、更多统计与依据", () => {
    render(
      <LedgerQueryResultCard
        ledgerName="默认账本"
        onOpenTransactions={vi.fn()}
        result={createResult()}
      />,
    );

    const disclosure = screen.getByRole("button", {
      name: "展开问账结果：本月餐饮支出 ¥32.00。",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "打开匹配账单" }),
    ).not.toBeInTheDocument();

    const card = expandResult();
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(within(card).getByText("账本回答")).toBeInTheDocument();
    expect(within(card).getByText("本月餐饮支出 ¥32.00。")).toBeInTheDocument();
    expect(within(card).getByText("2026-08-01 至 2026-08-31")).toBeInTheDocument();
    expect(within(card).getByText(/分类：餐饮/)).toBeInTheDocument();

    const primaryMetrics = within(card).getByLabelText("本月餐饮主要指标");
    expect(within(primaryMetrics).getByText("支出")).toBeInTheDocument();
    expect(within(primaryMetrics).queryByText("收入")).not.toBeInTheDocument();
    expect(within(primaryMetrics).queryByText("账单数")).not.toBeInTheDocument();

    const moreStatsSummary = within(card).getByText("更多统计", { exact: true });
    const moreStats = moreStatsSummary.closest("details");
    expect(moreStats).not.toHaveAttribute("open");
    fireEvent.click(moreStatsSummary);
    expect(moreStats).toHaveAttribute("open");
    expect(within(moreStats!).getByText("账单数")).toBeInTheDocument();
    expect(within(moreStats!).getByText("支出")).toBeInTheDocument();
    expect(within(moreStats!).getByText("收入")).toBeInTheDocument();
    expect(within(moreStats!).getByText("结余")).toBeInTheDocument();
    expect(within(moreStats!).getByText("日均支出")).toBeInTheDocument();
    expect(within(moreStats!).getByText("最大支出")).toBeInTheDocument();

    expect(within(card).getByText(/正式统计覆盖 1 条匹配数据/)).toBeInTheDocument();
    expect(within(card).queryByText("小狐餐厅")).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "查看依据" }));
    expect(within(card).getByText("小狐餐厅")).toBeInTheDocument();
    expect(within(card).getByText("回答引用")).toBeInTheDocument();
  });

  it("按 query plan 的顺序映射六种主要指标", () => {
    const result = createResult();
    const operation: LedgerQueryOperation = {
      ...result.plan.operations[0],
      metrics: [
        "count",
        "expense",
        "income",
        "balance",
        "average_daily_expense",
        "max_expense",
      ],
    };

    expect(getPrimaryQueryMetrics(operation, result.operations[0])).toEqual([
      { key: "count", label: "账单数", value: "1 笔" },
      { key: "expense", label: "支出", value: "¥32.00" },
      { key: "income", label: "收入", value: "¥0.00" },
      { key: "balance", label: "结余", value: "-¥32.00" },
      {
        key: "average_daily_expense",
        label: "日均支出",
        value: "¥1.03",
      },
      { key: "max_expense", label: "最大支出", value: "¥32.00" },
    ]);
  });

  it("筛选跳转由父级接管，不执行任何写操作", () => {
    const onOpenTransactions = vi.fn();
    render(
      <LedgerQueryResultCard
        ledgerName="默认账本"
        onOpenTransactions={onOpenTransactions}
        result={createResult()}
      />,
    );

    const card = expandResult();
    fireEvent.click(within(card).getByRole("button", { name: "打开匹配账单" }));
    expect(onOpenTransactions).toHaveBeenCalledWith(0);
  });

  it("保留对比区间结果", () => {
    const result = createResult();
    const compareRange = {
      endDate: "2026-07-31",
      label: "上月餐饮",
      startDate: "2026-07-01",
    };
    result.operations[0] = {
      ...result.operations[0],
      compareStats: {
        ...result.operations[0].stats,
        range: compareRange,
      },
    };
    result.plan.operations[0] = {
      ...result.plan.operations[0],
      compareRange,
    };

    render(
      <LedgerQueryResultCard
        ledgerName="默认账本"
        onOpenTransactions={vi.fn()}
        result={result}
      />,
    );

    const card = expandResult();
    expect(
      within(card).getByText("比较范围：上月餐饮（2026-07-01 至 2026-07-31）"),
    ).toBeInTheDocument();
  });

  it("自然语言回答不可用时仍可展开查看正式统计", () => {
    const result = createResult();
    result.answer = null;
    result.answer_error = "自然语言解释暂不可用，请查看统计结果。";
    result.answer_status = "unavailable";

    render(
      <LedgerQueryResultCard
        ledgerName="默认账本"
        onOpenTransactions={vi.fn()}
        result={result}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "展开问账结果：统计已经完成，点开查看结果。",
      }),
    ).toBeInTheDocument();
    const card = expandResult();
    expect(
      within(card).getByText("自然语言解释暂不可用，请查看统计结果。"),
    ).toBeInTheDocument();
    expect(within(card).getByLabelText("本月餐饮主要指标")).toBeInTheDocument();
  });
});
