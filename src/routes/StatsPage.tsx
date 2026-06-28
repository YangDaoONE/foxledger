import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { Chip } from "@/components/ui/Chip";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StateBlock } from "@/components/ui/StateBlock";
import { getStatsForRange } from "@/features/stats/statsApi";
import {
  buildCustomStatsRange,
  getPresetStatsRange,
} from "@/features/stats/statsRanges";
import type { StatsDateRange, StatsRangeKey } from "@/features/stats/types";
import { useSyncState } from "@/features/sync/SyncProvider";
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
        error: error instanceof Error ? error.message : "自定义日期不正确。",
        range: null,
      };
    }
  }, [customEndDate, customStartDate, rangeKey]);
  const range = rangeResult.range;
  const customError = rangeResult.error;

  const statsQuery = useQuery({
    enabled: Boolean(range),
    queryFn: () => getStatsForRange(user.id, range!),
    queryKey: ["stats", user.id, range?.key, range?.startDate, range?.endDate],
  });

  function drilldown(params: { category?: string; type?: "expense" | "income" | "transfer" }) {
    if (!range) {
      return;
    }

    navigate({
      search: {
        category: params.category ?? "",
        endDate: range.endDate,
        scope: String(Date.now()),
        search: "",
        sort: "date-desc",
        startDate: range.startDate,
        type: params.type ?? "",
      },
      to: "/transactions",
    });
  }

  const stats = statsQuery.data;

  return (
    <div className="view-stack">
      <SectionBlock eyebrow="统计" title="日期范围">
        <div className="toolbar-row">
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
          <AppButton
            disabled={!isOnline || isSyncing}
            icon={<RefreshCw size={16} />}
            type="button"
            variant="secondary"
            onClick={syncNow}
          >
            刷新
          </AppButton>
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
          {statsQuery.error instanceof Error ? statsQuery.error.message : "统计失败。"}
        </StateBlock>
      ) : null}

      {stats ? (
        <>
          <section className="stats-grid">
            <button className="stat-card expense" type="button" onClick={() => drilldown({ type: "expense" })}>
              <span>总支出</span>
              <strong>{formatCurrency(stats.summary.expense)}</strong>
            </button>
            <button className="stat-card income" type="button" onClick={() => drilldown({ type: "income" })}>
              <span>总收入</span>
              <strong>{formatCurrency(stats.summary.income)}</strong>
            </button>
            <div className="stat-card balance">
              <span>结余</span>
              <strong>{formatCurrency(stats.summary.balance)}</strong>
            </div>
            <div className="stat-card">
              <span>交易笔数</span>
              <strong>{stats.transactionCount}</strong>
            </div>
            <div className="stat-card">
              <span>日均支出</span>
              <strong>{formatCurrency(stats.averageDailyExpense)}</strong>
            </div>
            <div className="stat-card">
              <span>最大支出</span>
              <strong>{formatCurrency(stats.maxExpenseAmount)}</strong>
            </div>
          </section>

          <SectionBlock eyebrow="排行" title="分类支出">
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

          <SectionBlock eyebrow="趋势" title="每日支出">
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
                    onClick={() =>
                      navigate({
                        search: {
                          category: "",
                          endDate: item.date,
                          scope: String(Date.now()),
                          search: "",
                          sort: "date-desc",
                          startDate: item.date,
                          type: "expense",
                        },
                        to: "/transactions",
                      })
                    }
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
