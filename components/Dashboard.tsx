"use client";

import { useCallback, useState } from "react";
import { Bell, Search } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ChatInput } from "@/components/ChatInput";
import { ImportTransactions } from "@/components/ImportTransactions";
import { ManualTransactionForm } from "@/components/ManualTransactionForm";
import { MonthlySummary } from "@/components/MonthlySummary";
import { StatsPanel } from "@/components/StatsPanel";
import { TransactionList } from "@/components/TransactionList";
import type { MonthlySummaryData } from "@/types/transaction";

export function Dashboard() {
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryData>({
    month: "本月",
    expense: 0,
    income: 0,
    balance: 0,
    budgetUsedPercent: 0,
  });

  function handleTransactionSaved() {
    setTransactionRefreshKey((value) => value + 1);
  }

  const handleSummaryChange = useCallback((summary: MonthlySummaryData) => {
    setMonthlySummary(summary);
  }, []);

  return (
    <>
      <div className="app-content">
        <header className="app-header">
          <div>
            <p>FoxLedger</p>
            <h1>狐狐记账</h1>
          </div>
          <div className="header-actions" aria-label="快捷操作">
            <button className="icon-button" type="button" aria-label="搜索账单">
              <Search size={20} aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" aria-label="通知">
              <Bell size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <MonthlySummary summary={monthlySummary} />

        <ManualTransactionForm onSaved={handleTransactionSaved} />

        <ChatInput onSaved={handleTransactionSaved} />

        <ImportTransactions onImported={handleTransactionSaved} />

        <TransactionList refreshKey={transactionRefreshKey} onChanged={handleTransactionSaved} />

        <StatsPanel refreshKey={transactionRefreshKey} onSummaryChange={handleSummaryChange} />
      </div>

      <BottomNav />
    </>
  );
}
