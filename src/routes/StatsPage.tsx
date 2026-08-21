import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChartNoAxesCombined, RefreshCw } from "lucide-react";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { Chip } from "@/components/ui/Chip";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StateBlock } from "@/components/ui/StateBlock";
import { useActiveLedger } from "@/features/ledgers/LedgerProvider";
import { getStatsForRange } from "@/features/stats/statsApi";
import {
  createStatsDrilldownParams,
  type StatsDrilldown,
} from "@/features/stats/statsDrilldown";
import {
  buildCustomStatsRange,
  getPresetStatsRange,
} from "@/features/stats/statsRanges";
import type { StatsDateRange, StatsRangeKey } from "@/features/stats/types";
import { useSyncState } from "@/features/sync/SyncProvider";
import { createTransactionSearch } from "@/features/transactions/transactionSearch";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

const rangeOptions: Array<{ key: StatsRangeKey; label: string }> = [
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "last-month", label: "上月" },
  { key: "year", label: "今年" },
  { key: "custom", label: "自定义" },
];

export function StatsPage() {
  const user = useAuthUser();
  const activeLedger = useActiveLedger();
  const navigate = useNavigate();
  const { isOnline, isSyncing, syncNow } = useSyncState();
  const [rangeKey, setRangeKey] = useState<StatsRangeKey>("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const rangeResult = useMemo<{ error: string | null; range: StatsDateRange | null }>(() => {
    if (rangeKey !== "custom") {
      return { error: null, range: getPresetStatsRange(rangeKey) };
    }

    try {
      return {
        error: null,
        range: buildCustomStatsRange(customStartDate, customEndDate),
      };
    } catch (error) {
      return {
        error: getErrorMessage(error, "自定义日期不正确。"),
        range: null,
      };
    }
  }, [customEndDate, customStartDate, rangeKey]);
  const range = rangeResult.range;
  const customError = rangeResult.error;

  const statsQuery = useQuery({
    enabled: Boolean(range),
    queryFn: () => getStatsForRange(user.id, activeLedger.id, range!),
    queryKey: queryKeys.statsRange(
      user.id,
      activeLedger.id,
      range?.key,
      range?.startDate,
      range?.endDate,
    ),
  });

  function drilldown(params: StatsDrilldown) {
    if (!range) {
      return;
    }

    navigate({
      search: createTransactionSearch(createStatsDrilldownParams(range, params)),
      to: "/transactions",
    });
  }

  const stats = statsQuery.data;

  return (
    <div className="view-stack stats-page">
      <PageIntro
        description="所有正式数字由代码基于当前用户缓存计算，不交给 AI 统计。"
        eyebrow="统计"
        icon={<ChartNoAxesCombined size={24} />}
        title="看见收支的节奏"
      />

      <SectionBlock
        action={
          <AppButton
            disabled={!isOnline || isSyncing}
            icon={<RefreshCw className={isSyncing ? "spin" : undefined} size={16} />}
            type="button"
            variant="secondary"
            onClick={() => void syncNow().catch(() => undefined)}
          >
            {isSyncing ? "同步中" : "刷新"}
          </AppButton>
        }
        className="stats-range-panel"
        description="选择范围后可点击支出、收入、分类或日期下钻到账单。"
        eyebrow="范围"
        title="日期范围"
      >
        <div className="chip-row">
          {rangeOptions.map((option) => (
            <Chip
              active={rangeKey === option.key}
              key={option.key}
              onClick={() => setRangeKey(option.key)}
            >
              {option.label}
            </Chip>
          ))}
        </div>

        {rangeKey === "custom" ? (
          <div className="form-grid two">
            <label className="field">
              <span>开始日期</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
              />
            </label>
            <label className="field">
              <span>结束日期</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {customError ? <p className="form-message danger">{customError}</p> : null}
      </SectionBlock>

      {statsQuery.isLoading ? <StateBlock title="读取统计">正在读取本地缓存。</StateBlock> : null}
      {statsQuery.error ? (
        <StateBlock title="统计失败" tone="danger">
          {getErrorMessage(statsQuery.error, "统计失败。")}
        </StateBlock>
      ) : null}

      {stats ? (
        <>
          <section className="metric-grid stats-metrics">
            <MetricCard
              label="总支出"
              onClick={() => drilldown({ type: "expense" })}
              tone="expense"
              value={formatCurrency(stats.summary.expense)}
            />
            <MetricCard
              label="总收入"
              onClick={() => drilldown({ type: "income" })}
              tone="income"
              value={formatCurrency(stats.summary.income)}
            />
            <MetricCard
              label="结余"
              tone="balance"
              value={formatCurrency(stats.summary.balance)}
            />
            <MetricCard label="交易笔数" value={`${stats.transactionCount} 笔`} />
            <MetricCard
              label="日均支出"
              value={formatCurrency(stats.averageDailyExpense)}
            />
            <MetricCard
              label="最大支出"
              value={formatCurrency(stats.maxExpenseAmount)}
            />
          </section>

          <SectionBlock className="stats-ranking" eyebrow="排行" title="分类支出">
            {stats.categorySpend.length === 0 ? (
              <StateBlock title="暂无支出">当前范围没有支出账单。</StateBlock>
            ) : (
              <div className="bar-list">
                {stats.categorySpend.map((item) => (
                  <button
                    className="bar-row"
                    key={item.category}
                    type="button"
                    onClick={() => drilldown({ category: item.category, type: "expense" })}
                  >
                    <span>{item.category}</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                    <i style={{ width: `${Math.max(item.percent, 4)}%` }} />
                  </button>
                ))}
              </div>
            )}
          </SectionBlock>

          <SectionBlock className="stats-trend" eyebrow="趋势" title="每日支出">
            {stats.dailySpend.length === 0 ? (
              <StateBlock title="暂无趋势">当前范围没有每日支出数据。</StateBlock>
            ) : (
              <div className="daily-bars">
                {stats.dailySpend.map((item) => (
                  <button
                    className="daily-bar"
                    key={item.date}
                    style={{ height: `${Math.max(item.percent, 6)}%` }}
                    title={`${item.date} ${formatCurrency(item.amount)}`}
                    type="button"
                    onClick={() => drilldown({ date: item.date, type: "expense" })}
                  >
                    <span>{item.date.slice(5)}</span>
                  </button>
                ))}
              </div>
            )}
          </SectionBlock>
        </>
      ) : null}
    </div>
  );
}
