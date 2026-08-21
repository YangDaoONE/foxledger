import { useEffect, useMemo, useState } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import { LedgerSelectField } from "@/features/ledgers/LedgerSelectField";
import type { CachedLedger } from "@/features/ledgers/types";
import type {
  CachedTransaction,
  TransactionType,
} from "@/features/transactions/types";
import {
  defaultCategories,
  transactionTypeOptions,
  validateTransactionDraft,
} from "@/features/transactions/transactionRules";
import { getTodayLocalIsoDate } from "@/lib/date";
import { getErrorMessage } from "@/lib/errors";

export type TransactionFormValues = {
  amount: string;
  category: string;
  date: string;
  ledger_id: string;
  merchant: string;
  note: string;
  payment_method: string;
  type: TransactionType;
};

type TransactionFormProps = {
  defaultLedgerId: string;
  initialTransaction?: CachedTransaction | null;
  isSubmitting: boolean;
  ledgerReadOnly?: boolean;
  ledgers: CachedLedger[];
  onCancel?: () => void;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  submitLabel: string;
};

export function TransactionForm({
  defaultLedgerId,
  initialTransaction,
  isSubmitting,
  ledgerReadOnly = false,
  ledgers,
  onCancel,
  onSubmit,
  submitLabel,
}: TransactionFormProps) {
  const initialValues = useMemo<TransactionFormValues>(
    () => ({
      amount: initialTransaction ? String(initialTransaction.amount) : "",
      category: initialTransaction?.category ?? "餐饮",
      date: initialTransaction?.date ?? getTodayLocalIsoDate(),
      ledger_id: initialTransaction?.ledger_id ?? defaultLedgerId,
      merchant: initialTransaction?.merchant ?? "",
      note: initialTransaction?.note ?? "",
      payment_method: initialTransaction?.payment_method ?? "",
      type: initialTransaction?.type ?? "expense",
    }),
    [defaultLedgerId, initialTransaction],
  );
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues);
    setError(null);
  }, [initialValues]);

  function updateValue<Key extends keyof TransactionFormValues>(
    key: Key,
    value: TransactionFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const messages = validateTransactionDraft(values);

    if (!ledgers.some((ledger) => ledger.id === values.ledger_id)) {
      messages.push("请选择有效账本。");
    }

    if (messages.length > 0) {
      setError(messages.join(" "));
      return;
    }

    setError(null);

    try {
      await onSubmit(values);
      if (!initialTransaction) {
        setValues({
          ...initialValues,
          amount: "",
          merchant: "",
          note: "",
          payment_method: "",
        });
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError, "保存失败。"));
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <LedgerSelectField
        disabled={isSubmitting}
        ledgers={ledgers}
        readOnly={ledgerReadOnly}
        value={values.ledger_id}
        onChange={(ledgerId) => updateValue("ledger_id", ledgerId)}
      />

      <div className="chip-row" aria-label="账单类型">
        {transactionTypeOptions.map((option) => (
          <Chip
            active={values.type === option.value}
            key={option.value}
            onClick={() => updateValue("type", option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      <div className="form-grid two">
        <TextField
          inputMode="decimal"
          label="金额"
          onChange={(value) => updateValue("amount", value)}
          placeholder="0.00"
          value={values.amount}
        />
        <label className="field">
          <span>分类</span>
          <select
            value={values.category}
            onChange={(event) => updateValue("category", event.target.value)}
          >
            {defaultCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TextField
        label="日期"
        onChange={(value) => updateValue("date", value)}
        type="date"
        value={values.date}
      />

      <details className="optional-fields">
        <summary>可选信息</summary>
        <TextField
          label="商家"
          onChange={(value) => updateValue("merchant", value)}
          placeholder="例如 星巴克"
          value={values.merchant}
        />
        <TextField
          label="支付方式"
          onChange={(value) => updateValue("payment_method", value)}
          placeholder="例如 支付宝"
          value={values.payment_method}
        />
        <TextField
          label="备注"
          onChange={(value) => updateValue("note", value)}
          placeholder="补充说明"
          value={values.note}
        />
      </details>

      {error ? <p className="form-message danger">{error}</p> : null}

      <div className="form-actions">
        {onCancel ? (
          <AppButton type="button" variant="secondary" onClick={onCancel}>
            取消
          </AppButton>
        ) : null}
        <AppButton disabled={isSubmitting} type="submit">
          {isSubmitting ? "保存中..." : submitLabel}
        </AppButton>
      </div>
    </form>
  );
}
