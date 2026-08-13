import { describe, expect, it } from "vitest";

import { calculateStatsForTransactions } from "@/features/stats/statsCalculator";
import type { StatsDateRange } from "@/features/stats/types";
import {
  calculateLedgerStatsEnvelope,
  getInclusiveLedgerDayCount,
  type LedgerStatsTransaction,
} from "@shared/ledgerAnalytics";

const ledgerRange = {
  endDate: "2026-08-04",
  label: "测试范围",
  startDate: "2026-08-01",
};

const transactions: LedgerStatsTransaction[] = [
  {
    amount: -30,
    category: "餐饮",
    date: "2026-08-01",
    merchant: " 小狐餐厅 ",
    type: "expense",
  },
  {
    amount: 10,
    category: "餐饮",
    date: "2026-08-02",
    merchant: "小狐餐厅",
    type: "expense",
  },
  {
    amount: 20,
    category: "交通",
    date: "2026-08-02",
    merchant: "公交",
    type: "expense",
  },
  {
    amount: -100,
    category: "收入",
    date: "2026-08-03",
    merchant: "公司",
    type: "income",
  },
  {
    amount: 50,
    category: "转账",
    date: "2026-08-04",
    merchant: null,
    type: "transfer",
  },
];

describe("前端与 Edge 共用统计规则", () => {
  it("按统一口径计算收支、分类、趋势、商家和类型，且不修改输入", () => {
    const original = structuredClone(transactions);
    const result = calculateLedgerStatsEnvelope(transactions, ledgerRange);

    expect(result).toEqual({
      averageDailyExpense: 15,
      categorySpend: [
        { amount: 40, category: "餐饮" },
        { amount: 20, category: "交通" },
      ],
      dailySpend: [
        { amount: 30, date: "2026-08-01" },
        { amount: 30, date: "2026-08-02" },
      ],
      merchantSpend: [
        { amount: 40, count: 2, merchant: "小狐餐厅" },
        { amount: 20, count: 1, merchant: "公交" },
      ],
      maxExpenseAmount: 30,
      range: ledgerRange,
      summary: {
        balance: 40,
        expense: 60,
        income: 100,
      },
      transactionCount: 5,
      typeBreakdown: [
        { amount: 60, count: 3, type: "expense" },
        { amount: 100, count: 1, type: "income" },
        { amount: 50, count: 1, type: "transfer" },
      ],
    });
    expect(transactions).toEqual(original);
  });

  it("前端薄包装保持 V3.0 的正式数字和 UI 百分比不变", () => {
    const range: StatsDateRange = { ...ledgerRange, key: "custom" };
    const shared = calculateLedgerStatsEnvelope(transactions, ledgerRange);
    const frontend = calculateStatsForTransactions(transactions, range);

    expect(frontend.summary).toEqual({
      ...shared.summary,
      budgetUsedPercent: 0,
      month: range.label,
    });
    expect(frontend.transactionCount).toBe(shared.transactionCount);
    expect(frontend.averageDailyExpense).toBe(shared.averageDailyExpense);
    expect(frontend.maxExpenseAmount).toBe(shared.maxExpenseAmount);
    expect(frontend.categorySpend).toEqual([
      { amount: 40, category: "餐饮", percent: 100 },
      { amount: 20, category: "交通", percent: 50 },
    ]);
    expect(frontend.dailySpend).toEqual([
      { amount: 30, date: "2026-08-01", percent: 100 },
      { amount: 30, date: "2026-08-02", percent: 100 },
    ]);
  });

  it("按纯日历日期计算跨月和闰年天数，不受运行环境时区影响", () => {
    expect(getInclusiveLedgerDayCount("2024-02-28", "2024-03-01")).toBe(3);
    expect(getInclusiveLedgerDayCount("2026-08-13", "2026-08-13")).toBe(1);
    expect(getInclusiveLedgerDayCount("2026-08-14", "2026-08-13")).toBe(1);
    expect(getInclusiveLedgerDayCount("invalid", "2026-08-13")).toBe(1);
  });

  it("空数据仍返回可供前端和 Edge 共用的完整零值包", () => {
    expect(calculateLedgerStatsEnvelope([], ledgerRange)).toEqual({
      averageDailyExpense: 0,
      categorySpend: [],
      dailySpend: [],
      merchantSpend: [],
      maxExpenseAmount: 0,
      range: ledgerRange,
      summary: { balance: 0, expense: 0, income: 0 },
      transactionCount: 0,
      typeBreakdown: [],
    });
  });
});
