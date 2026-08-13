import { useState } from "react";
import { Check, WalletCards } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { TextField } from "@/components/ui/TextField";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export function AuthScreen({ initialError }: { initialError: string | null }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      const action =
        mode === "login"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });
      const { error } = await action;

      if (error) {
        throw new Error(error.message);
      }

      if (mode === "register") {
        setMessage("注册请求已提交，如开启邮件确认，请先完成邮箱验证。");
      }
    } catch (error) {
      setMessage(getErrorMessage(error, "登录失败。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand-panel">
          <div className="brand-mark" aria-hidden="true">
            <WalletCards size={28} />
          </div>
          <div className="auth-heading">
            <p>FoxLedger</p>
            <h1>狐狐记账</h1>
            <span>清楚记录每一笔，也能有依据地问账。</span>
          </div>
          <ul className="auth-benefits" aria-label="产品特性">
            <li><Check size={15} aria-hidden="true" />当前用户数据由 RLS 隔离</li>
            <li><Check size={15} aria-hidden="true" />离线时只读上次完整缓存</li>
            <li><Check size={15} aria-hidden="true" />AI 候选确认后才写入</li>
          </ul>
        </div>

        <div className="auth-form-panel">
          <div className="segmented-control" role="tablist" aria-label="登录或注册">
            <button
              aria-controls="auth-form-panel"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              id="auth-login-tab"
              role="tab"
              type="button"
              onClick={() => setMode("login")}
            >
              登录
            </button>
            <button
              aria-controls="auth-form-panel"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              id="auth-register-tab"
              role="tab"
              type="button"
              onClick={() => setMode("register")}
            >
              注册
            </button>
          </div>

          <form
            aria-labelledby={`auth-${mode}-tab`}
            className="form-stack"
            id="auth-form-panel"
            role="tabpanel"
            onSubmit={handleSubmit}
          >
            <TextField
              autoComplete="email"
              label="邮箱"
              onChange={setEmail}
              type="email"
              value={email}
            />
            <TextField
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              label="密码"
              onChange={setPassword}
              type="password"
              value={password}
            />

            {message ? <p className="form-message" role="status">{message}</p> : null}

            <AppButton disabled={isSubmitting} type="submit">
              {isSubmitting ? "处理中..." : mode === "login" ? "登录" : "注册"}
            </AppButton>
          </form>
        </div>
      </section>
    </main>
  );
}
