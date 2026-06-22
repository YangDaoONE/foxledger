"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { EditTransactionForm } from "@/components/EditTransactionForm";
import { TransactionCard } from "@/components/TransactionCard";
import { listRecentTransactions } from "@/lib/transactions";
import type { Transaction } from "@/types/transaction";

type TransactionListProps = {
  refreshKey: number;
};

export function TransactionList({ refreshKey }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [manualReloadKey, setManualReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadTransactions() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextTransactions = await listRecentTransactions();

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
  }, [refreshKey, manualReloadKey]);

  function handleReload() {
    setSuccessMessage(null);
    setManualReloadKey((value) => value + 1);
  }

  function handleEdit(transaction: Transaction) {
    setSuccessMessage(null);
    setEditingTransactionId(transaction.id);
  }

  function handleCancelEdit() {
    setEditingTransactionId(null);
    setSuccessMessage(null);
  }

  function handleTransactionUpdated() {
    setEditingTransactionId(null);
    setSuccessMessage("保存成功");
    setManualReloadKey((value) => value + 1);
  }

  return (
    <section className="section-block" id="transactions" aria-labelledby="recent-title">
      <div className="section-heading horizontal">
        <div>
          <p>最近账单</p>
          <h2 id="recent-title">真实数据</h2>
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

      {!isLoading && errorMessage ? (
        <div className="list-state error">
          <p>{errorMessage}</p>
          <button type="button" onClick={handleReload}>
            重试
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && transactions.length === 0 ? (
        <p className="list-state">还没有账单。先新增一笔手动账单，保存后会显示在这里。</p>
      ) : null}

      {!isLoading && !errorMessage && transactions.length > 0 ? (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <div className="transaction-edit-item" key={transaction.id}>
              <TransactionCard
                transaction={transaction}
                isEditing={editingTransactionId === transaction.id}
                onEdit={handleEdit}
              />
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
    </section>
  );
}
