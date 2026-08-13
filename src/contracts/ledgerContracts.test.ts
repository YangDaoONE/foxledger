import { describe, expect, it } from "vitest";

import { defaultCategories } from "@/features/transactions/transactionRules";
import { calculateLedgerStatsEnvelope } from "@shared/ledgerAnalytics";
import {
  LEDGER_QUERY_CATEGORIES,
  LedgerContractError,
  parseGroundedLedgerAnswer,
  parseLedgerQueryPlan,
  parseLedgerStatsEnvelope,
} from "@shared/ledgerContracts";

function createValidPlan() {
  return {
    answer_goal: "comparison",
    operations: [
      {
        compareRange: {
          endDate: "2026-07-31",
          label: " 上月 ",
          startDate: "2026-07-01",
        },
        filters: {
          categories: ["餐饮"],
          keyword: " ",
          maxAmount: 500,
          merchants: [" 小狐餐厅 "],
          minAmount: 0,
          types: ["expense"],
        },
        groupBy: ["category", "day"],
        metrics: ["expense", "count"],
        order: "amount_desc",
        range: {
          endDate: "2026-08-31",
          label: " 本月 ",
          startDate: "2026-08-01",
        },
      },
    ],
  };
}

describe("Ledger query plan 严格契约", () => {
  it("解析白名单字段并输出归一化计划", () => {
    expect(parseLedgerQueryPlan(createValidPlan())).toEqual({
      answer_goal: "comparison",
      operations: [
        {
          compareRange: {
            endDate: "2026-07-31",
            label: "上月",
            startDate: "2026-07-01",
          },
          filters: {
            categories: ["餐饮"],
            keyword: null,
            maxAmount: 500,
            merchants: ["小狐餐厅"],
            minAmount: 0,
            types: ["expense"],
          },
          groupBy: ["category", "day"],
          metrics: ["expense", "count"],
          order: "amount_desc",
          range: {
            endDate: "2026-08-31",
            label: "本月",
            startDate: "2026-08-01",
          },
        },
      ],
    });
  });

  it("拒绝未知字段、空操作、非法日期和未知分类", () => {
    expect(() =>
      parseLedgerQueryPlan({ ...createValidPlan(), sql: "select * from transactions" }),
    ).toThrow(/未知字段/);
    expect(() =>
      parseLedgerQueryPlan({ ...createValidPlan(), operations: [] }),
    ).toThrow(/不能为空数组/);

    const invalidDate = createValidPlan();
    invalidDate.operations[0].range.startDate = "2026-02-30";
    expect(() => parseLedgerQueryPlan(invalidDate)).toThrow(/YYYY-MM-DD/);

    const unknownCategory = createValidPlan();
    unknownCategory.operations[0].filters.categories = ["任意分类"];
    expect(() => parseLedgerQueryPlan(unknownCategory)).toThrow(/categories/);
  });

  it("拒绝重复枚举、负金额和矛盾金额范围", () => {
    const duplicateMetric = createValidPlan();
    duplicateMetric.operations[0].metrics = ["expense", "expense"];
    expect(() => parseLedgerQueryPlan(duplicateMetric)).toThrow(/重复值/);

    const negativeAmount = createValidPlan();
    negativeAmount.operations[0].filters.minAmount = -1;
    expect(() => parseLedgerQueryPlan(negativeAmount)).toThrow(/不能小于 0/);

    const invertedAmount = createValidPlan();
    invertedAmount.operations[0].filters.minAmount = 600;
    expect(() => parseLedgerQueryPlan(invertedAmount)).toThrow(/最小金额不能大于/);
  });

  it("查询分类白名单与现有交易默认分类保持一致", () => {
    expect([...LEDGER_QUERY_CATEGORIES]).toEqual([...defaultCategories]);
  });
});

describe("Ledger stats envelope 严格契约", () => {
  const stats = calculateLedgerStatsEnvelope(
    [
      {
        amount: 32,
        category: "餐饮",
        date: "2026-08-13",
        merchant: "小狐餐厅",
        type: "expense",
      },
    ],
    {
      endDate: "2026-08-13",
      label: "今天",
      startDate: "2026-08-13",
    },
  );

  it("接受共享统计器输出及合法比较信息", () => {
    const envelope = {
      ...stats,
      comparison: {
        absoluteChange: 12,
        baseRange: {
          endDate: "2026-08-12",
          label: "昨天",
          startDate: "2026-08-12",
        },
        percentChange: 60,
      },
    };

    expect(parseLedgerStatsEnvelope(envelope)).toEqual(envelope);
  });

  it("拒绝未知字段、非有限数字和非法分类", () => {
    expect(() => parseLedgerStatsEnvelope({ ...stats, rawRows: [] })).toThrow(
      LedgerContractError,
    );
    expect(() =>
      parseLedgerStatsEnvelope({ ...stats, averageDailyExpense: Number.NaN }),
    ).toThrow(/有限数字/);
    expect(() =>
      parseLedgerStatsEnvelope({
        ...stats,
        categorySpend: [{ amount: 32, category: "任意分类" }],
      }),
    ).toThrow(/category/);
  });
});

describe("Grounded answer 严格契约", () => {
  it("只接受模板、指标引用、依据引用和可空建议", () => {
    expect(
      parseGroundedLedgerAnswer({
        answerTemplate: " 本月餐饮支出为 {{metric:expense}}。 ",
        evidenceRefs: ["transaction:0"],
        metricRefs: ["operation:0.summary.expense"],
        suggestion: " ",
      }),
    ).toEqual({
      answerTemplate: "本月餐饮支出为 {{metric:expense}}。",
      evidenceRefs: ["transaction:0"],
      metricRefs: ["operation:0.summary.expense"],
      suggestion: null,
    });
  });

  it("拒绝自由扩展字段、空模板和重复引用", () => {
    expect(() =>
      parseGroundedLedgerAnswer({
        answerTemplate: "回答",
        evidenceRefs: [],
        metricRefs: [],
        modelNumber: 999,
        suggestion: null,
      }),
    ).toThrow(/未知字段/);
    expect(() =>
      parseGroundedLedgerAnswer({
        answerTemplate: " ",
        evidenceRefs: [],
        metricRefs: [],
        suggestion: null,
      }),
    ).toThrow(/非空字符串/);
    expect(() =>
      parseGroundedLedgerAnswer({
        answerTemplate: "回答",
        evidenceRefs: [],
        metricRefs: ["same", "same"],
        suggestion: null,
      }),
    ).toThrow(/重复值/);
  });
});
