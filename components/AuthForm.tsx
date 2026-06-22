"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Mail, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthMode = "signIn" | "signUp";

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setErrorMessage("请输入有效的邮箱。");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("密码至少需要 6 位。");
      return;
    }

    setIsSubmitting(true);

    const result =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })
        : await supabase.auth.signUp({
            email: normalizedEmail,
            password,
          });

    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    if (mode === "signUp") {
      setSuccessMessage("注册请求已提交。如果 Supabase 开启邮箱确认，请先去邮箱完成确认。");
      return;
    }

    setSuccessMessage("登录成功。");
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-brand">
        <p>FoxLedger</p>
        <h1 id="auth-title">狐狐记账</h1>
        <span>登录后继续查看你的记账首页</span>
      </div>

      <div className="auth-tabs" role="tablist" aria-label="登录方式">
        <button
          className={mode === "signIn" ? "auth-tab active" : "auth-tab"}
          type="button"
          onClick={() => {
            setMode("signIn");
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          登录
        </button>
        <button
          className={mode === "signUp" ? "auth-tab active" : "auth-tab"}
          type="button"
          onClick={() => {
            setMode("signUp");
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          注册
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="email">
          邮箱
        </label>
        <div className="field-control">
          <Mail size={18} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <label className="field-label" htmlFor="password">
          密码
        </label>
        <div className="field-control">
          <KeyRound size={18} aria-hidden="true" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            placeholder="至少 6 位"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
        {successMessage ? <p className="form-message success">{successMessage}</p> : null}

        <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
          {mode === "signUp" ? <UserPlus size={18} aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
          {isSubmitting ? "处理中" : mode === "signIn" ? "登录" : "注册"}
        </button>
      </form>
    </section>
  );
}
