"use client";

import { FormEvent, useState } from "react";
import { Send, Sparkles, XCircle } from "lucide-react";
import { ConfirmTransactionBatch } from "@/components/ConfirmTransactionBatch";
import {
  MAX_PARSED_TRANSACTIONS,
  MAX_PARSE_INPUT_CHARS,
} from "@/lib/parseTransactionLimits";
import { supabase } from "@/lib/supabase";
import type { ParsedTransactionBatch } from "@/types/transaction";

type ApiErrorResponse = {
  error?: string;
};

type ChatInputProps = {
  onSaved?: () => void;
};

export function ChatInput({ onSaved }: ChatInputProps) {
  const [text, setText] = useState("");
  const [parsedBatch, setParsedBatch] = useState<ParsedTransactionBatch | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const canParse =
    text.trim().length > 0 && text.length <= MAX_PARSE_INPUT_CHARS && !isParsing;

  async function handleParse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim() || isParsing) {
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);
    setParsedBatch(null);

    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (error || !accessToken) {
      setErrorMessage("请先登录后使用 AI 解析。");
      setIsParsing(false);
      return;
    }

    try {
      const response = await fetch("/api/parse-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text }),
      });

      const responseBody = (await response.json().catch(() => null)) as
        | ParsedTransactionBatch
        | ApiErrorResponse
        | null;

      if (!response.ok) {
        if (response.status === 401) {
          setErrorMessage("请先登录后使用 AI 解析。");
        } else if (response.status === 400) {
          setErrorMessage((responseBody as ApiErrorResponse | null)?.error ?? "输入内容不正确。");
        } else if (response.status === 403) {
          setErrorMessage((responseBody as ApiErrorResponse | null)?.error ?? "当前账号不允许使用 AI 解析。");
        } else {
          setErrorMessage("AI 解析失败，请稍后重试。");
        }
        return;
      }

      setParsedBatch(responseBody as ParsedTransactionBatch);
      setResultVersion((value) => value + 1);
    } catch {
      setErrorMessage("AI 解析失败，请稍后重试。");
    } finally {
      setIsParsing(false);
    }
  }

  function handleClear() {
    setParsedBatch(null);
    setErrorMessage(null);
  }

  function handleSaved() {
    setText("");
    setParsedBatch(null);
    setErrorMessage(null);
    onSaved?.();
  }

  return (
    <section className="chat-panel" aria-labelledby="ai-input-title">
      <div className="section-heading">
        <p>AI 记账</p>
        <h2 id="ai-input-title">一段文本记多笔</h2>
      </div>

      <form className="chat-form" onSubmit={handleParse}>
        <label className="chat-input-label" htmlFor="ai-input">
          <Sparkles size={18} aria-hidden="true" />
          <span>输入内容</span>
        </label>
        <textarea
          id="ai-input"
          maxLength={MAX_PARSE_INPUT_CHARS}
          placeholder="例如：今天中午麦当劳花了 38，支付宝；晚上地铁 6 元；昨天工资到账 12000"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="confirm-note">
          最多 {MAX_PARSE_INPUT_CHARS} 字，单次最多解析 {MAX_PARSED_TRANSACTIONS} 笔候选账单。
        </p>

        {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

        <div className="action-row">
          <button className="secondary-button" type="button" onClick={handleClear}>
            <XCircle size={18} aria-hidden="true" />
            清空解析结果
          </button>
          <button className="primary-button" type="submit" disabled={!canParse}>
            <Send size={18} aria-hidden="true" />
            {isParsing ? "解析中" : "解析"}
          </button>
        </div>
      </form>

      {parsedBatch ? (
        <ConfirmTransactionBatch
          key={`${resultVersion}-${parsedBatch.transactions.length}`}
          batch={parsedBatch}
          onSaved={handleSaved}
        />
      ) : null}
    </section>
  );
}
