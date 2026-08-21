import { useState } from "react";
import { BookOpen, Check, ChevronDown, X } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { useModalDialog } from "@/features/chat/useModalDialog";
import { useLedgerState } from "@/features/ledgers/LedgerProvider";

export function LedgerSwitcher() {
  const { activeLedger, ledgers, setActiveLedgerId } = useLedgerState();
  const [isOpen, setIsOpen] = useState(false);

  if (!activeLedger) {
    return null;
  }

  return (
    <div className="ledger-switcher">
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`切换当前账本，当前为${activeLedger.name}`}
        className="ledger-switcher-trigger"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <BookOpen aria-hidden="true" size={16} strokeWidth={2.2} />
        <span>{activeLedger.name}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>

      {isOpen ? (
        <LedgerSwitcherDialog
          activeLedgerId={activeLedger.id}
          ledgers={ledgers}
          onClose={() => setIsOpen(false)}
          onSelect={(ledgerId) => {
            setActiveLedgerId(ledgerId);
            setIsOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

type LedgerSwitcherDialogProps = {
  activeLedgerId: string;
  ledgers: ReturnType<typeof useLedgerState>["ledgers"];
  onClose: () => void;
  onSelect: (ledgerId: string) => void;
};

function LedgerSwitcherDialog({
  activeLedgerId,
  ledgers,
  onClose,
  onSelect,
}: LedgerSwitcherDialogProps) {
  const { dialogRef, initialFocusRef } = useModalDialog({ onClose });

  return (
    <div
      className="ledger-switcher-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="ledger-switcher-title"
        aria-modal="true"
        className="ledger-switcher-sheet"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <span>浏览范围</span>
            <h2 id="ledger-switcher-title">切换当前账本</h2>
          </div>
          <AppButton
            aria-label="关闭账本切换"
            icon={<X size={17} />}
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            关闭
          </AppButton>
        </header>

        <div className="ledger-switcher-list">
          {ledgers.map((ledger) => {
            const isActive = ledger.id === activeLedgerId;

            return (
              <button
                aria-pressed={isActive}
                className={isActive ? "is-active" : ""}
                key={ledger.id}
                ref={isActive ? initialFocusRef : undefined}
                type="button"
                onClick={() => onSelect(ledger.id)}
              >
                <span className="ledger-switcher-book" aria-hidden="true">
                  <BookOpen size={17} />
                </span>
                <span>{ledger.name}</span>
                {isActive ? <Check aria-hidden="true" size={17} /> : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
