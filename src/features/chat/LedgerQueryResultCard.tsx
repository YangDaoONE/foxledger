import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ListFilter } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import type { FoxChatQueryClientResult } from "@/features/chat/foxChatApi";
import { createLedgerQueryNavigation } from "@/features/chat/ledgerQueryNavigation";
import { getTransactionTypeLabel } from "@/features/transactions/transactionRules";
import { formatCurrency } from "@/lib/format";
import type { LedgerQueryOperation } from "@shared/ledgerContracts";

const EVIDENCE_PAGE_SIZE = 50;

function getFilterLabels(operation: LedgerQueryOperation) {
  const labels: string[] = [];

  if (operation.filters.types.length > 0) {
    labels.push(operation.filters.types.map(getTransactionTypeLabel).join("、"));
  }

  if (operation.filters.categories.length > 0) {
    labels.push(`分类：${operation.filters.categories.join("、")}`);
  }

  if (operation.filters.merchants.length > 0) {
    labels.push(`商家：${operation.filters.merchants.join("、")}`);
  }

  if (operation.filters.keyword) {
    labels.push(`关键词：${operation.filters.keyword}`);
  }

  if (operation.filters.minAmount !== null) {
    labels.push(`最低 ${formatCurrency(operation.filters.minAmount)}`);
  }

  if (operation.filters.maxAmount !== null) {
    labels.push(`最高 ${formatCurrency(operation.filters.maxAmount)}`);
  }

  return labels.length > 0 ? labels : ["全部账单类型与分类"];
}

type LedgerQueryResultCardProps = {
  onOpenTransactions: (operationIndex: number) => void;
  result: FoxChatQueryClientResult;
};

export function LedgerQueryResultCard({
  onOpenTransactions,
  result,
}: LedgerQueryResultCardProps) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [visibleEvidenceCount, setVisibleEvidenceCount] = useState(
    EVIDENCE_PAGE_SIZE,
  );
  const citedEvidence = useMemo(
    () => new Set(result.answer?.evidenceRefs ?? []),
    [result.answer?.evidenceRefs],
  );
  const totalAiDetails = result.operations.reduce(
    (total, operation) => total + operation.aiDetailCount,
    0,
  );
  const totalMatches = result.operations.reduce(
    (total, operation) => total + operation.matchedTransactionCount,
    0,
  );
  const isAnyTruncated = result.operations.some(
    (operation) => operation.aiDetailsTruncated,
  );

  return (
    <article className="ledger-query-card">
      <header className="ledger-query-heading">
        <div>
          <span>狐狐查到账了</span>
          <strong>账本回答</strong>
        </div>
        <span className="batch-status ready">统计完成</span>
      </header>

      {result.answer ? (
        <div className="ledger-query-answer" aria-live="polite">
          <p>{result.answer.text}</p>
          {result.answer.suggestion ? <small>{result.answer.suggestion}</small> : null}
        </div>
      ) : (
        <p className="batch-warning" role="status">
          {result.answer_error ?? "统计已完成，但自然语言解释暂不可用。"}
        </p>
      )}

      <div className="ledger-query-operations">
        {result.operations.map((operation, index) => {
          const planOperation = result.plan.operations[index];
          const navigation = createLedgerQueryNavigation(planOperation);

          return (
            <section className="ledger-query-operation" key={`${planOperation.range.startDate}-${index}`}>
              <div className="ledger-query-range">
                <strong>{planOperation.range.label}</strong>
                <span>
                  {planOperation.range.startDate} 至 {planOperation.range.endDate}
                </span>
              </div>
              <p className="ledger-query-filters">
                <ListFilter aria-hidden="true" size={14} />
                {getFilterLabels(planOperation).join(" · ")}
              </p>

              <div className="ledger-summary-grid ledger-query-summary">
                <span>
                  支出
                  <strong>{formatCurrency(operation.stats.summary.expense)}</strong>
                </span>
                <span>
                  收入
                  <strong>{formatCurrency(operation.stats.summary.income)}</strong>
                </span>
                <span>
                  结余
                  <strong>{formatCurrency(operation.stats.summary.balance)}</strong>
                </span>
                <span>
                  账单数
                  <strong>{operation.stats.transactionCount} 笔</strong>
                </span>
                <span>
                  日均支出
                  <strong>{formatCurrency(operation.stats.averageDailyExpense)}</strong>
                </span>
                <span>
                  最大支出
                  <strong>{formatCurrency(operation.stats.maxExpenseAmount)}</strong>
                </span>
              </div>

              {operation.compareStats ? (
                <p className="ledger-query-compare">
                  比较范围：{operation.compareStats.range.label}（
                  {operation.compareStats.range.startDate} 至 {operation.compareStats.range.endDate}）
                </p>
              ) : null}

              <AppButton
                icon={<BookOpen size={16} />}
                type="button"
                variant="secondary"
                onClick={() => onOpenTransactions(index)}
              >
                {navigation.isPartial ? "按可用条件打开账单" : "打开匹配账单"}
              </AppButton>
            </section>
          );
        })}
      </div>

      <div className="ledger-evidence-summary">
        <p>
          正式统计覆盖 {totalMatches} 条匹配数据；AI 参考 {totalAiDetails} 条五字段明细
          {isAnyTruncated ? "（已按确定性规则选取，未影响统计）" : ""}。
        </p>
        <AppButton
          aria-expanded={isEvidenceOpen}
          icon={isEvidenceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          type="button"
          variant="ghost"
          onClick={() => setIsEvidenceOpen((value) => !value)}
        >
          {isEvidenceOpen ? "收起依据" : "查看依据"}
        </AppButton>
      </div>

      {isEvidenceOpen ? (
        <div className="ledger-evidence-list">
          {result.operations.flatMap((operation, operationIndex) =>
            operation.aiDetails
              .slice(0, visibleEvidenceCount)
              .map((detail, detailIndex) => {
                const ref = `operations.${operationIndex}.aiDetails.${detailIndex}`;

                return (
                  <div className="ledger-evidence-row" key={ref}>
                    <div>
                      <strong>{detail.merchant ?? detail.category}</strong>
                      <span>
                        {detail.date} · {getTransactionTypeLabel(detail.type)} · {detail.category}
                      </span>
                    </div>
                    <div>
                      <strong>{formatCurrency(detail.amount)}</strong>
                      {citedEvidence.has(ref) ? <small>回答引用</small> : null}
                    </div>
                  </div>
                );
              }),
          )}
          {result.operations.some(
            (operation) => operation.aiDetails.length > visibleEvidenceCount,
          ) ? (
            <AppButton
              type="button"
              variant="secondary"
              onClick={() =>
                setVisibleEvidenceCount((count) => count + EVIDENCE_PAGE_SIZE)
              }
            >
              继续显示依据
            </AppButton>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
