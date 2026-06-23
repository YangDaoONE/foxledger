"use client";

import { useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { formatCny } from "@/lib/format";
import {
  getPresetStatsDateRange,
  getStatsForDateRange,
  type MonthlyStats,
  type StatsDateRange,
  type StatsRangePreset,
} from "@/lib/stats";

type StatsPanelProps = {
  refreshKey: number;
};

type StatsRangeMode = StatsRangePreset | "custom";

const rangeOptions: Array<{ label: string; value: StatsRangePreset }> = [
  { label: "本周", value: "this-week" },
  { label: "本月", value: "this-month" },
  { label: "上月", value: "last-month" },
  { label: "今年", value: "this-year" },
];

const initialRange = getPresetStatsDateRange("this-month");

function formatRangeLabel(range: StatsDateRange) {
  return `${range.startDate} 至 ${range.endDate}`;
}

export function StatsPanel({ refreshKey }: StatsPanelProps) {
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [rangeMode, setRangeMode] = useState<StatsRangeMode>("this-month");
  const [activeRange, setActiveRange] = useState<StatsDateRange>(initialRange);
  const [customStartDate, setCustomStartDate] = useState(initialRange.startDate);
  const [customEndDate, setCustomEndDate] = useState(initialRange.endDate);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rangeErrorMessage, setRangeErrorMessage] = useState<string | null>(null);
  const [manualReloadKey, setManualReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextStats = await getStatsForDateRange(
          activeRange.startDate,
          activeRange.endDate,
          activeRange.label,
        );

        if (!isMounted) {
          return;
        }

        setStats(nextStats);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "读取统计失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, manualReloadKey, activeRange]);

  function handlePresetChange(preset: StatsRangePreset) {
    const nextRange = getPresetStatsDateRange(preset);
    setRangeMode(preset);
    setActiveRange(nextRange);
    setCustomStartDate(nextRange.startDate);
    setCustomEndDate(nextRange.endDate);
    setRangeErrorMessage(null);
  }

  function handleApplyCustomRange() {
    if (!customStartDate || !customEndDate) {
      setRangeErrorMessage("请选择开始日期和结束日期。");
      return;
    }

    if (customStartDate > customEndDate) {
      setRangeErrorMessage("开始日期不能晚于结束日期。");
      return;
    }

    setRangeMode("custom");
    setActiveRange({
      label: "自定义",
      startDate: customStartDate,
      endDate: customEndDate,
    });
    setRangeErrorMessage(null);
  }

  function handleReload() {
    setManualReloadKey((value) => value + 1);
  }

  return (
    <section className="section-block" id="stats" aria-labelledby="stats-title">
      <div className="section-heading horizontal">
        <div>
          <p>真实统计</p>
          <h2 id="stats-title">{activeRange.label}统计</h2>
        </div>
        <button className="text-button" disabled={isLoading} type="button" onClick={handleReload}>
          <RefreshCw size={15} aria-hidden="true" />
          刷新
        </button>
      </div>

      <div className="stats-range-controls" aria-label="选择统计日期范围">
        <div className="range-button-row">
          {rangeOptions.map((option) => (
            <button
              aria-pressed={rangeMode === option.value}
              className={rangeMode === option.value ? "range-button active" : "range-button"}
              key={option.value}
              type="button"
              onClick={() => handlePresetChange(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button
            aria-pressed={rangeMode === "custom"}
            className={rangeMode === "custom" ? "range-button active" : "range-button"}
            type="button"
            onClick={handleApplyCustomRange}
          >
            自定义
          </button>
        </div>

        <div className="custom-range-fields">
          <label className="manual-field">
            <span>开始日期</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(event) => setCustomStartDate(event.target.value)}
            />
          </label>
          <label className="manual-field">
            <span>结束日期</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(event) => setCustomEndDate(event.target.value)}
            />
          </label>
          <button
            className="secondary-button apply-range-button"
            type="button"
            onClick={handleApplyCustomRange}
          >
            <CalendarDays size={17} aria-hidden="true" />
            应用
          </button>
        </div>

        <p className="confirm-note">{formatRangeLabel(activeRange)}</p>
      </div>

      {rangeErrorMessage ? <p className="form-message error">{rangeErrorMessage}</p> : null}

      {isLoading ? <p className="list-state">正在读取统计</p> : null}

      {!isLoading && errorMessage ? (
        <div className="list-state error">
          <p>{errorMessage}</p>
          <button type="button" onClick={handleReload}>
            重试
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && stats ? (
        <div className="stats-metric-grid" aria-label="统计概览">
          <div>
            <span>总支出</span>
            <strong>{formatCny(stats.summary.expense)}</strong>
          </div>
          <div>
            <span>总收入</span>
            <strong>{formatCny(stats.summary.income)}</strong>
          </div>
          <div>
            <span>结余</span>
            <strong>{formatCny(stats.summary.balance)}</strong>
          </div>
          <div>
            <span>交易笔数</span>
            <strong>{stats.transactionCount}</strong>
          </div>
          <div>
            <span>日均支出</span>
            <strong>{formatCny(stats.averageDailyExpense)}</strong>
          </div>
          <div>
            <span>最大单笔支出</span>
            <strong>{formatCny(stats.maxExpenseAmount)}</strong>
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage && stats && stats.transactionCount === 0 ? (
        <p className="list-state">当前范围还没有真实账单。保存一笔账单后这里会显示统计。</p>
      ) : null}

      {!isLoading && !errorMessage && stats && stats.transactionCount > 0 ? (
        <div className="stats-grid">
          <div className="stats-subsection">
            <div className="section-heading">
              <p>分类支出</p>
              <h3>{activeRange.label}排行</h3>
            </div>
            {stats.categorySpend.length > 0 ? (
              <div className="category-list">
                {stats.categorySpend.map((item) => (
                  <div className="category-row" key={item.category}>
                    <div className="category-row-top">
                      <span>{item.category}</span>
                      <strong>{formatCny(item.amount)}</strong>
                    </div>
                    <div className="category-meter" aria-label={`${item.category} 占比 ${item.percent}%`}>
                      <span style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="list-state">当前范围还没有支出账单。</p>
            )}
          </div>

          <div className="stats-subsection">
            <div className="section-heading">
              <p>每日支出</p>
              <h3>{activeRange.label}趋势</h3>
            </div>
            {stats.dailySpend.length > 0 ? (
              <div className="daily-list">
                {stats.dailySpend.map((item) => (
                  <div className="daily-row" key={item.date}>
                    <div className="daily-row-top">
                      <span>{item.date}</span>
                      <strong>{formatCny(item.amount)}</strong>
                    </div>
                    <div className="category-meter" aria-label={`${item.date} 支出 ${formatCny(item.amount)}`}>
                      <span style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="list-state">当前范围还没有支出趋势。</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
