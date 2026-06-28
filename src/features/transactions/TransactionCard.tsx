import { ArrowLeftRight, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import type { CachedTransaction } from "@/features/transactions/types";
import { getTransactionTypeLabel } from "@/features/transactions/transactionRules";
import { formatCurrency } from "@/lib/format";

type TransactionCardProps = {
  isOnline: boolean;
  isSelected: boolean;
  manageMode: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggleSelected: () => void;
  transaction: CachedTransaction;
};

export function TransactionCard({
  isOnline,
  isSelected,
  manageMode,
  onDelete,
  onEdit,
  onToggleSelected,
  transaction,
}: TransactionCardProps) {
  const Icon =
    transaction.type === "income"
      ? TrendingUp
      : transaction.type === "transfer"
        ? ArrowLeftRight
        : TrendingDown;
  const sign = transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : "";

  return (
    <article className={`transaction-card ${transaction.type}`}>
      {manageMode ? (
        <input
          aria-label="选择账单"
          checked={isSelected}
          className="transaction-checkbox"
          onChange={onToggleSelected}
          type="checkbox"
        />
      ) : null}
      <div className="transaction-icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <div className="transaction-main">
        <div className="transaction-title-row">
          <strong>{transaction.merchant || transaction.category}</strong>
          <span className={`transaction-amount ${transaction.type}`}>
            {sign}
            {formatCurrency(transaction.amount)}
          </span>
        </div>
        <div className="transaction-meta">
          <span>{transaction.date}</span>
          <span>{getTransactionTypeLabel(transaction.type)}</span>
          <span>{transaction.category}</span>
          {transaction.payment_method ? <span>{transaction.payment_method}</span> : null}
        </div>
        {transaction.note ? <p className="transaction-note">{transaction.note}</p> : null}
      </div>
      {!manageMode ? (
        <div className="card-actions">
          <AppButton
            aria-label="编辑账单"
            disabled={!isOnline}
            icon={<Pencil size={16} />}
            onClick={onEdit}
            type="button"
            variant="ghost"
          >
            编辑
          </AppButton>
          <AppButton
            aria-label="删除账单"
            disabled={!isOnline}
            icon={<Trash2 size={16} />}
            onClick={onDelete}
            type="button"
            variant="ghost"
          >
            删除
          </AppButton>
        </div>
      ) : null}
    </article>
  );
}
