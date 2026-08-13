import { AppButton } from "@/components/ui/AppButton";
import { useModalDialog } from "@/features/chat/useModalDialog";

type ConfirmActionDialogProps = {
  description: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
};

export function ConfirmActionDialog({
  description,
  isBusy,
  onCancel,
  onConfirm,
  title,
}: ConfirmActionDialogProps) {
  const { dialogRef, initialFocusRef } = useModalDialog({
    closeDisabled: isBusy,
    onClose: onCancel,
  });

  return (
    <div
      className="confirm-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onCancel();
        }
      }}
    >
      <section
        aria-describedby="recent-confirm-description"
        aria-labelledby="recent-confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="recent-confirm-title">{title}</h2>
        <p id="recent-confirm-description">{description}</p>
        <div className="form-actions">
          <AppButton
            disabled={isBusy}
            ref={initialFocusRef}
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            取消
          </AppButton>
          <AppButton
            disabled={isBusy}
            type="button"
            variant="danger"
            onClick={onConfirm}
          >
            {isBusy ? "处理中..." : "确认"}
          </AppButton>
        </div>
      </section>
    </div>
  );
}
