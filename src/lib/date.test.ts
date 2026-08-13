import { afterEach, describe, expect, it, vi } from "vitest";

import {
  endOfWeekLocal,
  formatLocalDate,
  getInclusiveDayCount,
  isValidIsoDate,
  startOfWeekLocal,
} from "@/lib/date";
import {
  buildCustomStatsRange,
  getPresetStatsRange,
} from "@/features/stats/statsRanges";

afterEach(() => {
  vi.useRealTimers();
});

describe("本地日期契约", () => {
  it("使用本地年月日格式化日期，并严格校验真实日历日期", () => {
    expect(formatLocalDate(new Date(2026, 7, 3, 23, 59))).toBe("2026-08-03");
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2025-02-29")).toBe(false);
    expect(isValidIsoDate("2026-8-03")).toBe(false);
  });

  it("以周一为一周开始、周日为结束", () => {
    const sunday = new Date(2026, 7, 16, 12);

    expect(formatLocalDate(startOfWeekLocal(sunday))).toBe("2026-08-10");
    expect(formatLocalDate(endOfWeekLocal(sunday))).toBe("2026-08-16");
  });

  it("按首尾都包含的本地日期计算天数", () => {
    expect(getInclusiveDayCount("2024-02-28", "2024-03-01")).toBe(3);
    expect(getInclusiveDayCount("2026-08-13", "2026-08-13")).toBe(1);
    expect(getInclusiveDayCount("2026-08-14", "2026-08-13")).toBe(1);
  });
});

describe("统计日期范围契约", () => {
  it("生成本周、本月、上月和今年的本地日期范围", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 12));

    expect(getPresetStatsRange("week")).toEqual({
      endDate: "2026-08-16",
      key: "week",
      label: "本周",
      startDate: "2026-08-10",
    });
    expect(getPresetStatsRange("month")).toEqual({
      endDate: "2026-08-13",
      key: "month",
      label: "本月",
      startDate: "2026-08-01",
    });
    expect(getPresetStatsRange("last-month")).toEqual({
      endDate: "2026-07-31",
      key: "last-month",
      label: "上月",
      startDate: "2026-07-01",
    });
    expect(getPresetStatsRange("year")).toEqual({
      endDate: "2026-08-13",
      key: "year",
      label: "今年",
      startDate: "2026-01-01",
    });
  });

  it("构建合法自定义范围并拒绝空值、非法日期和倒序范围", () => {
    expect(buildCustomStatsRange(" 2026-08-01 ", " 2026-08-13 ")).toEqual({
      endDate: "2026-08-13",
      key: "custom",
      label: "2026-08-01 至 2026-08-13",
      startDate: "2026-08-01",
    });

    expect(() => buildCustomStatsRange("", "2026-08-13")).toThrow(
      "自定义日期的开始日期和结束日期不能为空。",
    );
    expect(() => buildCustomStatsRange("2026-02-30", "2026-03-01")).toThrow(
      "自定义日期必须是 YYYY-MM-DD。",
    );
    expect(() => buildCustomStatsRange("2026-08-14", "2026-08-13")).toThrow(
      "开始日期不能晚于结束日期。",
    );
  });
});
