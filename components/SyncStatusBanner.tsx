import { Wifi, WifiOff } from "lucide-react";

type SyncStatusBannerProps = {
  isOnline: boolean;
  lastSuccessfulSyncAt: string | null;
  syncError: string | null;
};

function formatSyncTime(value: string | null) {
  if (!value) {
    return "暂无同步记录";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SyncStatusBanner({
  isOnline,
  lastSuccessfulSyncAt,
  syncError,
}: SyncStatusBannerProps) {
  if (!isOnline) {
    return (
      <div className="sync-status-banner offline" role="status">
        <WifiOff size={17} aria-hidden="true" />
        <span>离线缓存 · 上次同步 {formatSyncTime(lastSuccessfulSyncAt)}</span>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="sync-status-banner warning" role="status">
        <Wifi size={17} aria-hidden="true" />
        <span>同步失败，显示上次缓存 · {formatSyncTime(lastSuccessfulSyncAt)}</span>
      </div>
    );
  }

  if (!lastSuccessfulSyncAt) {
    return (
      <div className="sync-status-banner neutral" role="status">
        <Wifi size={17} aria-hidden="true" />
        <span>同步中 · 正在准备本地缓存</span>
      </div>
    );
  }

  return (
    <div className="sync-status-banner online" role="status">
      <Wifi size={17} aria-hidden="true" />
      <span>已同步缓存 · 上次同步 {formatSyncTime(lastSuccessfulSyncAt)}</span>
    </div>
  );
}
