import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, Check, Pencil, Plus, Trash2 } from "lucide-react";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { ConfirmActionDialog } from "@/features/chat/ConfirmActionDialog";
import {
  createLedger,
  deleteEmptyLedger,
  renameLedger,
} from "@/features/ledgers/ledgerApi";
import { useLedgerState } from "@/features/ledgers/LedgerProvider";
import { listCachedLedgerSummaries } from "@/features/ledgers/localLedgers";
import {
  MAX_LEDGER_COUNT,
  MAX_LEDGER_NAME_LENGTH,
} from "@/features/ledgers/types";
import { useSyncState } from "@/features/sync/SyncProvider";
import { getErrorMessage } from "@/lib/errors";

type LedgerAction =
  | { kind: "delete"; ledgerId: string; name: string }
  | { kind: "rename"; ledgerId: string }
  | null;

export function LedgerManagement() {
  const user = useAuthUser();
  const { activeLedgerId, ledgers } = useLedgerState();
  const { isOnline, refreshAfterWrite } = useSyncState();
  const [newName, setNewName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [action, setAction] = useState<LedgerAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const summariesQuery = useQuery({
    queryFn: () => listCachedLedgerSummaries(user.id),
    queryKey: queryKeys.ledgerSummaries(user.id),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await createLedger(user.id, newName);
      await refreshAfterWrite();
    },
    onError: (error) =>
      setMessage(getErrorMessage(error, "新建账本失败。")),
    onSuccess: () => {
      setMessage("账本已创建。");
      setNewName("");
    },
  });
  const renameMutation = useMutation({
    mutationFn: async (params: { ledgerId: string; name: string }) => {
      await renameLedger(user.id, params.ledgerId, params.name);
      await refreshAfterWrite();
    },
    onError: (error) =>
      setMessage(getErrorMessage(error, "重命名账本失败。")),
    onSuccess: () => {
      setAction(null);
      setRenameName("");
      setMessage("账本已重命名。");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (ledgerId: string) => {
      await deleteEmptyLedger(user.id, ledgerId);
      await refreshAfterWrite();
    },
    onError: (error) => {
      setAction(null);
      setMessage(getErrorMessage(error, "删除账本失败。"));
    },
    onSuccess: () => {
      setAction(null);
      setMessage("空账本已删除。");
    },
  });
  const isBusy =
    createMutation.isPending ||
    renameMutation.isPending ||
    deleteMutation.isPending;
  const summaries = summariesQuery.data ?? [];

  return (
    <SectionBlock
      className="ledger-management"
      description="不同用途分开记录；已有账单的账本不会被直接删除。"
      eyebrow="账本"
      title="管理账本"
    >
      <form
        className="ledger-create-row"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          createMutation.mutate();
        }}
      >
        <label className="field">
          <span>新账本名称</span>
          <input
            disabled={!isOnline || isBusy || ledgers.length >= MAX_LEDGER_COUNT}
            maxLength={MAX_LEDGER_NAME_LENGTH}
            placeholder="例如 旅行账本"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <AppButton
          disabled={
            !isOnline ||
            isBusy ||
            !newName.trim() ||
            ledgers.length >= MAX_LEDGER_COUNT
          }
          icon={<Plus size={16} />}
          type="submit"
        >
          新建账本
        </AppButton>
      </form>

      {!isOnline ? (
        <p className="form-message">离线时可以切换缓存账本，但不能管理账本。</p>
      ) : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}

      <div className="ledger-management-list">
        {summaries.map((ledger) => {
          const isActive = ledger.id === activeLedgerId;
          const isRenaming =
            action?.kind === "rename" && action.ledgerId === ledger.id;

          return (
            <article className="ledger-management-row" key={ledger.id}>
              <span className="ledger-management-icon" aria-hidden="true">
                <BookOpen size={18} />
              </span>
              <div className="ledger-management-copy">
                <strong>{ledger.name}</strong>
                <span>{ledger.transactionCount} 笔账单</span>
              </div>
              {isActive ? (
                <span className="ledger-current-badge">
                  <Check aria-hidden="true" size={13} />
                  当前使用
                </span>
              ) : null}

              {isRenaming ? (
                <form
                  className="ledger-rename-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setMessage(null);
                    renameMutation.mutate({
                      ledgerId: ledger.id,
                      name: renameName,
                    });
                  }}
                >
                  <label className="sr-only" htmlFor={`ledger-name-${ledger.id}`}>
                    新账本名称
                  </label>
                  <input
                    autoFocus
                    disabled={isBusy}
                    id={`ledger-name-${ledger.id}`}
                    maxLength={MAX_LEDGER_NAME_LENGTH}
                    value={renameName}
                    onChange={(event) => setRenameName(event.target.value)}
                  />
                  <AppButton disabled={isBusy || !renameName.trim()} type="submit">
                    保存
                  </AppButton>
                  <AppButton
                    disabled={isBusy}
                    type="button"
                    variant="secondary"
                    onClick={() => setAction(null)}
                  >
                    取消
                  </AppButton>
                </form>
              ) : (
                <div className="ledger-management-actions">
                  <AppButton
                    disabled={!isOnline || isBusy}
                    icon={<Pencil size={15} />}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setRenameName(ledger.name);
                      setAction({
                        kind: "rename",
                        ledgerId: ledger.id,
                      });
                    }}
                  >
                    重命名
                  </AppButton>
                  <AppButton
                    disabled={
                      !isOnline ||
                      isBusy ||
                      ledgers.length <= 1 ||
                      ledger.transactionCount > 0
                    }
                    icon={<Trash2 size={15} />}
                    title={
                      ledger.transactionCount > 0
                        ? "这个账本还有账单，不能直接删除。"
                        : ledgers.length <= 1
                          ? "最后一个账本不能删除。"
                          : "删除空账本"
                    }
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setAction({
                        kind: "delete",
                        ledgerId: ledger.id,
                        name: ledger.name,
                      })
                    }
                  >
                    删除
                  </AppButton>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {action?.kind === "delete" ? (
        <ConfirmActionDialog
          description={`“${action.name}”为空账本。删除后无法恢复账本名称。`}
          isBusy={deleteMutation.isPending}
          title="删除这个空账本？"
          onCancel={() => setAction(null)}
          onConfirm={() => deleteMutation.mutate(action.ledgerId)}
        />
      ) : null}
    </SectionBlock>
  );
}
