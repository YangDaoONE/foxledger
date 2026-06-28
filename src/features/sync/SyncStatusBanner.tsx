import { Wifi, WifiOff } from "lucide-react";

import { formatDateTime } from "@/lib/format";

type SyncStatusBannerProps = {
  isOnline: boolean;
  isSyncing: boolean;
  lastSuccessfulSyncAt: string | null;
  syncError: string | null;
};

export function SyncStatusBanner({
  isOnline,
  isSyncing,
  lastSuccessfulSyncAt,
  syncError,
}: SyncStatusBannerProps) {
  let text = `已同步缓存 · 上次同步 ${formatDateTime(lastSuccessfulSyncAt)}`;
  let tone = "synced";

  if (!isOnline) {
    text = `离线缓存 · 上次同步 ${formatDateTime(lastSuccessfulSyncAt)}`;
    tone = "offline";
  } else if (isSyncing) {
    text = "同步中 · 正在刷新本地缓存";
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
