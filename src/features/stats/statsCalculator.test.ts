import { describe, expect, it } from "vitest";

import { calculateStatsForTransactions } from "@/features/stats/statsCalculator";
import type { StatsDateRange, StatsTransaction } from "@/features/stats/types";

const range: StatsDateRange = {
  endDate: "2026-08-04",
  key: "custom",
  label: "测试范围",
  startDate: "2026-08-01",
};

describe("统计口径", () => {
  it("只把支出和收入计入合计，并排除转账", () => {
    const transactions: StatsTransaction[] = [
      { amount: -30, category: "餐饮", date: "2026-08-01", type: "expense" },
      { amount: 10, category: "餐饮", date: "2026-08-02", type: "expense" },
      { amount: 20, category: "交通", date: "2026-08-02", type: "expense" },
      { amount: -100, category: "收入", date: "2026-08-03", type: "income" },
      { amount: 50, category: "转账", date: "2026-08-04", type: "transfer" },
    ];

    const result = calculateStatsForTransactions(transactions, range);

    expect(result.summary).toEqual({
      balance: 40,
      budgetUsedPercent: 0,
      expense: 60,
      income: 100,
      month: "测试范围",
    });
    expect(result.transactionCount).toBe(5);
    expect(result.dayCount).toBe(4);
    expect(result.averageDailyExpense).toBe(15);
    expect(result.maxExpenseAmount).toBe(30);
  });

  it("按金额排序分类、按日期排序趋势，并以各自最大值计算百分比", () => {
    const result = calculateStatsForTransactions(
      [
        { amount: 30, category: "餐饮", date: "2026-08-01", type: "expense" },
        { amount: 10, category: "餐饮", date: "2026-08-02", type: "expense" },
        { amount: 20, category: "交通", date: "2026-08-02", type: "expense" },
      ],
      range,
    );

    expect(result.categorySpend).toEqual([
      { amount: 40, category: "餐饮", percent: 100 },
      { amount: 20, category: "交通", percent: 50 },
    ]);
    expect(result.dailySpend).toEqual([
      { amount: 30, date: "2026-08-01", percent: 100 },
      { amount: 30, date: "2026-08-02", percent: 100 },
    ]);
  });

  it("空数据仍返回完整的零值统计结构", () => {
    const result = calculateStatsForTransactions([], range);

    expect(result.summary.expense).toBe(0);
    expect(result.summary.income).toBe(0);
    expect(result.summary.balance).toBe(0);
    expect(result.transactionCount).toBe(0);
    expect(result.dayCount).toBe(4);
    expect(result.categorySpend).toEqual([]);
    expect(result.dailySpend).toEqual([]);
  });
});
