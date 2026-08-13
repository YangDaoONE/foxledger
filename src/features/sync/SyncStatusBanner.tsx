import { Wifi, WifiOff } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { TransactionSyncPhase } from "@/features/transactions/transactionSync";

type SyncStatusBannerProps = {
  isOnline: boolean;
  isSyncing: boolean;
  lastSuccessfulSyncAt: string | null;
  syncError: string | null;
  syncPhase: TransactionSyncPhase | null;
};

export function SyncStatusBanner({
  isOnline,
  isSyncing,
  lastSuccessfulSyncAt,
  syncError,
  syncPhase,
}: SyncStatusBannerProps) {
  let text = `已同步缓存 · 上次同步 ${formatDateTime(lastSuccessfulSyncAt)}`;
  let tone = "synced";

  if (!isOnline) {
    text = `离线缓存 · 上次同步 ${formatDateTime(lastSuccessfulSyncAt)}`;
    tone = "offline";
  } else if (isSyncing) {
    text = getSyncingText(syncPhase);
    tone = "syncing";
  } else if (syncError) {
    text = `同步失败，显示上次缓存 · ${syncError}`;
    tone = "error";
  } else if (!lastSuccessfulSyncAt) {
    text = "同步中 · 正在准备本地缓存";
    tone = "syncing";
  }

  return (
    <div className={`sync-banner ${tone}`}>
      {isOnline ? <Wifi size={18} aria-hidden="true" /> : <WifiOff size={18} aria-hidden="true" />}
      <span>{text}</span>
    </div>
  );
}

function getSyncingText(syncPhase: TransactionSyncPhase | null) {
  if (syncPhase === "fetching-remote") {
    return "同步中 · 正在读取云端账单";
  }

  if (syncPhase === "replacing-cache") {
    return "同步中 · 正在替换本地缓存";
  }

  if (syncPhase === "recording-failure") {
    return "同步中 · 正在记录失败状态";
  }

  return "同步中 · 正在准备同步";
}
