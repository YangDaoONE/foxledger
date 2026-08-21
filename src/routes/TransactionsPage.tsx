import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ReceiptText, RefreshCw, Search, Trash2 } from "lucide-react";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { Chip } from "@/components/ui/Chip";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StateBlock } from "@/components/ui/StateBlock";
import { useActiveLedger, useLedgerState } from "@/features/ledgers/LedgerProvider";
import { useSyncState } from "@/features/sync/SyncProvider";
import {
  TransactionForm,
  type TransactionFormValues,
} from "@/features/transactions/TransactionForm";
import { TransactionList } from "@/features/transactions/TransactionList";
import {
  defaultCategories,
  transactionTypeOptions,
} from "@/features/transactions/transactionRules";
import { transactionSortOptions } from "@/features/transactions/transactionSearch";
import type {
  CachedTransaction,
  TransactionFilters,
  TransactionSortOption,
} from "@/features/transactions/types";
import { listCachedTransactionsPage } from "@/features/transactions/localTransactions";
import {
  deleteTransaction,
  deleteTransactionsByIds,
  updateTransaction,
} from "@/features/transactions/transactionsApi";
import { formatCurrency } from "@/lib/format";

const PAGE_SIZE = 30;
const transactionsRouteApi = getRouteApi("/transactions");

export function TransactionsPage() {
  const user = useAuthUser();
  const activeLedger = useActiveLedger();
  const { ledgers } = useLedgerState();
  const search = transactionsRouteApi.useSearch();
  const { isOnline, isSyncing, refreshAfterWrite, syncNow } = useSyncState();
  const searchType = search.type as TransactionFilters["type"];
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    category: search.category,
    endDate: search.endDate,
    search: search.search,
    sort: search.sort,
    startDate: search.startDate,
    type: searchType,
  }));
  const [searchDraft, setSearchDraft] = useState(search.search);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTransaction, setEditingTransaction] = useState<CachedTransaction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setFilters({
      category: search.category,
      endDate: search.endDate,
      search: search.search,
      sort: search.sort,
      startDate: search.startDate,
      type: search.type as TransactionFilters["type"],
    });
    setSearchDraft(search.search);
    setVisibleCount(PAGE_SIZE);
    setManageMode(false);
    setSelectedIds(new Set());
  }, [search.scope, search.category, search.endDate, search.search, search.sort, search.startDate, search.type]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setManageMode(false);
    setSelectedIds(new Set());
    setEditingTransaction(null);
    setMessage(null);
  }, [activeLedger.id]);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const transactionsQuery = useQuery({
    queryFn: () =>
      listCachedTransactionsPage({
        filters,
        ledgerId: activeLedger.id,
        limit: visibleCount,
        offset: 0,
        userId: user.id,
      }),
    queryKey: queryKeys.transactionPage(
      user.id,
      activeLedger.id,
      filtersKey,
      visibleCount,
    ),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      if (!editingTransaction) {
        throw new Error("没有正在编辑的账单。");
      }

      await updateTransaction(user.id, editingTransaction.id, values, {
        allowLedgerMove: editingTransaction.source === "manual",
      });
      await refreshAfterWrite();
    },
    onSuccess: () => setEditingTransaction(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      await deleteTransaction(user.id, transactionId);
      await refreshAfterWrite();
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const deletedCount = await deleteTransactionsByIds(user.id, Array.from(selectedIds));
      await refreshAfterWrite();
      return deletedCount;
    },
    onSuccess: (count) => {
      setMessage(`已删除 ${count} 条账单。`);
      setSelectedIds(new Set());
      setManageMode(false);
    },
  });

  const data = transactionsQuery.data;

  function updateFilter<Key extends keyof TransactionFilters>(
    key: Key,
    value: TransactionFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(PAGE_SIZE);
    setSelectedIds(new Set());
  }

  function applySearchFilter() {
    const nextSearch = searchDraft.trim();
    setSearchDraft(nextSearch);
    updateFilter("search", nextSearch);
  }

  function toggleSelected(transactionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }

      return next;
    });
  }

  function toggleManageMode() {
    setManageMode((value) => !value);
    setSelectedIds(new Set());
  }

  return (
    <div className="view-stack transactions-page">
      <PageIntro
        description="搜索、筛选和管理当前用户已完整同步的账单缓存。"
        eyebrow="账单"
        icon={<ReceiptText size={24} />}
        title="每一笔都有来处"
      />

      <SectionBlock
        action={
          <div className="toolbar-row">
            <AppButton
              disabled={!isOnline || isSyncing}
              icon={<RefreshCw className={isSyncing ? "spin" : undefined} size={16} />}
              type="button"
              variant="secondary"
              onClick={() => void syncNow().catch(() => undefined)}
            >
              {isSyncing ? "同步中" : "刷新"}
            </AppButton>
            <AppButton
              type="button"
              variant={manageMode ? "primary" : "secondary"}
              onClick={toggleManageMode}
            >
              {manageMode ? "完成" : "管理"}
            </AppButton>
          </div>
        }
        className="transactions-filter-panel"
        description="筛选只影响当前列表，不会修改云端账单。"
        eyebrow="查找"
        title="筛选和汇总"
      >
        <form
          className="search-row"
          onSubmit={(event) => {
            event.preventDefault();
            applySearchFilter();
          }}
        >
          <input
            className="search-input"
            placeholder="搜索商家、备注或分类"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <AppButton icon={<Search size={16} />} type="submit" variant="secondary">
            搜索
          </AppButton>
        </form>

        <div className="chip-row">
          <Chip active={!filters.type} onClick={() => updateFilter("type", "")}>
            全部
          </Chip>
          {transactionTypeOptions.map((option) => (
            <Chip
              active={filters.type === option.value}
              key={option.value}
              onClick={() => updateFilter("type", option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>

        <div className="form-grid two">
          <label className="field">
            <span>分类</span>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="">全部分类</option>
              {defaultCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>排序</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilter("sort", event.target.value as TransactionSortOption)
              }
            >
              {transactionSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span>开始日期</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter("startDate", event.target.value)}
            />
          </label>
          <label className="field">
            <span>结束日期</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter("endDate", event.target.value)}
            />
          </label>
        </div>

        <div className="filter-summary">
          <span>支出 {formatCurrency(data?.summary.expense ?? 0)}</span>
          <span>收入 {formatCurrency(data?.summary.income ?? 0)}</span>
          <span>{data?.summary.count ?? 0} 笔</span>
        </div>

        {manageMode ? (
          <AppButton
            disabled={!isOnline || selectedIds.size === 0 || bulkDeleteMutation.isPending}
            icon={<Trash2 size={16} />}
            type="button"
            variant="danger"
            onClick={() => bulkDeleteMutation.mutate()}
          >
            删除已选 {selectedIds.size}
          </AppButton>
        ) : null}
      </SectionBlock>

      {!isOnline ? (
        <StateBlock title="离线缓存" tone="warning">
          当前只能查看已同步缓存，编辑和删除需要联网。
        </StateBlock>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}

      {editingTransaction ? (
        <SectionBlock eyebrow="编辑" title="修改账单">
          <TransactionForm
            defaultLedgerId={editingTransaction.ledger_id}
            initialTransaction={editingTransaction}
            isSubmitting={updateMutation.isPending}
            ledgerReadOnly={editingTransaction.source === "ai"}
            ledgers={ledgers}
            onCancel={() => setEditingTransaction(null)}
            onSubmit={(values) => updateMutation.mutateAsync(values)}
            submitLabel="保存修改"
          />
        </SectionBlock>
      ) : null}

      <TransactionList
        error={transactionsQuery.error}
        isLoading={transactionsQuery.isLoading}
        isOnline={isOnline}
        manageMode={manageMode}
        onDelete={(transactionId) => deleteMutation.mutate(transactionId)}
        onEdit={setEditingTransaction}
        onToggleSelected={toggleSelected}
        selectedIds={selectedIds}
        sort={filters.sort}
        transactions={data?.transactions ?? []}
      />

      {data?.hasMore ? (
        <AppButton type="button" variant="secondary" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}>
          加载更多
        </AppButton>
      ) : null}
    </div>
  );
}
