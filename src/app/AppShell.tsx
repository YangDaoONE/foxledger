import { Outlet } from "@tanstack/react-router";

import { BottomNav } from "@/components/BottomNav";
import { SyncStatusBanner } from "@/features/sync/SyncStatusBanner";
import { SyncProvider, useSyncState } from "@/features/sync/SyncProvider";

function AppShellContent() {
  const { isOnline, isSyncing, syncError, syncMeta } = useSyncState();

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
          syncError={syncError}
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
      <AppShellContent />
    </SyncProvider>
  );
}
