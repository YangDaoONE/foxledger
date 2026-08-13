import { isTransactionType } from "@/features/transactions/transactionRules";
import type {
  TransactionFilters,
  TransactionSortOption,
  TransactionType,
} from "@/features/transactions/types";

export type TransactionSearch = TransactionFilters & {
  scope: string;
};

export const transactionSortOptions: ReadonlyArray<{
  label: string;
  value: TransactionSortOption;
}> = [
  { label: "日期倒序", value: "date-desc" },
  { label: "日期正序", value: "date-asc" },
  { label: "金额倒序", value: "amount-desc" },
  { label: "金额正序", value: "amount-asc" },
];

const transactionSortValues = new Set<TransactionSortOption>(
  transactionSortOptions.map((option) => option.value),
);

function getStringSearchValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function isTransactionSortOption(value: unknown): value is TransactionSortOption {
  return (
    typeof value === "string" &&
    transactionSortValues.has(value as TransactionSortOption)
  );
}

export function validateTransactionSearch(
  search: Record<string, unknown>,
): TransactionSearch {
  const type = search.type;

  return {
    category: getStringSearchValue(search.category),
    endDate: getStringSearchValue(search.endDate),
    scope: getStringSearchValue(search.scope),
    search: getStringSearchValue(search.search),
    sort: isTransactionSortOption(search.sort) ? search.sort : "date-desc",
    startDate: getStringSearchValue(search.startDate),
    type: typeof type === "string" && isTransactionType(type) ? type : "",
  };
}

export function createTransactionSearch(params: {
  category?: string;
  endDate: string;
  search?: string;
  sort?: TransactionSortOption;
  startDate: string;
  type?: TransactionType | "";
}): TransactionSearch {
  return {
    category: params.category ?? "",
    endDate: params.endDate,
    scope: String(Date.now()),
    search: params.search ?? "",
    sort: params.sort ?? "date-desc",
    startDate: params.startDate,
    type: params.type ?? "",
  };
}
