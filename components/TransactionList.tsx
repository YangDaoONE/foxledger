"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { EditTransactionForm } from "@/components/EditTransactionForm";
import { TransactionCard } from "@/components/TransactionCard";
import { deleteTransaction, listTransactions } from "@/lib/transactions";
import type { Transaction } from "@/types/transaction";

type TransactionListProps = {
  refreshKey: number;
  onChanged?: () => void;
  grouped?: boolean;
  limit?: number;
  title?: string;
  eyebrow?: string;
  emptyMessage?: string;
};

type DateGroup = {
  date: string;
  transactions: Transaction[];
};

type MonthGroup = {
  month: string;
  dates: DateGroup[];
};

type YearGroup = {
  year: string;
  months: MonthGroup[];
};

function groupTransactionsByDate(transactions: Transaction[]): YearGroup[] {
  const yearGroups: YearGroup[] = [];

  for (const transaction of transactions) {
    const [year = "未知年份", month = "未知月份"] = transaction.date.split("-");
    let yearGroup = yearGroups.find((group) => group.year === year);

    if (!yearGroup) {
      yearGroup = { year, months: [] };
      yearGroups.push(yearGroup);
    }

    let monthGroup = yearGroup.months.find((group) => group.month === month);

    if (!monthGroup) {
      monthGroup = { month, dates: [] };
      yearGroup.months.push(monthGroup);
    }

    let dateGroup = monthGroup.dates.find((group) => group.date === transaction.date);

    if (!dateGroup) {
      dateGroup = { date: transaction.date, transactions: [] };
      monthGroup.dates.push(dateGroup);
    }

    dateGroup.transactions.push(transaction);
  }

  return yearGroups;
}

function formatYearLabel(year: string) {
  return /^\d{4}$/.test(year) ? `${year} 年` : year;
}

function formatMonthLabel(month: string) {
  return /^\d{2}$/.test(month) ? `${Number(month)} 月` : month;
}

function formatDateLabel(date: string) {
  const [, month, day] = date.split("-");

  if (!month || !day) {
    return date;
  }

  return `${Number(month)} 月 ${Number(day)} 日`;
}

export function TransactionList({
  refreshKey,
  onChanged,
  grouped = false,
  limit,
  title = "真实数据",
  eyebrow = "最近账单",
  emptyMessage = "还没有账单。先新增一笔手动账单，保存后会显示在这里。",
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualReloadKey, setManualReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadTransactions() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextTransactions = await listTransactions({ limit });

        if (isMounted) {
          setTransactions(nextTransactions);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "读取账单失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, manualReloadKey, limit]);

  function handleReload() {
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
    setManualReloadKey((value) => value + 1);
  }

  function handleEdit(transaction: Transaction) {
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
    setEditingTransactionId(transaction.id);
  }

  function handleCancelEdit() {
    setEditingTransactionId(null);
    setActionErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleTransactionUpdated() {
    setEditingTransactionId(null);
    setConfirmDeleteId(null);
    setActionErrorMessage(null);
    setSuccessMessage("保存成功");
    setManualReloadKey((value) => value + 1);
    onChanged?.();
  }

  async function handleDelete(transactionId: string) {
    if (deletingId) {
      return;
    }

    setActionErrorMessage(null);
    setSuccessMessage(null);

    if (confirmDeleteId !== transactionId) {
      setConfirmDeleteId(transactionId);
      return;
    }

    setDeletingId(transactionId);

    try {
      await deleteTransaction(transactionId);
      setConfirmDeleteId(null);
      setDeletingId(null);
      if (editingTransactionId === transactionId) {
        setEditingTransactionId(null);
      }
      setSuccessMessage("删除成功");
      setManualReloadKey((value) => value + 1);
      onChanged?.();
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "删除失败。");
      setDeletingId(null);
    }
  }

  return (
    <section className="section-block" aria-labelledby="transaction-list-title">
      <div className="section-heading horizontal">
        <div>
          <p>{eyebrow}</p>
          <h2 id="transaction-list-title">{title}</h2>
        </div>
        <button
          className="text-button"
          disabled={isLoading}
          type="button"
          onClick={handleReload}
        >
          <RefreshCw size={15} aria-hidden="true" />
          刷新
        </button>
      </div>

      {isLoading ? <p className="list-state">正在读取账单</p> : null}

      {!isLoading && successMessage ? (
        <p className="form-message success transaction-list-message">{successMessage}</p>
      ) : null}

      {!isLoading && actionErrorMessage ? (
        <p className="form-message error transaction-list-message">{actionErrorMessage}</p>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="list-state error">
          <p>{errorMessage}</p>
          <button type="button" onClick={handleReload}>
            重试
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && transactions.length === 0 ? (
        <p className="list-state">{emptyMessage}</p>
      ) : null}

      {!isLoading && !errorMessage && transactions.length > 0 && !grouped ? (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <div className="transaction-edit-item" key={transaction.id}>
              <TransactionCard
                transaction={transaction}
                isEditing={editingTransactionId === transaction.id}
                isConfirmingDelete={confirmDeleteId === transaction.id}
                isDeleting={deletingId === transaction.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {deletingId === transaction.id ? (
                <p className="delete-confirm-note">删除中</p>
              ) : null}
              {confirmDeleteId === transaction.id && deletingId !== transaction.id ? (
                <p className="delete-confirm-note">再次点击删除按钮确认删除。</p>
              ) : null}
              {editingTransactionId === transaction.id ? (
                <EditTransactionForm
                  key={transaction.id}
                  transaction={transaction}
                  onCancel={handleCancelEdit}
                  onUpdated={handleTransactionUpdated}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && !errorMessage && transactions.length > 0 && grouped ? (
        <div className="transaction-group-list">
          {groupTransactionsByDate(transactions).map((yearGroup) => (
            <section className="transaction-year-group" key={yearGroup.year}>
              <div className="transaction-year-heading">{formatYearLabel(yearGroup.year)}</div>
              {yearGroup.months.map((monthGroup) => (
                <section className="transaction-month-group" key={`${yearGroup.year}-${monthGroup.month}`}>
                  <div className="transaction-month-heading">{formatMonthLabel(monthGroup.month)}</div>
                  {monthGroup.dates.map((dateGroup) => (
                    <section className="transaction-date-group" key={dateGroup.date}>
                      <div className="transaction-date-heading">{formatDateLabel(dateGroup.date)}</div>
                      <div className="transaction-list">
                        {dateGroup.transactions.map((transaction) => (
                          <div className="transaction-edit-item" key={transaction.id}>
                            <TransactionCard
                              transaction={transaction}
                              isEditing={editingTransactionId === transaction.id}
                              isConfirmingDelete={confirmDeleteId === transaction.id}
                              isDeleting={deletingId === transaction.id}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                            />
                            {deletingId === transaction.id ? (
                              <p className="delete-confirm-note">删除中</p>
                            ) : null}
                            {confirmDeleteId === transaction.id && deletingId !== transaction.id ? (
                              <p className="delete-confirm-note">再次点击删除按钮确认删除。</p>
                            ) : null}
                            {editingTransactionId === transaction.id ? (
                              <EditTransactionForm
                                key={transaction.id}
                                transaction={transaction}
                                onCancel={handleCancelEdit}
                                onUpdated={handleTransactionUpdated}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </section>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}
