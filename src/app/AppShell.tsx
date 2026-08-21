import { useEffect } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";

import { BottomNav } from "@/components/BottomNav";
import { StateBlock } from "@/components/ui/StateBlock";
import { ChatSessionProvider } from "@/features/chat/ChatSessionProvider";
import { LedgerProvider, useLedgerState } from "@/features/ledgers/LedgerProvider";
import { LedgerSwitcher } from "@/features/ledgers/LedgerSwitcher";
import { SyncStatusBanner } from "@/features/sync/SyncStatusBanner";
import { SyncProvider, useSyncState } from "@/features/sync/SyncProvider";

function AppShellContent() {
  const { isOnline, isSyncing, syncError, syncMeta, syncNow, syncPhase } = useSyncState();
  const { activeLedger, isLoading: isLedgerLoading } = useLedgerState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    window.scrollTo({ behavior: "auto", left: 0, top: 0 });
  }, [pathname]);

  return (
    <>
      <main className="app-shell">
        <header className="app-header">
          <div>
            <p>FoxLedger</p>
            <h1>狐狐记账</h1>
          </div>
          <LedgerSwitcher />
        </header>
        <SyncStatusBanner
          isOnline={isOnline}
          isSyncing={isSyncing}
          lastSuccessfulSyncAt={syncMeta?.last_successful_sync_at ?? null}
          rowCount={syncMeta?.row_count ?? 0}
          syncError={syncError}
          syncPhase={syncPhase}
          onRetry={() => {
            void syncNow().catch(() => undefined);
          }}
        />
        {activeLedger ? (
          <Outlet />
        ) : (
          <StateBlock
            title={isLedgerLoading || isSyncing ? "正在准备账本" : "暂时没有可用账本"}
            tone={syncError ? "danger" : "neutral"}
          >
            {syncError
              ? "账本同步失败，请检查网络和数据库迁移后重试。"
              : "首次登录会安全创建默认账本。"}
          </StateBlock>
        )}
      </main>
      <BottomNav />
    </>
  );
}

export function AppShell() {
  return (
    <SyncProvider>
      <LedgerProvider>
        <ChatSessionProvider>
          <AppShellContent />
        </ChatSessionProvider>
      </LedgerProvider>
    </SyncProvider>
  );
}
