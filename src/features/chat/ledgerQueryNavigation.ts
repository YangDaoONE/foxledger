import { createTransactionSearch } from "@/features/transactions/transactionSearch";
import type { TransactionSearch } from "@/features/transactions/transactionSearch";
import type { LedgerQueryOperation } from "@shared/ledgerContracts";

export type LedgerQueryNavigation = {
  isPartial: boolean;
  search: TransactionSearch;
};

export function createLedgerQueryNavigation(
  operation: LedgerQueryOperation,
): LedgerQueryNavigation {
  const singleCategory =
    operation.filters.categories.length === 1
      ? operation.filters.categories[0]
      : undefined;
  const singleType =
    operation.filters.types.length === 1 ? operation.filters.types[0] : "";
  const singleMerchant =
    operation.filters.merchants.length === 1
      ? operation.filters.merchants[0]
      : undefined;
  const search = operation.filters.keyword ?? singleMerchant;
  const hasUnsupportedFilters =
    operation.filters.categories.length > 1 ||
    operation.filters.types.length > 1 ||
    operation.filters.merchants.length > 1 ||
    operation.filters.minAmount !== null ||
    operation.filters.maxAmount !== null ||
    (operation.filters.keyword !== null && operation.filters.merchants.length > 0);

  return {
    isPartial: hasUnsupportedFilters,
    search: createTransactionSearch({
      category: singleCategory,
      endDate: operation.range.endDate,
      search,
      startDate: operation.range.startDate,
      type: singleType,
    }),
  };
}
