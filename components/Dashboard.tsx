"use client";

import { useState } from "react";
import { Bell, Search } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ChatInput } from "@/components/ChatInput";
import { ManualTransactionForm } from "@/components/ManualTransactionForm";
import { MonthlySummary } from "@/components/MonthlySummary";
import { TransactionList } from "@/components/TransactionList";
import { formatCny } from "@/lib/format";
import { mockCategorySpend, mockMonthlySummary } from "@/lib/mockData";

export function Dashboard() {
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);

  function handleTransactionSaved() {
    setTransactionRefreshKey((value) => value + 1);
  }

  return (
    <>
      <div className="app-content">
        <header className="app-header">
          <div>
            <p>FoxLedger</p>
            <h1>狐狐记账</h1>
          </div>
          <div className="header-actions" aria-label="快捷操作">
            <button className="icon-button" type="button" aria-label="搜索账单">
              <Search size={20} aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" aria-label="通知">
              <Bell size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <MonthlySummary summary={mockMonthlySummary} />

        <ManualTransactionForm onSaved={handleTransactionSaved} />

        <ChatInput onSaved={handleTransactionSaved} />

        <TransactionList refreshKey={transactionRefreshKey} />

        <section className="section-block" id="stats" aria-labelledby="category-title">
          <div className="section-heading horizontal">
            <div>
              <p>分类支出</p>
              <h2 id="category-title">本月排行</h2>
            </div>
            <a href="#stats">统计</a>
          </div>

          <div className="category-list">
            {mockCategorySpend.map((item) => (
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
        </section>
      </div>

      <BottomNav />
    </>
  );
}
