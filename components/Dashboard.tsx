"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { BottomNav, type DashboardView } from "@/components/BottomNav";
import { ChatInput } from "@/components/ChatInput";
import { ImportTransactions } from "@/components/ImportTransactions";
import { ManualTransactionForm } from "@/components/ManualTransactionForm";
import { MonthlySummary } from "@/components/MonthlySummary";
import { StatsPanel, type StatsDrilldownTarget } from "@/components/StatsPanel";
import { TransactionManager, type TransactionFilterOverride } from "@/components/TransactionManager";
import { getMonthlyStats } from "@/lib/stats";
import type { MonthlySummaryData } from "@/types/transaction";

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>("home");
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);
  const [transactionFilterOverride, setTransactionFilterOverride] =
    useState<TransactionFilterOverride | null>(null);
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

  function handleManualTransactionSaved() {
    handleTransactionSaved();
    setIsManualFormOpen(false);
  }

  function handleStatsDrilldown(target: StatsDrilldownTarget) {
    setTransactionFilterOverride((current) => ({
      id: (current?.id ?? 0) + 1,
      label: target.label,
      search: "",
      type: target.type,
      category: target.category ?? "",
      startDate: target.startDate,
      endDate: target.endDate,
      sort: "date-desc",
    }));
    setActiveView("transactions");
  }

  function handleViewChange(nextView: DashboardView) {
    if (nextView !== "transactions" || activeView === "transactions") {
      setTransactionFilterOverride(null);
    }

    if (nextView !== "home") {
      setIsManualFormOpen(false);
    }

    setActiveView(nextView);
  }

  function renderActiveView() {
    if (activeView === "home") {
      return (
        <>
          <MonthlySummary summary={monthlySummary} />
          {isManualFormOpen ? (
            <ManualTransactionForm
              onCancel={() => setIsManualFormOpen(false)}
              onSaved={handleManualTransactionSaved}
            />
          ) : (
            <button className="manual-entry-button" type="button" onClick={() => setIsManualFormOpen(true)}>
              <span className="manual-entry-icon" aria-hidden="true">
                <Plus size={24} />
              </span>
              <span>
                <strong>手动记账</strong>
                <small>新增一笔账单</small>
              </span>
            </button>
          )}
          <ChatInput onSaved={handleTransactionSaved} />
        </>
      );
    }

    if (activeView === "transactions") {
      return (
        <TransactionManager
          key={transactionFilterOverride?.id ?? "transactions-default"}
          filterOverride={transactionFilterOverride}
          refreshKey={transactionRefreshKey}
          onChanged={handleTransactionSaved}
        />
      );
    }

    if (activeView === "stats") {
      return <StatsPanel refreshKey={transactionRefreshKey} onDrilldown={handleStatsDrilldown} />;
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
        </header>

        {renderActiveView()}
      </div>

      <BottomNav activeView={activeView} onViewChange={handleViewChange} />
    </>
  );
}
