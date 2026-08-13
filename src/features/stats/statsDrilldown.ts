import type { StatsDateRange } from "@/features/stats/types";
import type {
  TransactionSortOption,
  TransactionType,
} from "@/features/transactions/types";

export type StatsDrilldown = {
  category?: string;
  date?: string;
  type?: TransactionType;
};

export function createStatsDrilldownParams(
  range: StatsDateRange,
  drilldown: StatsDrilldown,
): {
  category?: string;
  endDate: string;
  search?: string;
  sort?: TransactionSortOption;
  startDate: string;
  type: TransactionType | "";
} {
  const startDate = drilldown.date ?? range.startDate;
  const endDate = drilldown.date ?? range.endDate;

  return {
    category: drilldown.category,
    endDate,
    startDate,
    type: drilldown.type ?? "",
  };
}
