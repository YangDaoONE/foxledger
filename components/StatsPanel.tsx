"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatCny } from "@/lib/format";
import { getMonthlyStats, type MonthlyStats } from "@/lib/stats";

type StatsPanelProps = {
  refreshKey: number;
  onSummaryChange: (summary: MonthlyStats["summary"]) => void;
};

export function StatsPanel({ refreshKey, onSummaryChange }: StatsPanelProps) {
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualReloadKey, setManualReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextStats = await getMonthlyStats();

        if (!isMounted) {
          return;
        }

        setStats(nextStats);
        onSummaryChange(nextStats.summary);
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
  }, [refreshKey, manualReloadKey, onSummaryChange]);

  function handleReload() {
    setManualReloadKey((value) => value + 1);
  }

  return (
    <section className="section-block" id="stats" aria-labelledby="stats-title">
      <div className="section-heading horizontal">
        <div>
          <p>真实统计</p>
          <h2 id="stats-title">本月排行和趋势</h2>
        </div>
        <button className="text-button" disabled={isLoading} type="button" onClick={handleReload}>
          <RefreshCw size={15} aria-hidden="true" />
          刷新
        </button>
      </div>

      {isLoading ? <p className="list-state">正在读取统计</p> : null}

      {!isLoading && errorMessage ? (
        <div className="list-state error">
          <p>{errorMessage}</p>
          <button type="button" onClick={handleReload}>
            重试
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && stats && stats.transactionCount === 0 ? (
        <p className="list-state">本月还没有真实账单。保存一笔账单后这里会显示统计。</p>
      ) : null}

      {!isLoading && !errorMessage && stats && stats.transactionCount > 0 ? (
        <div className="stats-grid">
          <div className="stats-subsection">
            <div className="section-heading">
              <p>分类支出</p>
              <h3>本月排行</h3>
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
              <p className="list-state">本月还没有支出账单。</p>
            )}
          </div>

          <div className="stats-subsection">
            <div className="section-heading">
              <p>每日支出</p>
              <h3>本月趋势</h3>
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
              <p className="list-state">本月还没有支出趋势。</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
