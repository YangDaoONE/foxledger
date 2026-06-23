"use client";

import { FormEvent, useState } from "react";
import { Save, X } from "lucide-react";
import { updateTransaction } from "@/lib/transactions";
import {
  defaultCategories,
  isTransactionType,
  normalizeDefaultCategory,
  toNullableText,
  transactionTypeOptions,
} from "@/lib/transactionRules";
import type { Transaction, TransactionType } from "@/types/transaction";

type EditTransactionFormProps = {
  transaction: Transaction;
  onCancel: () => void;
  onUpdated: () => void;
};

export function EditTransactionForm({
  transaction,
  onCancel,
  onUpdated,
}: EditTransactionFormProps) {
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(normalizeDefaultCategory(transaction.category));
  const [date, setDate] = useState(transaction.date);
  const [merchant, setMerchant] = useState(transaction.merchant ?? "");
  const [paymentMethod, setPaymentMethod] = useState(transaction.payment_method ?? "");
  const [note, setNote] = useState(transaction.note ?? "");
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

    try {
      await updateTransaction(transaction, {
        type,
        amount: parsedAmount,
        category: trimmedCategory,
        date,
        merchant: toNullableText(merchant),
        payment_method: toNullableText(paymentMethod),
        note: toNullableText(note),
      });

      setSuccessMessage("保存成功");
      setIsSubmitting(false);
      onUpdated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败。");
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setErrorMessage(null);
    setSuccessMessage(null);
    onCancel();
  }

  return (
    <form className="edit-form" onSubmit={handleSubmit}>
      <div className="section-heading horizontal">
        <div>
          <p>编辑账单</p>
          <h3>修改这一笔</h3>
        </div>
        <button className="text-button" type="button" onClick={handleCancel}>
          <X size={15} aria-hidden="true" />
          取消
        </button>
      </div>

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
            name="edit-amount"
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

      {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
      {successMessage ? <p className="form-message success">{successMessage}</p> : null}

      <button className="primary-button manual-submit" type="submit" disabled={isSubmitting}>
        <Save size={18} aria-hidden="true" />
        {isSubmitting ? "保存中" : "保存修改"}
      </button>
    </form>
  );
}
