"use client";

import { FormEvent, useState } from "react";
import { ChevronDown, Plus, Save, X } from "lucide-react";
import { getLocalDateInputValue } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_CURRENCY,
  defaultCategories,
  isTransactionType,
  normalizeDefaultCategory,
  toNullableText,
  transactionTypeOptions,
} from "@/lib/transactionRules";
import type { TransactionType } from "@/types/transaction";

type ManualTransactionFormProps = {
  onCancel?: () => void;
  onSaved?: () => void;
};

export function ManualTransactionForm({ onCancel, onSaved }: ManualTransactionFormProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("其他");
  const [date, setDate] = useState(getLocalDateInputValue());
  const [merchant, setMerchant] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [note, setNote] = useState("");
  const [isOptionalOpen, setIsOptionalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedAmount = amount.trim();
    const parsedAmount = Number(trimmedAmount);
    const trimmedCategory = normalizeDefaultCategory(category);

    if (!isTransactionType(type)) {
      setErrorMessage("账单类型不正确。");
      return;
    }

    if (!trimmedAmount) {
      setErrorMessage("请输入金额。");
      return;
    }

    if (!Number.isFinite(parsedAmount)) {
      setErrorMessage("金额必须是有效数字。");
      return;
    }

    if (parsedAmount <= 0) {
      setErrorMessage("金额必须大于 0。");
      return;
    }

    if (!date) {
      setErrorMessage("请选择日期。");
      return;
    }

    if (!trimmedCategory) {
      setErrorMessage("请选择分类。");
      return;
    }

    setIsSubmitting(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setIsSubmitting(false);
      setErrorMessage(userError?.message ?? "请先登录后再记账。");
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: userData.user.id,
      type,
      amount: parsedAmount,
      currency: DEFAULT_CURRENCY,
      category: trimmedCategory,
      date,
      merchant: toNullableText(merchant),
      payment_method: toNullableText(paymentMethod),
      note: toNullableText(note),
      source: "manual",
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage("保存成功");
    setAmount("");
    setMerchant("");
    setPaymentMethod("");
    setNote("");
    onSaved?.();
  }

  return (
    <section className="manual-panel" aria-labelledby="manual-transaction-title">
      <div className="section-heading horizontal">
        <div>
          <p>手动记账</p>
          <h2 id="manual-transaction-title">新增一笔账单</h2>
        </div>
        {onCancel ? (
          <button className="small-icon-button" type="button" aria-label="收起手动记账" onClick={onCancel}>
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <form className="manual-form" onSubmit={handleSubmit}>
        <div className="manual-grid two-columns">
          <label className="manual-field">
            <span>类型</span>
            <select
              value={type}
              onChange={(event) => {
                const nextType = event.target.value;
                if (isTransactionType(nextType)) {
                  setType(nextType);
                }
              }}
            >
              {transactionTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="manual-field">
            <span>金额</span>
            <input
              inputMode="decimal"
              min="0"
              name="amount"
              placeholder="0.00"
              step="0.01"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
        </div>

        <div className="manual-grid two-columns">
          <label className="manual-field">
            <span>分类</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {defaultCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="manual-field">
            <span>日期</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>

        <div className="manual-optional-block">
          <button
            className="manual-optional-toggle"
            type="button"
            aria-expanded={isOptionalOpen}
            onClick={() => setIsOptionalOpen((current) => !current)}
          >
            {isOptionalOpen ? (
              <ChevronDown size={17} aria-hidden="true" />
            ) : (
              <Plus size={17} aria-hidden="true" />
            )}
            可选信息
          </button>

          {isOptionalOpen ? (
            <div className="manual-optional-fields">
              <label className="manual-field">
                <span>商家</span>
                <input
                  placeholder="例如：麦当劳"
                  type="text"
                  value={merchant}
                  onChange={(event) => setMerchant(event.target.value)}
                />
              </label>

              <label className="manual-field">
                <span>支付方式</span>
                <input
                  placeholder="例如：支付宝、微信、银行卡"
                  type="text"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                />
              </label>

              <label className="manual-field">
                <span>备注</span>
                <textarea
                  placeholder="可选"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>

        {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
        {successMessage ? <p className="form-message success">{successMessage}</p> : null}

        <button className="primary-button manual-submit" type="submit" disabled={isSubmitting}>
          <Save size={18} aria-hidden="true" />
          {isSubmitting ? "保存中" : "保存账单"}
        </button>
      </form>
    </section>
  );
}
