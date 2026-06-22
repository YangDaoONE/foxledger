"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LoaderCircle, LogOut } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { supabase } from "@/lib/supabase";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setSignOutError(null);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setSignOutError(error.message);
    }
  }

  if (isLoading) {
    return (
      <main className="app-root auth-root" aria-label="加载登录状态">
        <div className="auth-loading">
          <LoaderCircle size={24} aria-hidden="true" />
          <span>正在检查登录状态</span>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app-root auth-root">
        <AuthForm />
      </main>
    );
  }

  return (
    <main className="app-root" id="home">
      <div className="account-strip">
        <div>
          <span>当前用户</span>
          <strong>{session.user.email}</strong>
        </div>
        <button className="sign-out-button" type="button" onClick={handleSignOut}>
          <LogOut size={17} aria-hidden="true" />
          退出
        </button>
      </div>
      {signOutError ? <p className="form-message error account-error">{signOutError}</p> : null}
      {children}
    </main>
  );
}
