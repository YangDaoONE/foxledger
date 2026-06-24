"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckSquare, ListFilter, RefreshCw, RotateCcw, Search, Square, Trash2 } from "lucide-react";
import { EditTransactionForm } from "@/components/EditTransactionForm";
import { TransactionCard } from "@/components/TransactionCard";
import { listCachedTransactionsPage } from "@/lib/localTransactions";
import { defaultCategories } from "@/lib/transactionRules";
import {
  deleteTransaction,
  deleteTransactionsByIds,
  type TransactionFilterSummary,
  type TransactionSortOption,
} from "@/lib/transactions";
import { formatCny } from "@/lib/format";
import type { Transaction, TransactionType } from "@/types/transaction";

type TransactionManagerProps = {
  filterOverride?: TransactionFilterOverride | null;
  isOnline: boolean;
  refreshKey: number;
  userId: string;
  onChanged?: () => void;
  onRefresh?: () => Promise<void>;
};

export type TransactionTypeFilter = TransactionType | "all";

type FilterValues = {
  search: string;
  type: TransactionTypeFilter;
  category: string;
  startDate: string;
  endDate: string;
  sort: TransactionSortOption;
};

export type TransactionFilterOverride = {
  id: number;
  label: string;
  search?: string;
  type?: TransactionTypeFilter;
  category?: string;
  startDate?: string;
  endDate?: string;
  sort?: TransactionSortOption;
};

type DateGroup = {
  date: string;
  transactions: Transaction[];
};

type MonthGroup = {
  month: string;
  dates: DateGroup[];
};

type YearGroup = {
  year: string;
  months: MonthGroup[];
};

const pageSize = 30;

const initialFilters: FilterValues = {
  search: "",
  type: "all",
  category: "",
  startDate: "",
  endDate: "",
  sort: "date-desc",
};

function getInitialFilters(filterOverride?: TransactionFilterOverride | null): FilterValues {
  if (!filterOverride) {
    return initialFilters;
  }

  return {
    ...initialFilters,
    search: filterOverride.search?.trim() ?? "",
    type: filterOverride.type ?? "all",
    category: filterOverride.category ?? "",
    startDate: filterOverride.startDate ?? "",
    endDate: filterOverride.endDate ?? "",
    sort: filterOverride.sort ?? "date-desc",
  };
}

const emptySummary: TransactionFilterSummary = {
  expense: 0,
  income: 0,
  count: 0,
};

const typeFilterOptions: Array<{ label: string; value: TransactionTypeFilter }> = [
  { label: "全部", value: "all" },
  { label: "支出", value: "expense" },
  { label: "收入", value: "income" },
  { label: "转账", value: "transfer" },
];

const sortOptions: Array<{ label: string; value: TransactionSortOption }> = [
  { label: "日期倒序", value: "date-desc" },
  { label: "日期正序", value: "date-asc" },
  { label: "金额倒序", value: "amount-desc" },
  { label: "金额正序", value: "amount-asc" },
];

function groupTransactionsByDate(transactions: Transaction[]): YearGroup[] {
  const yearGroups: YearGroup[] = [];

  for (const transaction of transactions) {
    const [year = "未知年份", month = "未知月份"] = transaction.date.split("-");
    let yearGroup = yearGroups.find((group) => group.year === year);

    if (!yearGroup) {
      yearGroup = { year, months: [] };
      yearGroups.push(yearGroup);
    }

    let monthGroup = yearGroup.months.find((group) => group.month === month);

    if (!monthGroup) {
      monthGroup = { month, dates: [] };
      yearGroup.months.push(monthGroup);
    }

    let dateGroup = monthGroup.dates.find((group) => group.date === transaction.date);

    if (!dateGroup) {
      dateGroup = { date: transaction.date, transactions: [] };
      monthGroup.dates.push(dateGroup);
    }

    dateGroup.transactions.push(transaction);
  }

  return yearGroups;
}

function formatYearLabel(year: string) {
  return /^\d{4}$/.test(year) ? `${year} 年` : year;
}

function formatMonthLabel(month: string) {
  return /^\d{2}$/.test(month) ? `${Number(month)} 月` : month;
}

function formatDateLabel(date: string) {
  const [, month, day] = date.split("-");

  if (!month || !day) {
    return date;
  }

  return `${Number(month)} 月 ${Number(day)} 日`;
}

function hasActiveFilters(filters: FilterValues) {
  return Boolean(
    filters.search.trim() ||
      filters.type !== "all" ||
      filters.category ||
      filters.startDate ||
      filters.endDate,
  );
}

function validateDateFilters(filters: FilterValues) {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    return "开始日期不能晚于结束日期。";
  }

  return null;
}

export function TransactionManager({
  filterOverride,
  isOnline,
  refreshKey,
  userId,
  onChanged,
  onRefresh,
}: TransactionManagerProps) {
  const initialFilterState = getInitialFilters(filterOverride);
  const [filters, setFilters] = useState<FilterValues>(initialFilterState);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(initialFilterState);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionFilterSummary>(emptySummary);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshingRemote, setIsRefreshingRemote] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterErrorMessage, setFilterErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    filterOverride ? `已应用筛选：${filterOverride.label}` : null,
  );
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [isBatchDeleteConfirming, setIsBatchDeleteConfirming] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [manualReloadKey, setManualReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialPage() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await listCachedTransactionsPage(userId, {
          search: appliedFilters.search,
          type: appliedFilters.type === "all" ? null : appliedFilters.type,
          category: appliedFilters.category || null,
          startDate: appliedFilters.startDate,
          endDate: appliedFilters.endDate,
          sort: appliedFilters.sort,
          limit: pageSize,
          offset: 0,
        });

        if (!isMounted) {
          return;
        }

        setTransactions(result.transactions);
        setSummary(result.summary);
        setHasMore(result.hasMore);
        setTotalCount(result.totalCount);
        setSelectedTransactionIds([]);
        setIsBatchDeleteConfirming(false);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "读取账单失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialPage();

    return () => {
      isMounted = false;
    };
  }, [appliedFilters, refreshKey, manualReloadKey, userId]);

  function handleApplyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const validationMessage = validateDateFilters(filters);

    if (validationMessage) {
      setFilterErrorMessage(validationMessage);
      return;
    }

    setFilterErrorMessage(null);
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
    setEditingTransactionId(null);
    setSelectedTransactionIds([]);
    setIsBatchDeleteConfirming(false);
    setAppliedFilters({ ...filters, search: filters.search.trim() });
  }

  function handleClearFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setFilterErrorMessage(null);
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
    setEditingTransactionId(null);
    setSelectedTransactionIds([]);
    setIsBatchDeleteConfirming(false);
  }

  async function handleReload() {
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
    setSelectedTransactionIds([]);
    setIsBatchDeleteConfirming(false);

    if (isOnline && onRefresh) {
      setIsRefreshingRemote(true);
      setSuccessMessage("正在同步云端账单。");

      try {
        await onRefresh();
        setSuccessMessage("同步完成。");
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "同步账单失败。");
      } finally {
        setIsRefreshingRemote(false);
      }

      return;
    }

    setManualReloadKey((value) => value + 1);
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    setActionErrorMessage(null);

    try {
      const result = await listCachedTransactionsPage(userId, {
        search: appliedFilters.search,
        type: appliedFilters.type === "all" ? null : appliedFilters.type,
        category: appliedFilters.category || null,
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        sort: appliedFilters.sort,
        limit: pageSize,
        offset: transactions.length,
      });

      setTransactions((current) => [...current, ...result.transactions]);
      setSummary(result.summary);
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "加载更多账单失败。");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleToggleManageMode() {
    setIsManageMode((current) => !current);
    setSelectedTransactionIds([]);
    setIsBatchDeleteConfirming(false);
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
    setEditingTransactionId(null);
  }

  function toggleSelectedTransaction(transactionId: string) {
    setSelectedTransactionIds((current) =>
      current.includes(transactionId)
        ? current.filter((id) => id !== transactionId)
        : [...current, transactionId],
    );
    setIsBatchDeleteConfirming(false);
  }

  function handleSelectVisibleTransactions() {
    setSelectedTransactionIds(transactions.map((transaction) => transaction.id));
    setIsBatchDeleteConfirming(false);
  }

  function handleClearSelection() {
    setSelectedTransactionIds([]);
    setIsBatchDeleteConfirming(false);
  }

  async function handleBatchDelete() {
    if (selectedTransactionIds.length === 0 || isBatchDeleting) {
      return;
    }

    setActionErrorMessage(null);
    setSuccessMessage(null);

    if (!isBatchDeleteConfirming) {
      setIsBatchDeleteConfirming(true);
      return;
    }

    setIsBatchDeleting(true);

    try {
      const deletedCount = await deleteTransactionsByIds(selectedTransactionIds);
      setSuccessMessage(`删除成功：${deletedCount} 笔账单。`);
      setSelectedTransactionIds([]);
      setIsBatchDeleteConfirming(false);
      setManualReloadKey((value) => value + 1);
      onChanged?.();
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "批量删除失败。");
    } finally {
      setIsBatchDeleting(false);
    }
  }

  function handleEdit(transaction: Transaction) {
    setActionErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
    setEditingTransactionId(transaction.id);
  }

  function handleCancelEdit() {
    setEditingTransactionId(null);
    setActionErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleTransactionUpdated() {
    setEditingTransactionId(null);
    setConfirmDeleteId(null);
    setActionErrorMessage(null);
    setSuccessMessage("保存成功");
    setManualReloadKey((value) => value + 1);
    onChanged?.();
  }

  async function handleDelete(transactionId: string) {
    if (deletingId) {
      return;
    }

    setActionErrorMessage(null);
    setSuccessMessage(null);

    if (confirmDeleteId !== transactionId) {
      setConfirmDeleteId(transactionId);
      return;
    }

    setDeletingId(transactionId);

    try {
      await deleteTransaction(transactionId);
      setConfirmDeleteId(null);
      setDeletingId(null);
      if (editingTransactionId === transactionId) {
        setEditingTransactionId(null);
      }
      setSuccessMessage("删除成功");
      setManualReloadKey((value) => value + 1);
      onChanged?.();
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "删除失败。");
      setDeletingId(null);
    }
  }

  function renderTransactionItem(transaction: Transaction) {
    const isSelected = selectedTransactionIds.includes(transaction.id);

    return (
      <div className="transaction-edit-item" key={transaction.id}>
        <div className={isManageMode ? "managed-transaction-row selected-mode" : "managed-transaction-row"}>
          {isManageMode ? (
            <button
              aria-label={isSelected ? "取消选择这笔账单" : "选择这笔账单"}
              aria-pressed={isSelected}
              className="small-icon-button"
              type="button"
              onClick={() => toggleSelectedTransaction(transaction.id)}
            >
              {isSelected ? (
                <CheckSquare size={17} aria-hidden="true" />
              ) : (
                <Square size={17} aria-hidden="true" />
              )}
            </button>
          ) : null}
          <TransactionCard
            transaction={transaction}
            isEditing={editingTransactionId === transaction.id}
            isConfirmingDelete={confirmDeleteId === transaction.id}
            isDeleting={deletingId === transaction.id}
            onEdit={isManageMode || !isOnline ? undefined : handleEdit}
            onDelete={isManageMode || !isOnline ? undefined : handleDelete}
          />
        </div>
        {deletingId === transaction.id ? <p className="delete-confirm-note">删除中</p> : null}
        {confirmDeleteId === transaction.id && deletingId !== transaction.id ? (
          <p className="delete-confirm-note">再次点击删除按钮确认删除。</p>
        ) : null}
        {editingTransactionId === transaction.id ? (
          <EditTransactionForm
            key={transaction.id}
            transaction={transaction}
            onCancel={handleCancelEdit}
            onUpdated={handleTransactionUpdated}
          />
        ) : null}
      </div>
    );
  }

  const shouldGroupByDate = appliedFilters.sort === "date-desc" || appliedFilters.sort === "date-asc";
  const isFiltered = hasActiveFilters(appliedFilters);

  return (
    <section className="section-block" aria-labelledby="transaction-manager-title">
      <div className="section-heading horizontal">
        <div>
          <p>账单</p>
          <h2 id="transaction-manager-title">搜索与筛选</h2>
        </div>
        <button
          className="text-button"
          disabled={isLoading || isRefreshingRemote}
          type="button"
          onClick={handleReload}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {isRefreshingRemote ? "同步中" : "刷新"}
        </button>
      </div>

      <form className="transaction-filter-form" onSubmit={handleApplyFilters}>
        <label className="manual-field">
          <span>搜索</span>
          <div className="filter-search-control">
            <Search size={17} aria-hidden="true" />
            <input
              placeholder="商户、备注、分类"
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </div>
        </label>

        <div className="manual-grid two-columns">
          <label className="manual-field">
            <span>类型</span>
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  type: event.target.value as TransactionTypeFilter,
                }))
              }
            >
              {typeFilterOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="manual-field">
            <span>分类</span>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="">全部分类</option>
              {defaultCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="manual-grid two-columns">
          <label className="manual-field">
            <span>开始日期</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>

          <label className="manual-field">
            <span>结束日期</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, endDate: event.target.value }))
              }
            />
          </label>
        </div>

        <label className="manual-field">
          <span>排序</span>
          <select
            value={filters.sort}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sort: event.target.value as TransactionSortOption,
              }))
            }
          >
            {sortOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {filterErrorMessage ? <p className="form-message error">{filterErrorMessage}</p> : null}

        <div className="transaction-filter-actions">
          <button className="primary-button" type="submit" disabled={isLoading}>
            <ListFilter size={18} aria-hidden="true" />
            应用筛选
          </button>
          <button className="secondary-button" type="button" onClick={handleClearFilters}>
            <RotateCcw size={18} aria-hidden="true" />
            清空
          </button>
        </div>
      </form>

      <div className="filter-summary-grid" aria-label="筛选结果汇总">
        <div>
          <span>总支出</span>
          <strong>{formatCny(summary.expense)}</strong>
        </div>
        <div>
          <span>总收入</span>
          <strong>{formatCny(summary.income)}</strong>
        </div>
        <div>
          <span>笔数</span>
          <strong>{summary.count}</strong>
        </div>
      </div>

      <div className="manager-toolbar" aria-label="账单管理操作">
        <button
          className="secondary-button"
          disabled={!isOnline && !isManageMode}
          type="button"
          onClick={handleToggleManageMode}
        >
          {isManageMode ? "退出管理" : "管理"}
        </button>
        {!isOnline ? <span className="offline-toolbar-note">离线只读</span> : null}
        {isManageMode ? (
          <>
            <button
              className="secondary-button"
              disabled={!isOnline}
              type="button"
              onClick={handleSelectVisibleTransactions}
            >
              全选当前
            </button>
            <button
              className="secondary-button"
              disabled={!isOnline}
              type="button"
              onClick={handleClearSelection}
            >
              取消全选
            </button>
          </>
        ) : null}
      </div>

      {isManageMode ? (
        <div className="batch-delete-panel">
          <div>
            <span>已选择</span>
            <strong>{selectedTransactionIds.length} 笔</strong>
          </div>
          <button
            className="secondary-button danger-action"
            disabled={selectedTransactionIds.length === 0 || isBatchDeleting || !isOnline}
            type="button"
            onClick={handleBatchDelete}
          >
            <Trash2 size={17} aria-hidden="true" />
            {isBatchDeleting
              ? "删除中"
              : isBatchDeleteConfirming
                ? `确认删除 ${selectedTransactionIds.length} 笔`
                : "删除已选择"}
          </button>
          {isBatchDeleteConfirming ? (
            <p className="delete-confirm-note">
              将永久删除已选择的 {selectedTransactionIds.length} 笔账单，再次点击确认删除。
            </p>
          ) : null}
        </div>
      ) : null}

      {!isOnline ? (
        <p className="form-message error transaction-list-message">
          当前为离线数据，只能查看，联网后可编辑或删除。
        </p>
      ) : null}

      {isLoading ? <p className="list-state">正在读取账单</p> : null}

      {!isLoading && successMessage ? (
        <p className="form-message success transaction-list-message">{successMessage}</p>
      ) : null}

      {!isLoading && actionErrorMessage ? (
        <p className="form-message error transaction-list-message">{actionErrorMessage}</p>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="list-state error">
          <p>{errorMessage}</p>
          <button type="button" onClick={handleReload}>
            重试
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && totalCount === 0 ? (
        <p className="list-state">
          {isFiltered ? "没有匹配当前筛选条件的账单。" : "还没有账单。保存账单后会显示在这里。"}
        </p>
      ) : null}

      {!isLoading && !errorMessage && transactions.length > 0 && shouldGroupByDate ? (
        <div className="transaction-group-list">
          {groupTransactionsByDate(transactions).map((yearGroup) => (
            <section className="transaction-year-group" key={yearGroup.year}>
              <div className="transaction-year-heading">{formatYearLabel(yearGroup.year)}</div>
              {yearGroup.months.map((monthGroup) => (
                <section className="transaction-month-group" key={`${yearGroup.year}-${monthGroup.month}`}>
                  <div className="transaction-month-heading">{formatMonthLabel(monthGroup.month)}</div>
                  {monthGroup.dates.map((dateGroup) => (
                    <section className="transaction-date-group" key={dateGroup.date}>
                      <div className="transaction-date-heading">{formatDateLabel(dateGroup.date)}</div>
                      <div className="transaction-list">
                        {dateGroup.transactions.map((transaction) => renderTransactionItem(transaction))}
                      </div>
                    </section>
                  ))}
                </section>
              ))}
            </section>
          ))}
        </div>
      ) : null}

      {!isLoading && !errorMessage && transactions.length > 0 && !shouldGroupByDate ? (
        <div className="transaction-list">{transactions.map((transaction) => renderTransactionItem(transaction))}</div>
      ) : null}

      {!isLoading && !errorMessage && transactions.length > 0 ? (
        <div className="load-more-block">
          <p className="confirm-note">
            已显示 {transactions.length} / {totalCount} 笔
          </p>
          <button
            className="secondary-button manual-submit"
            disabled={!hasMore || isLoadingMore}
            type="button"
            onClick={handleLoadMore}
          >
            {isLoadingMore ? "加载中" : hasMore ? "加载更多" : "没有更多账单"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
