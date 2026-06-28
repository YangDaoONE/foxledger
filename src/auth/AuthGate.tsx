import type { ReactNode } from "react";

import { AuthScreen } from "@/auth/AuthScreen";
import { useAuth } from "@/auth/AuthProvider";
import { StateBlock } from "@/components/ui/StateBlock";

export function AuthGate({ children }: { children: ReactNode }) {
  const { error, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <main className="auth-shell">
        <StateBlock title="正在恢复会话" tone="neutral">
          正在读取本设备登录状态。
        </StateBlock>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen initialError={error} />;
  }

  return <>{children}</>;
}
