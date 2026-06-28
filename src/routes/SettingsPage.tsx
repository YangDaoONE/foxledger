import { useState } from "react";
import { LogOut } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { ImportTransactions } from "@/features/import/ImportTransactions";
import { useSyncState } from "@/features/sync/SyncProvider";

export function SettingsPage() {
  const { signOut, user } = useAuth();
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
      setMessage(error instanceof Error ? error.message : "退出登录失败。");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="view-stack">
      <SectionBlock eyebrow="账号" title="登录信息">
        <div className="account-panel">
          <span>当前邮箱</span>
          <strong>{user?.email ?? "未知"}</strong>
          <span>缓存行数</span>
          <strong>{syncMeta?.row_count ?? 0}</strong>
        </div>
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

      {user ? (
        <ImportTransactions
          isOnline={isOnline}
          onImported={refreshAfterWrite}
          userId={user.id}
        />
      ) : null}
    </div>
  );
}
