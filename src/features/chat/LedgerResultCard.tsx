import { type MouseEvent, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  RotateCw,
  Trash2,
} from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { queryKeys } from "@/app/queryKeys";
import {
  canConfirmCandidateBatch,
  getCandidateIssues,
  summarizeCandidateBatch,
} from "@/features/chat/batchCalculations";
import { ChatResultDisclosure } from "@/features/chat/ChatResultDisclosure";
import type { ChatCandidateBatch } from "@/features/chat/chatTypes";
import { getRecentAiBatch } from "@/features/chat/recentAiBatches";
import { LedgerSelectField } from "@/features/ledgers/LedgerSelectField";
import type { CachedLedger } from "@/features/ledgers/types";
import { getTransactionTypeLabel } from "@/features/transactions/transactionRules";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

type LedgerResultCardProps = {
  batch: ChatCandidateBatch;
  hasStaleBatchCache: boolean;
  isBatchCacheSyncing: boolean;
  isOnline: boolean;
  ledgers: CachedLedger[];
  messageId: string;
  onConfirm: (messageId: string) => void;
  onOpenCandidate: (
    messageId: string,
    candidateId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onOpenSavedBatch: (
    batchId: string,
    ledgerId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onRemoveCandidate: (messageId: string, candidateId: string) => void;
  onRetrySync: (messageId: string) => void;
  onUpdateLedger: (messageId: string, ledgerId: string) => void;
  userId: string;
};

export function LedgerResultCard({
  batch,
  hasStaleBatchCache,
  isBatchCacheSyncing,
  isOnline,
  ledgers,
  messageId,
  onConfirm,
  onOpenCandidate,
  onOpenSavedBatch,
  onRemoveCandidate,
  onRetrySync,
  onUpdateLedger,
  userId,
}: LedgerResultCardProps) {
  const summary = summarizeCandidateBatch(batch.candidates);
  const targetLedger = ledgers.find((ledger) => ledger.id === batch.ledgerId) ?? null;
  const canConfirm = canConfirmCandidateBatch(batch) && targetLedger !== null;
  const isEditable = batch.status === "draft" || batch.status === "needs_attention";
  const isEmptyDraft = isEditable && batch.candidates.length === 0;
  const hasRemoteResult =
    batch.status === "saved" ||
    batch.status === "sync_warning" ||
    batch.status === "undoing" ||
    batch.status === "undone";
  const statusPresentation = getStatusPresentation(batch, canConfirm);
  const savedBatchId = batch.saveRequest?.batchId ?? "";
  const shouldReadSavedBatch = batch.status === "saved" && Boolean(savedBatchId);
  const savedBatchQuery = useQuery({
    enabled: shouldReadSavedBatch,
    queryFn: () => getRecentAiBatch(userId, batch.ledgerId, savedBatchId),
    queryKey: queryKeys.recentAiBatch(userId, batch.ledgerId, savedBatchId),
  });
  const savedBatch = savedBatchQuery.data ?? null;
  const canShowSavedDisclosure =
    batch.status === "saved" &&
    savedBatch !== null &&
    !hasStaleBatchCache;
  const previousStatusRef = useRef(batch.status);
  const pendingSavedRevealRef = useRef(false);
  const hasPresentedSavedRef = useRef(false);
  const [autoCollapseSignal, setAutoCollapseSignal] = useState(0);

  useLayoutEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = batch.status;

    if (
      batch.status === "saved" &&
      previousStatus !== "saved" &&
      (!hasPresentedSavedRef.current || previousStatus === "sync_warning")
    ) {
      pendingSavedRevealRef.current = true;
    }

    if (canShowSavedDisclosure && pendingSavedRevealRef.current) {
      pendingSavedRevealRef.current = false;
      hasPresentedSavedRef.current = true;
      setAutoCollapseSignal((current) => current + 1);
    }
  }, [batch.status, canShowSavedDisclosure]);

  const card = (
    <article className="ledger-result-card">
      <header className="ledger-result-heading">
        <div>
          <span>{hasRemoteResult ? "本次记账" : "狐狐识别到"}</span>
          <strong>
            {hasRemoteResult
              ? batch.status === "undone"
                ? "整批已撤销"
                : batch.status === "undoing"
                  ? "正在撤销"
                : "账单已保存"
              : `${summary.transactionCount} 笔候选`}
          </strong>
        </div>
        <span className={`batch-status ${statusPresentation.tone}`}>
          {statusPresentation.icon}
          {statusPresentation.label}
        </span>
      </header>

      {!hasRemoteResult && !isEmptyDraft ? (
        <LedgerSelectField
          disabled={!isEditable}
          ledgers={ledgers}
          readOnly={!isEditable}
          value={batch.ledgerId}
          onChange={(ledgerId) => onUpdateLedger(messageId, ledgerId)}
        />
      ) : null}

      {!targetLedger && !isEmptyDraft ? (
        <p className="batch-warning" role="alert">
          目标账本已不存在，请重新选择账本后再确认。
        </p>
      ) : null}

      {!hasRemoteResult ? (
        <div className="ledger-summary-grid">
          <span>支出 <strong>{formatCurrency(summary.expense)}</strong></span>
          <span>收入 <strong>{formatCurrency(summary.income)}</strong></span>
          <span>转账 <strong>{summary.transferCount} 笔</strong></span>
        </div>
      ) : batch.status === "saved" && savedBatch ? (
        <div className="ledger-summary-grid">
          <span>账单 <strong>{savedBatch.transactionCount} 笔</strong></span>
          <span>支出 <strong>{formatCurrency(savedBatch.expense)}</strong></span>
          <span>收入 <strong>{formatCurrency(savedBatch.income)}</strong></span>
        </div>
      ) : null}

      {batch.truncated && !isEmptyDraft ? (
        <p className="batch-warning" role="alert">
          输入中的账单较多，本次结果已按 50 条上限截断，请分段核对。
        </p>
      ) : null}

      {batch.candidates.length === 0 ? (
        <p className="batch-empty">
          这次候选已全部移除，不会写入账本。想继续记账，可以重新告诉狐狐。
        </p>
      ) : isEditable || batch.status === "saving" || batch.status === "error" ? (
        <div className="ledger-candidate-list">
          {batch.candidates.map((candidate) => {
            const issues = getCandidateIssues(candidate);
            const merchant = candidate.draft.merchant.trim();
            const displayName = merchant || candidate.draft.category;
            const metadata = [
              merchant ? candidate.draft.category : null,
              getTransactionTypeLabel(candidate.draft.type),
              candidate.draft.date || "日期待补充",
            ].filter((value): value is string => Boolean(value));
            return (
              <div className="ledger-candidate-row" key={candidate.id}>
                <div>
                  <strong>{displayName}</strong>
                  <span>{metadata.join(" · ")}</span>
                </div>
                <strong>{candidate.draft.amount ? `¥${candidate.draft.amount}` : "金额待补充"}</strong>
                {isEditable ? <div className="ledger-candidate-actions">
                  <AppButton
                    aria-label={`查看或编辑 ${displayName} 候选`}
                    className={issues.length > 0 ? "needs-attention" : ""}
                    icon={<Pencil size={15} />}
                    type="button"
                    variant="ghost"
                    onClick={(event: MouseEvent<HTMLButtonElement>) =>
                      onOpenCandidate(messageId, candidate.id, event.currentTarget)
                    }
                  >
                    {issues.length > 0 ? "去核对" : "详情"}
                  </AppButton>
                  <AppButton
                    aria-label={`移除 ${displayName} 候选`}
                    icon={<Trash2 size={15} />}
                    type="button"
                    variant="ghost"
                    onClick={() => onRemoveCandidate(messageId, candidate.id)}
                  >
                    移除
                  </AppButton>
                </div> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {isEmptyDraft ? (
        <p className="batch-readiness muted">这次没有要记录的账单，无需核对。</p>
      ) : batch.status === "sync_warning" ? (
        <p className="batch-readiness warning" role="alert">
          账单已经保存，但本地缓存暂时没有刷新成功。
          {batch.error ? ` ${batch.error}` : ""}
        </p>
      ) : batch.status === "saved" ? (
        hasStaleBatchCache ? (
          <p className="batch-readiness warning">
            正式账单操作已完成，本地缓存待同步；同步完成后可以继续管理。
          </p>
        ) : isBatchCacheSyncing || savedBatchQuery.isPending ? (
          <p className="batch-readiness muted">账单已保存，正在同步正式详情…</p>
        ) : savedBatchQuery.error ? (
          <p className="batch-readiness warning" role="alert">
            {getErrorMessage(savedBatchQuery.error, "正式详情读取失败，请重新同步。")}
          </p>
        ) : savedBatch ? (
          <p className="batch-readiness ready">
            已经记好了，共 {savedBatch.transactionCount} 笔。
          </p>
        ) : (
          <p className="batch-readiness warning">
            账单已保存，但本地缓存中暂时没有这批正式账单。
          </p>
        )
      ) : batch.status === "undone" ? (
        <p className="batch-readiness muted">这一批账单已撤销。</p>
      ) : batch.status === "undoing" ? (
        <p className="batch-readiness muted">正在撤销这一批正式账单…</p>
      ) : batch.status === "error" ? (
        <p className="batch-readiness danger" role="alert">
          {batch.error ?? "保存没有完成。"}
        </p>
      ) : (
        <p className={`batch-readiness ${canConfirm ? "ready" : "attention"}`}>
          {canConfirm
            ? "候选已核对，确认后才会写入账本。"
            : "存在未补全或未核对候选，整批确认保持阻断。"}
        </p>
      )}

      {isEditable && !isEmptyDraft ? (
        <AppButton
          disabled={!isOnline || !canConfirm}
          type="button"
          onClick={() => onConfirm(messageId)}
        >
          确认记账
        </AppButton>
      ) : batch.status === "saving" ? (
        <AppButton disabled type="button" icon={<LoaderCircle size={16} />}>
          正在保存
        </AppButton>
      ) : batch.status === "sync_warning" ? (
        <AppButton
          disabled={!isOnline}
          icon={<RotateCw size={16} />}
          type="button"
          onClick={() => onRetrySync(messageId)}
        >
          重新同步
        </AppButton>
      ) : batch.status === "error" && batch.canRetrySave ? (
        <AppButton
          disabled={!isOnline}
          icon={<RotateCw size={16} />}
          type="button"
          onClick={() => onConfirm(messageId)}
        >
          使用原账单 ID 重试
        </AppButton>
      ) : batch.status === "error" ? (
        <AppButton
          disabled={!isOnline}
          icon={<RotateCw size={16} />}
          type="button"
          variant="secondary"
          onClick={() => onRetrySync(messageId)}
        >
          重新同步并核对
        </AppButton>
      ) : null}

      {batch.status === "saved" && savedBatch ? (
        <AppButton
          disabled={isBatchCacheSyncing || hasStaleBatchCache}
          type="button"
          variant="secondary"
          onClick={(event: MouseEvent<HTMLButtonElement>) =>
            onOpenSavedBatch(
              savedBatch.batchId,
              batch.ledgerId,
              event.currentTarget,
            )
          }
        >
          详情
        </AppButton>
      ) : batch.status === "saved" &&
        !isBatchCacheSyncing &&
        !hasStaleBatchCache &&
        !savedBatchQuery.isPending ? (
        <AppButton
          disabled={!isOnline}
          icon={<RotateCw size={16} />}
          type="button"
          variant="secondary"
          onClick={() => onRetrySync(messageId)}
        >
          重新同步
        </AppButton>
      ) : null}
    </article>
  );

  if (batch.status === "undone") {
    return (
      <ChatResultDisclosure
        className="saved-ledger-disclosure undone"
        compactContent={
          <>
            <span className="chat-result-disclosure-icon" aria-hidden="true">
              <CheckCircle2 size={17} strokeWidth={2.3} />
            </span>
            <span className="chat-result-disclosure-summary">这次记录已撤销</span>
          </>
        }
        label="本次已撤销的记账结果"
      />
    );
  }

  if (canShowSavedDisclosure) {
    const compactSummary = getSavedBatchCompactSummary(savedBatch);

    return (
      <ChatResultDisclosure
        autoCollapseSignal={autoCollapseSignal || null}
        className="saved-ledger-disclosure"
        compactContent={
          <>
            <span className="chat-result-disclosure-icon" aria-hidden="true">
              <CheckCircle2 size={17} strokeWidth={2.3} />
            </span>
            <span className="chat-result-disclosure-text">
              <span className="chat-result-disclosure-summary">{compactSummary}</span>
              <span className="ledger-badge">{targetLedger?.name ?? "原账本"}</span>
            </span>
          </>
        }
        label={`本次记账结果：${compactSummary}`}
      >
        {card}
      </ChatResultDisclosure>
    );
  }

  return card;
}

function getSavedBatchCompactSummary(savedBatch: {
  expense: number;
  income: number;
  transactionCount: number;
}) {
  const parts = [`已记录 ${savedBatch.transactionCount} 笔`];

  if (savedBatch.expense > 0) {
    parts.push(`支出 ${formatCurrency(savedBatch.expense)}`);
  }

  if (savedBatch.income > 0) {
    parts.push(`收入 ${formatCurrency(savedBatch.income)}`);
  }

  return parts.join(" · ");
}

function getStatusPresentation(batch: ChatCandidateBatch, canConfirm: boolean) {
  if (
    batch.candidates.length === 0 &&
    (batch.status === "draft" || batch.status === "needs_attention")
  ) {
    return { icon: <CheckCircle2 size={15} />, label: "已全部移除", tone: "muted" };
  }

  if (batch.status === "saving") {
    return {
      icon: <LoaderCircle className="spin" size={15} />,
      label: "保存中",
      tone: "pending",
    };
  }

  if (batch.status === "saved") {
    return { icon: <CheckCircle2 size={15} />, label: "已保存", tone: "ready" };
  }

  if (batch.status === "sync_warning") {
    return { icon: <AlertCircle size={15} />, label: "已保存 · 待同步", tone: "attention" };
  }

  if (batch.status === "undone") {
    return { icon: <CheckCircle2 size={15} />, label: "已撤销", tone: "muted" };
  }

  if (batch.status === "undoing") {
    return {
      icon: <LoaderCircle className="spin" size={15} />,
      label: "撤销中",
      tone: "pending",
    };
  }

  if (batch.status === "error") {
    return { icon: <AlertCircle size={15} />, label: "保存未完成", tone: "danger" };
  }

  return canConfirm
    ? { icon: <CheckCircle2 size={15} />, label: "可以确认", tone: "ready" }
    : { icon: <AlertCircle size={15} />, label: "需要核对", tone: "attention" };
}
