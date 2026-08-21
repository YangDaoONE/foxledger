import { X } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import {
  TransactionForm,
  type TransactionFormValues,
} from "@/features/transactions/TransactionForm";
import type { CachedTransaction } from "@/features/transactions/types";
import { useModalDialog } from "@/features/chat/useModalDialog";
import { useLedgerState } from "@/features/ledgers/LedgerProvider";

type SavedTransactionEditorProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  transaction: CachedTransaction;
};

export function SavedTransactionEditor({
  isSubmitting,
  onClose,
  onSubmit,
  transaction,
}: SavedTransactionEditorProps) {
  const { ledgers } = useLedgerState();
  const { dialogRef, initialFocusRef } = useModalDialog({
    closeDisabled: isSubmitting,
    onClose,
  });

  return (
    <div
      className="batch-sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="saved-transaction-editor-title"
        aria-modal="true"
        className="batch-sheet"
        ref={dialogRef}
        role="dialog"
      >
        <header className="batch-sheet-header">
          <div>
            <span>正式账单</span>
            <h2 id="saved-transaction-editor-title">修改这笔账单</h2>
          </div>
          <AppButton
            aria-label="关闭正式账单编辑"
            disabled={isSubmitting}
            icon={<X size={17} />}
            ref={initialFocusRef}
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            关闭
          </AppButton>
        </header>

        <TransactionForm
          defaultLedgerId={transaction.ledger_id}
          initialTransaction={transaction}
          isSubmitting={isSubmitting}
          ledgerReadOnly
          ledgers={ledgers}
          onCancel={isSubmitting ? undefined : onClose}
          onSubmit={onSubmit}
          submitLabel="保存修改"
        />
      </section>
    </div>
  );
}
