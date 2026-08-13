import { StateBlock } from "@/components/ui/StateBlock";
import { TransactionCard } from "@/features/transactions/TransactionCard";
import type {
  CachedTransaction,
  TransactionSortOption,
} from "@/features/transactions/types";
import { getErrorMessage } from "@/lib/errors";

type TransactionListProps = {
  error: unknown;
  isLoading: boolean;
  isOnline: boolean;
  manageMode: boolean;
  onDelete: (transactionId: string) => void;
  onEdit: (transaction: CachedTransaction) => void;
  onToggleSelected: (transactionId: string) => void;
  selectedIds: ReadonlySet<string>;
  sort: TransactionSortOption;
  transactions: CachedTransaction[];
};

function groupTransactionsByDate(transactions: CachedTransaction[]) {
  const groups = new Map<string, CachedTransaction[]>();

  for (const transaction of transactions) {
    const rows = groups.get(transaction.date) ?? [];
    rows.push(transaction);
    groups.set(transaction.date, rows);
  }

  return Array.from(groups.entries());
}

export function TransactionList({
  error,
  isLoading,
  isOnline,
  manageMode,
  onDelete,
  onEdit,
  onToggleSelected,
  selectedIds,
  sort,
  transactions,
}: TransactionListProps) {
  const shouldGroupByDate = sort === "date-desc" || sort === "date-asc";
  const groupedTransactions = shouldGroupByDate
    ? groupTransactionsByDate(transactions)
    : [];

  function renderTransaction(transaction: CachedTransaction) {
    return (
      <TransactionCard
        isOnline={isOnline}
        isSelected={selectedIds.has(transaction.id)}
        key={transaction.id}
        manageMode={manageMode}
        onDelete={() => onDelete(transaction.id)}
        onEdit={() => onEdit(transaction)}
        onToggleSelected={() => onToggleSelected(transaction.id)}
        transaction={transaction}
      />
    );
  }

  return (
    <div className="transaction-list">
      {isLoading ? <StateBlock title="读取缓存">正在读取本地缓存。</StateBlock> : null}
      {error ? (
        <StateBlock title="读取失败" tone="danger">
          {getErrorMessage(error, "读取账单失败。")}
        </StateBlock>
      ) : null}
      {!isLoading && transactions.length === 0 ? (
        <StateBlock title="暂无账单">当前筛选条件下没有账单。</StateBlock>
      ) : null}

      {shouldGroupByDate
        ? groupedTransactions.map(([date, rows]) => (
            <section className="date-group" key={date}>
              <h3>{date}</h3>
              {rows.map(renderTransaction)}
            </section>
          ))
        : transactions.map(renderTransaction)}
    </div>
  );
}
