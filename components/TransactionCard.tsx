import {
  CircleHelp,
  GraduationCap,
  Landmark,
  Pencil,
  ShoppingBag,
  Train,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatAmountByType } from "@/lib/format";
import type { Transaction } from "@/types/transaction";

type TransactionCardProps = {
  transaction: Transaction;
  isEditing?: boolean;
  onEdit?: (transaction: Transaction) => void;
};

const categoryIcons: Record<string, LucideIcon> = {
  餐饮: Utensils,
  交通: Train,
  购物: ShoppingBag,
  学习: GraduationCap,
  收入: Landmark,
};

export function TransactionCard({ transaction, isEditing = false, onEdit }: TransactionCardProps) {
  const Icon = categoryIcons[transaction.category] ?? CircleHelp;
  const amountText = formatAmountByType(transaction.type, transaction.amount);
  const amountClassName =
    transaction.type === "income" ? "transaction-amount income" : "transaction-amount";

  return (
    <article className="transaction-card">
      <div className="transaction-icon" aria-hidden="true">
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
                title="编辑账单"
                onClick={() => onEdit(transaction)}
              >
                <Pencil size={15} aria-hidden="true" />
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
