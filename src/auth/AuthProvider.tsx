import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { clearCachedDataForUser } from "@/lib/localDb";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

type AuthState = {
  error: string | null;
  isLoading: boolean;
  session: Session | null;
  signOut: () => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      setSession(data.session ?? null);
      setIsLoading(false);
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
      setError(null);
    });

    loadSession();

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const userId = session?.user.id;
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      throw new Error(signOutError.message);
    }

    if (userId) {
      await clearCachedDataForUser(userId);
    }

    queryClient.clear();
    setSession(null);
  }, [session?.user.id]);

  const value = useMemo<AuthState>(
    () => ({
      error,
      isLoading,
      session,
      signOut,
      user: session?.user ?? null,
    }),
    [error, isLoading, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}

export function useAuthUser() {
  const { user } = useAuth();

  if (!user) {
    throw new Error("当前页面需要先登录。");
  }

  return user;
}
