import type { MonthlySummaryData } from "@/types/transaction";
import { formatCny } from "@/lib/format";

type MonthlySummaryProps = {
  summary: MonthlySummaryData;
};

export function MonthlySummary({ summary }: MonthlySummaryProps) {
  return (
    <section className="summary-panel" aria-labelledby="monthly-summary-title">
      <div className="section-heading">
        <p>本月概览</p>
        <h2 id="monthly-summary-title">{summary.month}</h2>
      </div>

      <div className="summary-main">
        <span>本月结余</span>
        <strong>{formatCny(summary.balance)}</strong>
      </div>

      <div className="summary-grid" aria-label="本月收入和支出">
        <div>
          <span>支出</span>
          <strong>{formatCny(summary.expense)}</strong>
        </div>
        <div>
          <span>收入</span>
          <strong>{formatCny(summary.income)}</strong>
        </div>
      </div>

      <div className="budget-line" aria-label={`预算已使用 ${summary.budgetUsedPercent}%`}>
        <div>
          <span>预算使用</span>
          <strong>{summary.budgetUsedPercent}%</strong>
        </div>
        <progress value={summary.budgetUsedPercent} max="100" />
      </div>
    </section>
  );
}
