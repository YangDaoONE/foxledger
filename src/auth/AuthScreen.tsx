import { useState } from "react";
import { LogIn } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { TextField } from "@/components/ui/TextField";
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
      setMessage(error instanceof Error ? error.message : "登录失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          <LogIn size={28} />
        </div>
        <div className="auth-heading">
          <p>FoxLedger</p>
          <h1>狐狐记账</h1>
          <span>移动端优先的个人记账 PWA</span>
        </div>

        <div className="segmented-control" role="tablist" aria-label="登录或注册">
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            type="button"
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
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

          {message ? <p className="form-message">{message}</p> : null}

          <AppButton disabled={isSubmitting} type="submit">
            {isSubmitting ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </AppButton>
        </form>
      </section>
    </main>
  );
}
