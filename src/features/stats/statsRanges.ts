import {
  compareIsoDates,
  formatLocalDate,
  getTodayLocalIsoDate,
  isValidIsoDate,
  startOfWeekLocal,
} from "@/lib/date";

import type { StatsDateRange, StatsRangeKey } from "@/features/stats/types";

export function getPresetStatsRange(key: Exclude<StatsRangeKey, "custom">): StatsDateRange {
  const now = new Date();

  if (key === "week") {
    const start = startOfWeekLocal(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      endDate: formatLocalDate(end),
      key,
      label: "本周",
      startDate: formatLocalDate(start),
    };
  }

  if (key === "last-month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      endDate: formatLocalDate(end),
      key,
      label: "上月",
      startDate: formatLocalDate(start),
    };
  }

  if (key === "year") {
    return {
      endDate: getTodayLocalIsoDate(),
      key,
      label: "今年",
      startDate: formatLocalDate(new Date(now.getFullYear(), 0, 1)),
    };
  }

  return {
    endDate: getTodayLocalIsoDate(),
    key,
    label: "本月",
    startDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
  };
}

export function buildCustomStatsRange(startDate: string, endDate: string): StatsDateRange {
  const start = startDate.trim();
  const end = endDate.trim();

  if (!start || !end) {
    throw new Error("自定义日期的开始日期和结束日期不能为空。");
  }

  if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
    throw new Error("自定义日期必须是 YYYY-MM-DD。");
  }

  if (compareIsoDates(start, end) > 0) {
    throw new Error("开始日期不能晚于结束日期。");
  }

  return {
    endDate: end,
    key: "custom",
    label: `${start} 至 ${end}`,
    startDate: start,
  };
}
