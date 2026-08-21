import { useState } from "react";
import { LogOut, Settings2 } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { ImportTransactions } from "@/features/import/ImportTransactions";
import { useActiveLedger, useLedgerState } from "@/features/ledgers/LedgerProvider";
import { LedgerManagement } from "@/features/ledgers/LedgerManagement";
import { useSyncState } from "@/features/sync/SyncProvider";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

export function SettingsPage() {
  const { signOut, user } = useAuth();
  const activeLedger = useActiveLedger();
  const { ledgers } = useLedgerState();
  const { isOnline, refreshAfterWrite, syncMeta } = useSyncState();
  const [message, setMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (!isOnline) {
      setMessage("离线时不能退出登录，请联网后再退出。");
      return;
    }

    setIsSigningOut(true);
    setMessage(null);

    try {
      await signOut();
    } catch (error) {
      setMessage(getErrorMessage(error, "退出登录失败。"));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="view-stack settings-page">
      <PageIntro
        description="管理登录、隐私说明和 CSV 导入，不在浏览器保存聊天内容。"
        eyebrow="设置"
        icon={<Settings2 size={24} />}
        title="账号与数据边界"
      />

      <SectionBlock
        className="settings-account"
        description="缓存行数来自当前用户最近一次完整同步。"
        eyebrow="账号"
        title="登录信息"
      >
        <dl className="account-panel">
          <div>
            <dt>当前邮箱</dt>
            <dd>{user?.email ?? "未知"}</dd>
          </div>
          <div>
            <dt>缓存行数</dt>
            <dd>{syncMeta?.row_count ?? 0}</dd>
          </div>
          <div>
            <dt>最近同步</dt>
            <dd>{formatDateTime(syncMeta?.last_successful_sync_at ?? null)}</dd>
          </div>
        </dl>
        {message ? <p className="form-message danger">{message}</p> : null}
        <AppButton
          disabled={isSigningOut}
          icon={<LogOut size={16} />}
          type="button"
          variant="secondary"
          onClick={handleSignOut}
        >
          {isSigningOut ? "退出中..." : "退出登录"}
        </AppButton>
      </SectionBlock>

      <LedgerManagement />

      <SectionBlock
        className="settings-privacy"
        eyebrow="AI 与隐私"
        title="狐狐如何使用账本数据"
      >
        <p className="settings-help-text">
          记账时只发送当前输入文字。问账时，服务端会在当前用户 RLS 边界内读取云端相关账单，向当前配置的 AI 服务发送代码计算的完整相关统计，以及最多 500 条仅含日期、类型、金额、分类和商家的相关明细。Dexie 本地缓存、备注、账户、支付方式、原文、用户 ID 和交易 ID 不会发送给 AI。
        </p>
        <p className="settings-help-text">
          AI 只生成候选或解释：记账仍需你确认后才写入，问账回答不会自动新增、修改或删除账单。
        </p>
      </SectionBlock>

      {user ? (
        <ImportTransactions
          defaultLedgerId={activeLedger.id}
          isOnline={isOnline}
          ledgers={ledgers}
          onImported={refreshAfterWrite}
          userId={user.id}
        />
      ) : null}
    </div>
  );
}
