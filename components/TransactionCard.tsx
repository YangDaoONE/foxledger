import {
  CircleHelp,
  GraduationCap,
  Landmark,
  Pencil,
  ShoppingBag,
  Trash2,
  Train,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatAmountByType } from "@/lib/format";
import type { Transaction } from "@/types/transaction";

type TransactionCardProps = {
  transaction: Transaction;
  isEditing?: boolean;
  isConfirmingDelete?: boolean;
  isDeleting?: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
};

const categoryIcons: Record<string, LucideIcon> = {
  餐饮: Utensils,
  交通: Train,
  购物: ShoppingBag,
  学习: GraduationCap,
  收入: Landmark,
};

export function TransactionCard({
  transaction,
  isEditing = false,
  isConfirmingDelete = false,
  isDeleting = false,
  onEdit,
  onDelete,
}: TransactionCardProps) {
  const Icon = categoryIcons[transaction.category] ?? CircleHelp;
  const amountText = formatAmountByType(transaction.type, transaction.amount);
  const amountClassName =
    transaction.type === "income"
      ? "transaction-amount income"
      : transaction.type === "transfer"
        ? "transaction-amount transfer"
        : "transaction-amount";
  const iconClassName =
    transaction.type === "income"
      ? "transaction-icon income"
      : transaction.type === "transfer"
        ? "transaction-icon transfer"
        : "transaction-icon";

  return (
    <article className={`transaction-card ${transaction.type}`}>
      <div className={iconClassName} aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </div>

      <div className="transaction-main">
        <div className="transaction-title-row">
          <h3>{transaction.merchant ?? transaction.category}</h3>
          <div className="transaction-side">
            <strong className={amountClassName}>{amountText}</strong>
            {onEdit ? (
              <button
                className="small-icon-button"
                type="button"
                aria-label={isEditing ? "正在编辑这笔账单" : "编辑这笔账单"}
                aria-pressed={isEditing}
                disabled={isDeleting}
                title="编辑账单"
                onClick={() => onEdit(transaction)}
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
            ) : null}
            {onDelete ? (
              <button
                className={
                  isConfirmingDelete ? "small-icon-button danger confirm" : "small-icon-button danger"
                }
                type="button"
                aria-label={isConfirmingDelete ? "确认删除这笔账单" : "删除这笔账单"}
                aria-pressed={isConfirmingDelete}
                disabled={isDeleting}
                title={isConfirmingDelete ? "确认删除" : "删除账单"}
                onClick={() => onDelete(transaction.id)}
              >
                {isDeleting ? "删" : <Trash2 size={15} aria-hidden="true" />}
              </button>
            ) : null}
          </div>
        </div>
        <p>
          {transaction.category}
          {transaction.tag ? ` · ${transaction.tag}` : ""}
          {transaction.payment_method ? ` · ${transaction.payment_method}` : ""}
        </p>
        <span>{transaction.date}</span>
      </div>
    </article>
  );
}
