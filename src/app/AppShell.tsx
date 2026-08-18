import { useEffect } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";

import { BottomNav } from "@/components/BottomNav";
import { ChatSessionProvider } from "@/features/chat/ChatSessionProvider";
import { SyncStatusBanner } from "@/features/sync/SyncStatusBanner";
import { SyncProvider, useSyncState } from "@/features/sync/SyncProvider";

function AppShellContent() {
  const { isOnline, isSyncing, syncError, syncMeta, syncNow, syncPhase } = useSyncState();
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
        <Outlet />
      </main>
      <BottomNav />
    </>
  );
}

export function AppShell() {
  return (
    <SyncProvider>
      <ChatSessionProvider>
        <AppShellContent />
      </ChatSessionProvider>
    </SyncProvider>
  );
}
