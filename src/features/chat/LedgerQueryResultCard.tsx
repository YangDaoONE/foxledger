import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ListFilter } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { ChatResultDisclosure } from "@/features/chat/ChatResultDisclosure";
import type { FoxChatQueryClientResult } from "@/features/chat/foxChatApi";
import { createLedgerQueryNavigation } from "@/features/chat/ledgerQueryNavigation";
import { getTransactionTypeLabel } from "@/features/transactions/transactionRules";
import { formatCurrency } from "@/lib/format";
import type {
  LedgerMetric,
  LedgerQueryOperation,
} from "@shared/ledgerContracts";
import type { LedgerQueryOperationResult } from "@shared/ledgerRead";

const EVIDENCE_PAGE_SIZE = 50;
const FULL_METRIC_ORDER: LedgerMetric[] = [
  "expense",
  "income",
  "balance",
  "count",
  "average_daily_expense",
  "max_expense",
];

type QueryMetricPresentation = {
  key: LedgerMetric;
  label: string;
  value: string;
};

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

function getQueryMetricPresentation(
  metric: LedgerMetric,
  result: LedgerQueryOperationResult,
): QueryMetricPresentation {
  if (metric === "count") {
    return {
      key: metric,
      label: "账单数",
      value: `${result.stats.transactionCount} 笔`,
    };
  }

  if (metric === "expense") {
    return {
      key: metric,
      label: "支出",
      value: formatCurrency(result.stats.summary.expense),
    };
  }

  if (metric === "income") {
    return {
      key: metric,
      label: "收入",
      value: formatCurrency(result.stats.summary.income),
    };
  }

  if (metric === "balance") {
    return {
      key: metric,
      label: "结余",
      value: formatCurrency(result.stats.summary.balance),
    };
  }

  if (metric === "average_daily_expense") {
    return {
      key: metric,
      label: "日均支出",
      value: formatCurrency(result.stats.averageDailyExpense),
    };
  }

  return {
    key: metric,
    label: "最大支出",
    value: formatCurrency(result.stats.maxExpenseAmount),
  };
}

export function getPrimaryQueryMetrics(
  operation: LedgerQueryOperation,
  result: LedgerQueryOperationResult,
) {
  return operation.metrics.map((metric) =>
    getQueryMetricPresentation(metric, result),
  );
}

function getAllQueryMetrics(result: LedgerQueryOperationResult) {
  return FULL_METRIC_ORDER.map((metric) =>
    getQueryMetricPresentation(metric, result),
  );
}

type LedgerQueryResultCardProps = {
  ledgerName: string;
  onOpenTransactions: (operationIndex: number) => void;
  result: FoxChatQueryClientResult;
};

export function LedgerQueryResultCard({
  ledgerName,
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
  const compactAnswer =
    result.answer?.text ?? "统计已经完成，点开查看结果。";

  return (
    <ChatResultDisclosure
      className="query-ledger-disclosure"
      compactContent={
        <>
          <span className="chat-result-disclosure-icon" aria-hidden="true">
            <BookOpen size={16} strokeWidth={2.2} />
          </span>
          <span className="chat-result-disclosure-text">
            <span className="chat-result-disclosure-summary" aria-live="polite">
              {compactAnswer}
            </span>
            <span className="ledger-badge">{ledgerName}</span>
          </span>
        </>
      }
      label={`问账结果：${compactAnswer}`}
    >
      <article className="ledger-query-card">
        {result.answer ? (
          <div className="ledger-query-answer">
            <div className="ledger-query-answer-heading">
              <span>账本回答</span>
              <span className="batch-status ready">统计完成</span>
            </div>
            <p>{result.answer.text}</p>
            {result.answer.suggestion ? <small>{result.answer.suggestion}</small> : null}
          </div>
        ) : (
          <div className="ledger-query-answer unavailable">
            <div className="ledger-query-answer-heading">
              <span>账本回答</span>
              <span className="batch-status ready">统计完成</span>
            </div>
            <p className="batch-warning" role="status">
              {result.answer_error ?? "统计已完成，但自然语言解释暂不可用。"}
            </p>
          </div>
        )}

        <div className="ledger-query-operations">
          {result.operations.map((operation, index) => {
            const planOperation = result.plan.operations[index];
            const navigation = createLedgerQueryNavigation(planOperation);
            const primaryMetrics = getPrimaryQueryMetrics(
              planOperation,
              operation,
            );

            return (
              <section
                className="ledger-query-operation"
                key={`${planOperation.range.startDate}-${index}`}
              >
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

                <div
                  aria-label={`${planOperation.range.label}主要指标`}
                  className="ledger-summary-grid ledger-query-primary"
                  role="group"
                >
                  {primaryMetrics.map((metric) => (
                    <span key={metric.key}>
                      {metric.label}
                      <strong>{metric.value}</strong>
                    </span>
                  ))}
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

                <details className="ledger-query-more-stats">
                  <summary>
                    <span>更多统计</span>
                    <ChevronDown aria-hidden="true" size={17} />
                  </summary>
                  <div className="ledger-summary-grid ledger-query-summary">
                    {getAllQueryMetrics(operation).map((metric) => (
                      <span key={metric.key}>
                        {metric.label}
                        <strong>{metric.value}</strong>
                      </span>
                    ))}
                  </div>
                </details>
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
    </ChatResultDisclosure>
  );
}
