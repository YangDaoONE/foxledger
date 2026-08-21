import { BookOpen } from "lucide-react";

import type { CachedLedger } from "@/features/ledgers/types";

type LedgerSelectFieldProps = {
  disabled?: boolean;
  label?: string;
  ledgers: CachedLedger[];
  onChange?: (ledgerId: string) => void;
  readOnly?: boolean;
  value: string;
};

export function LedgerSelectField({
  disabled = false,
  label = "记入账本",
  ledgers,
  onChange,
  readOnly = false,
  value,
}: LedgerSelectFieldProps) {
  const selectedLedger = ledgers.find((ledger) => ledger.id === value) ?? null;

  if (readOnly) {
    return (
      <div className="field ledger-readonly-field">
        <span>{label}</span>
        <div>
          <BookOpen aria-hidden="true" size={16} />
          <strong>{selectedLedger?.name ?? "账本已不存在"}</strong>
        </div>
      </div>
    );
  }

  return (
    <label className="field ledger-select-field">
      <span>{label}</span>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {ledgers.map((ledger) => (
          <option key={ledger.id} value={ledger.id}>
            {ledger.name}
          </option>
        ))}
      </select>
    </label>
  );
}
