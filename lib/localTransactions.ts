import { readCachedTransactions } from "@/lib/localDb";
import type {
  TransactionFilterSummary,
  TransactionPageFilters,
  TransactionPageResult,
} from "@/lib/transactions";
import type { Transaction, TransactionType } from "@/types/transaction";

function sanitizeSearchTerm(value: string | undefined) {
  return (value ?? "")
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .toLowerCase();
}

function matchesSearch(transaction: Transaction, searchTerm: string) {
  if (!searchTerm) {
    return true;
  }

  return [transaction.merchant, transaction.note, transaction.category].some((value) =>
    (value ?? "").toLowerCase().includes(searchTerm),
  );
}

function matchesFilters(transaction: Transaction, filters: TransactionPageFilters) {
  const searchTerm = sanitizeSearchTerm(filters.search);
  const category = filters.category?.trim() ?? "";
  const startDate = filters.startDate?.trim() ?? "";
  const endDate = filters.endDate?.trim() ?? "";

  if (!matchesSearch(transaction, searchTerm)) {
    return false;
  }

  if (filters.type && transaction.type !== filters.type) {
    return false;
  }

  if (category && transaction.category !== category) {
    return false;
  }

  if (startDate && transaction.date < startDate) {
    return false;
  }

  if (endDate && transaction.date > endDate) {
    return false;
  }

  return true;
}

function summarizeTransactions(transactions: Transaction[]): TransactionFilterSummary {
  return transactions.reduce(
    (current, transaction) => {
      const amount = Math.abs(Number(transaction.amount));

      if (transaction.type === "expense") {
        return { ...current, expense: current.expense + amount, count: current.count + 1 };
      }

      if (transaction.type === "income") {
        return { ...current, income: current.income + amount, count: current.count + 1 };
      }

      return { ...current, count: current.count + 1 };
    },
    { expense: 0, income: 0, count: 0 },
  );
}

function compareNullableText(first: string | null, second: string | null) {
  return (first ?? "").localeCompare(second ?? "");
}

function sortTransactions(transactions: Transaction[], sort: TransactionPageFilters["sort"]) {
  return [...transactions].sort((first, second) => {
    if (sort === "date-asc") {
      const dateCompare = first.date.localeCompare(second.date);
      return dateCompare || first.created_at.localeCompare(second.created_at);
    }

    if (sort === "amount-desc") {
      return (
        second.amount - first.amount ||
        second.date.localeCompare(first.date) ||
        compareNullableText(second.created_at, first.created_at)
      );
    }

    if (sort === "amount-asc") {
      return (
        first.amount - second.amount ||
        second.date.localeCompare(first.date) ||
        compareNullableText(second.created_at, first.created_at)
      );
    }

    return (
      second.date.localeCompare(first.date) ||
      second.created_at.localeCompare(first.created_at)
    );
  });
}

export async function listCachedTransactionsPage(
  userId: string,
  filters: TransactionPageFilters,
): Promise<TransactionPageResult> {
  const limit = Math.max(filters.limit, 1);
  const offset = Math.max(filters.offset, 0);
  const cachedTransactions = await readCachedTransactions(userId);
  const filteredTransactions = cachedTransactions.filter((transaction) =>
    matchesFilters(transaction, filters),
  );
  const sortedTransactions = sortTransactions(filteredTransactions, filters.sort ?? "date-desc");
  const transactions = sortedTransactions.slice(offset, offset + limit);

  return {
    transactions,
    summary: summarizeTransactions(filteredTransactions),
    hasMore: offset + transactions.length < filteredTransactions.length,
    totalCount: filteredTransactions.length,
  };
}

export async function listCachedTransactionsForDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Transaction[]> {
  const cachedTransactions = await readCachedTransactions(userId);

  return cachedTransactions.filter((transaction) => {
    if (transaction.date < startDate || transaction.date > endDate) {
      return false;
    }

    return true;
  });
}

export async function listAllCachedTransactions(userId: string): Promise<Transaction[]> {
  return readCachedTransactions(userId);
}

export function filterTransactionsByType(
  transactions: Transaction[],
  type: TransactionType | null,
) {
  if (!type) {
    return transactions;
  }

  return transactions.filter((transaction) => transaction.type === type);
}
