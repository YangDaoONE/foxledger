import { CheckCircle2, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { TransactionSyncPhase } from "@/features/transactions/transactionSync";

type SyncStatusBannerProps = {
  isOnline: boolean;
  isSyncing: boolean;
  lastSuccessfulSyncAt: string | null;
  onRetry: () => void;
  rowCount: number;
  syncError: string | null;
  syncPhase: TransactionSyncPhase | null;
};

export function SyncStatusBanner({
  isOnline,
  isSyncing,
  lastSuccessfulSyncAt,
  onRetry,
  rowCount,
  syncError,
  syncPhase,
}: SyncStatusBannerProps) {
  let title = "已同步缓存";
  let detail = `${rowCount} 条账单 · 最近成功 ${formatDateTime(lastSuccessfulSyncAt)}`;
  let tone = "synced";
  let icon = <CheckCircle2 size={18} aria-hidden="true" />;

  if (!isOnline) {
    title = "离线缓存";
    detail = `${rowCount} 条账单 · 最近成功 ${formatDateTime(lastSuccessfulSyncAt)}`;
    tone = "offline";
    icon = <WifiOff size={18} aria-hidden="true" />;
  } else if (isSyncing) {
    title = "同步中";
    detail = getSyncingText(syncPhase);
    tone = "syncing";
    icon = <RefreshCw className="spin" size={18} aria-hidden="true" />;
  } else if (syncError) {
    title = "同步失败，显示上次缓存";
    detail = `${syncError} · 最近成功 ${formatDateTime(lastSuccessfulSyncAt)}`;
    tone = "error";
    icon = <TriangleAlert size={18} aria-hidden="true" />;
  } else if (!lastSuccessfulSyncAt) {
    title = "同步中";
    detail = "正在准备本地缓存";
    tone = "syncing";
    icon = <RefreshCw className="spin" size={18} aria-hidden="true" />;
  }

  return (
    <section
      aria-atomic="true"
      aria-busy={tone === "syncing"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`sync-banner ${tone}`}
    >
      <span className="sync-banner-icon">{icon}</span>
      <span className="sync-banner-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      {tone === "error" && isOnline ? (
        <button className="sync-retry" type="button" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" />
          重试
        </button>
      ) : null}
    </section>
  );
}

function getSyncingText(syncPhase: TransactionSyncPhase | null) {
  if (syncPhase === "fetching-remote") {
    return "正在读取云端账单";
  }

  if (syncPhase === "replacing-cache") {
    return "正在替换本地缓存";
  }

  if (syncPhase === "recording-failure") {
    return "正在记录失败状态";
  }

  return "正在准备同步";
}
