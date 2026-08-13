import type { MouseEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  RotateCw,
  Trash2,
} from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import {
  canConfirmCandidateBatch,
  getCandidateIssues,
  summarizeCandidateBatch,
} from "@/features/chat/batchCalculations";
import type { ChatCandidateBatch } from "@/features/chat/chatTypes";
import { formatCurrency } from "@/lib/format";

type LedgerResultCardProps = {
  batch: ChatCandidateBatch;
  isOnline: boolean;
  messageId: string;
  onConfirm: (messageId: string) => void;
  onOpenCandidate: (
    messageId: string,
    candidateId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onRemoveCandidate: (messageId: string, candidateId: string) => void;
  onRetrySync: (messageId: string) => void;
};

export function LedgerResultCard({
  batch,
  isOnline,
  messageId,
  onConfirm,
  onOpenCandidate,
  onRemoveCandidate,
  onRetrySync,
}: LedgerResultCardProps) {
  const summary = summarizeCandidateBatch(batch.candidates);
  const canConfirm = canConfirmCandidateBatch(batch);
  const isEditable = batch.status === "draft" || batch.status === "needs_attention";
  const hasRemoteResult =
    batch.status === "saved" ||
    batch.status === "sync_warning" ||
    batch.status === "undoing" ||
    batch.status === "undone";
  const statusPresentation = getStatusPresentation(batch, canConfirm);

  return (
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

      {!hasRemoteResult ? <div className="ledger-summary-grid">
        <span>支出 <strong>{formatCurrency(summary.expense)}</strong></span>
        <span>收入 <strong>{formatCurrency(summary.income)}</strong></span>
        <span>转账 <strong>{summary.transferCount} 笔</strong></span>
      </div> : null}

      {batch.truncated ? (
        <p className="batch-warning" role="alert">
          输入中的账单较多，本次结果已按 50 条上限截断，请分段核对。
        </p>
      ) : null}

      {batch.candidates.length === 0 ? (
        <p className="batch-empty">候选已经全部移除，可以重新描述要记录的账单。</p>
      ) : isEditable || batch.status === "saving" || batch.status === "error" ? (
        <div className="ledger-candidate-list">
          {batch.candidates.map((candidate) => {
            const issues = getCandidateIssues(candidate);
            return (
              <div className="ledger-candidate-row" key={candidate.id}>
                <div>
                  <strong>{candidate.draft.category}</strong>
                  <span>
                    {candidate.draft.date || "日期待补充"} · {candidate.draft.type}
                  </span>
                </div>
                <strong>{candidate.draft.amount ? `¥${candidate.draft.amount}` : "金额待补充"}</strong>
                {isEditable ? <div className="ledger-candidate-actions">
                  <AppButton
                    aria-label={`查看或编辑 ${candidate.draft.category} 候选`}
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
                    aria-label={`移除 ${candidate.draft.category} 候选`}
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

      {batch.status === "sync_warning" ? (
        <p className="batch-readiness warning" role="alert">
          账单已经保存，但本地缓存暂时没有刷新成功。
          {batch.error ? ` ${batch.error}` : ""}
        </p>
      ) : batch.status === "saved" ? (
        <p className="batch-readiness ready">
          保存时共写入 {batch.transactionIds.length} 笔账单。当前正式状态请以下方最近 AI 批次为准。
        </p>
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

      {isEditable ? (
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
    </article>
  );
}

function getStatusPresentation(batch: ChatCandidateBatch, canConfirm: boolean) {
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
