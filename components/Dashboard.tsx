"use client";

import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import { BottomNav, type DashboardView } from "@/components/BottomNav";
import { ChatInput } from "@/components/ChatInput";
import { ImportTransactions } from "@/components/ImportTransactions";
import { ManualTransactionForm } from "@/components/ManualTransactionForm";
import { MonthlySummary } from "@/components/MonthlySummary";
import { StatsPanel } from "@/components/StatsPanel";
import { TransactionList } from "@/components/TransactionList";
import { TransactionManager } from "@/components/TransactionManager";
import { getMonthlyStats } from "@/lib/stats";
import type { MonthlySummaryData } from "@/types/transaction";

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>("home");
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryData>({
    month: "本月",
    expense: 0,
    income: 0,
    balance: 0,
    budgetUsedPercent: 0,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadMonthlySummary() {
      try {
        const stats = await getMonthlyStats();

        if (isMounted) {
          setMonthlySummary(stats.summary);
        }
      } catch {
        // StatsPanel has the user-facing retry state. Keep the last summary on home.
      }
    }

    loadMonthlySummary();

    return () => {
      isMounted = false;
    };
  }, [transactionRefreshKey]);

  function handleTransactionSaved() {
    setTransactionRefreshKey((value) => value + 1);
  }

  function renderActiveView() {
    if (activeView === "home") {
      return (
        <>
          <MonthlySummary summary={monthlySummary} />
          <ManualTransactionForm onSaved={handleTransactionSaved} />
          <ChatInput onSaved={handleTransactionSaved} />
          <TransactionList
            eyebrow="最近账单"
            title="最近 5 笔"
            limit={5}
            refreshKey={transactionRefreshKey}
            emptyMessage="还没有账单。先用手动记账或 AI 记账新增一笔。"
            onChanged={handleTransactionSaved}
          />
        </>
      );
    }

    if (activeView === "transactions") {
      return <TransactionManager refreshKey={transactionRefreshKey} onChanged={handleTransactionSaved} />;
    }

    if (activeView === "stats") {
      return <StatsPanel refreshKey={transactionRefreshKey} />;
    }

    return (
      <>
        <div className="view-heading section-heading">
          <p>设置</p>
          <h2>数据和偏好</h2>
        </div>
        <ImportTransactions onImported={handleTransactionSaved} />
      </>
    );
  }

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

        {renderActiveView()}
      </div>

      <BottomNav activeView={activeView} onViewChange={setActiveView} />
    </>
  );
}
