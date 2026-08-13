import { describe, expect, it } from "vitest";

import { createStatsDrilldownParams } from "@/features/stats/statsDrilldown";
import type { StatsDateRange } from "@/features/stats/types";

const range: StatsDateRange = {
  endDate: "2026-08-31",
  key: "custom",
  label: "八月",
  startDate: "2026-08-01",
};

describe("统计 drilldown 契约", () => {
  it("总支出和总收入沿用当前统计范围并设置类型", () => {
    expect(createStatsDrilldownParams(range, { type: "expense" })).toEqual({
      category: undefined,
      endDate: "2026-08-31",
      startDate: "2026-08-01",
      type: "expense",
    });
    expect(createStatsDrilldownParams(range, { type: "income" })).toEqual({
      category: undefined,
      endDate: "2026-08-31",
      startDate: "2026-08-01",
      type: "income",
    });
  });

  it("分类排行跳转同时固定分类、支出类型和当前范围", () => {
    expect(
      createStatsDrilldownParams(range, {
        category: "餐饮",
        type: "expense",
      }),
    ).toEqual({
      category: "餐饮",
      endDate: "2026-08-31",
      startDate: "2026-08-01",
      type: "expense",
    });
  });

  it("每日趋势跳转把开始和结束日期都收窄到所选日期", () => {
    expect(
      createStatsDrilldownParams(range, {
        date: "2026-08-13",
        type: "expense",
      }),
    ).toEqual({
      category: undefined,
      endDate: "2026-08-13",
      startDate: "2026-08-13",
      type: "expense",
    });
  });
});
