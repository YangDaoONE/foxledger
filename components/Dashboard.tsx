"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuthUser } from "@/components/AuthGate";
import { BottomNav, type DashboardView } from "@/components/BottomNav";
import { ChatInput } from "@/components/ChatInput";
import { ImportTransactions } from "@/components/ImportTransactions";
import { ManualTransactionForm } from "@/components/ManualTransactionForm";
import { MonthlySummary } from "@/components/MonthlySummary";
import { StatsPanel, type StatsDrilldownTarget } from "@/components/StatsPanel";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { TransactionManager, type TransactionFilterOverride } from "@/components/TransactionManager";
import type { SyncMeta } from "@/lib/localDb";
import { useNetworkStatus } from "@/lib/networkStatus";
import { getMonthlyStats } from "@/lib/stats";
import { getCachedSyncMeta, syncTransactionsFromRemote } from "@/lib/transactionSync";
import type { MonthlySummaryData } from "@/types/transaction";

export function Dashboard() {
  const authUser = useAuthUser();
  const userId = authUser.id;
  const isOnline = useNetworkStatus();
  const [activeView, setActiveView] = useState<DashboardView>("home");
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
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
        const stats = await getMonthlyStats(userId);

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
  }, [cacheVersion, userId]);

  useEffect(() => {
    let isMounted = true;

    async function syncTransactions() {
      try {
        const meta = await getCachedSyncMeta(userId);

        if (isMounted) {
          setSyncMeta(meta);
          setSyncError(meta?.last_error ?? null);
        }
      } catch {
        // Local sync metadata is only advisory in phase 1.
      }

      if (!isOnline) {
        return;
      }

      try {
        const result = await syncTransactionsFromRemote(userId);

        if (isMounted) {
          setSyncMeta(result.meta);
          setSyncError(null);
          setCacheVersion((value) => value + 1);
        }
      } catch (error) {
        // Phase 1 keeps the last local cache visible if remote sync fails.
        if (isMounted) {
          setSyncError(error instanceof Error ? error.message : "同步账单失败。");
        }
      }
    }

    syncTransactions();

    return () => {
      isMounted = false;
    };
  }, [isOnline, transactionRefreshKey, userId]);

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
              isOnline={isOnline}
              onCancel={() => setIsManualFormOpen(false)}
              onSaved={handleManualTransactionSaved}
              userId={userId}
            />
          ) : (
            <button className="manual-entry-button" type="button" onClick={() => setIsManualFormOpen(true)}>
              <span className="manual-entry-icon" aria-hidden="true">
                <Plus size={24} />
              </span>
              <span>
                <strong>手动记账</strong>
                <small>{isOnline ? "新增一笔账单" : "联网后可保存"}</small>
              </span>
            </button>
          )}
          <ChatInput isOnline={isOnline} onSaved={handleTransactionSaved} />
        </>
      );
    }

    if (activeView === "transactions") {
      return (
        <TransactionManager
          key={transactionFilterOverride?.id ?? "transactions-default"}
          filterOverride={transactionFilterOverride}
          isOnline={isOnline}
          refreshKey={cacheVersion}
          userId={userId}
          onChanged={handleTransactionSaved}
        />
      );
    }

    if (activeView === "stats") {
      return <StatsPanel refreshKey={cacheVersion} userId={userId} onDrilldown={handleStatsDrilldown} />;
    }

    return (
      <>
        <div className="view-heading section-heading">
          <p>设置</p>
          <h2>数据和偏好</h2>
        </div>
        <ImportTransactions isOnline={isOnline} onImported={handleTransactionSaved} />
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

        <SyncStatusBanner
          isOnline={isOnline}
          lastSuccessfulSyncAt={syncMeta?.last_successful_sync_at ?? null}
          syncError={syncError}
        />

        {renderActiveView()}
      </div>

      <BottomNav activeView={activeView} onViewChange={handleViewChange} />
    </>
  );
}
