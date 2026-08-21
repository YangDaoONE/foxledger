import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Plus, WalletCards } from "lucide-react";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StateBlock } from "@/components/ui/StateBlock";
import { useActiveLedger, useLedgerState } from "@/features/ledgers/LedgerProvider";
import { getStatsForRange } from "@/features/stats/statsApi";
import { getPresetStatsRange } from "@/features/stats/statsRanges";
import { useSyncState } from "@/features/sync/SyncProvider";
import {
  TransactionForm,
  type TransactionFormValues,
} from "@/features/transactions/TransactionForm";
import { createManualTransaction } from "@/features/transactions/transactionsApi";
import { formatCurrency } from "@/lib/format";

export function HomePage() {
  const user = useAuthUser();
  const activeLedger = useActiveLedger();
  const { ledgers } = useLedgerState();
  const { isOnline, refreshAfterWrite } = useSyncState();
  const [isManualOpen, setIsManualOpen] = useState(false);
  const monthRange = useMemo(() => getPresetStatsRange("month"), []);

  const summaryQuery = useQuery({
    queryFn: () => getStatsForRange(user.id, activeLedger.id, monthRange),
    queryKey: queryKeys.monthlySummary(
      user.id,
      activeLedger.id,
      monthRange.startDate,
      monthRange.endDate,
    ),
  });

  const createMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      await createManualTransaction(user.id, values);
      await refreshAfterWrite();
    },
    onSuccess: () => setIsManualOpen(false),
  });

  const summary = summaryQuery.data?.summary;

  return (
    <div className="view-stack home-page">
      <PageIntro
        description="手动记账、狐狐问账与离线缓存，都从同一本可靠账本出发。"
        eyebrow="今日账本"
        icon={<WalletCards size={24} />}
        title="收支清楚，记账轻松"
      />

      <SectionBlock
        className="home-summary"
        description={`${monthRange.startDate} 至 ${monthRange.endDate}`}
        eyebrow="本月"
        title="收支概览"
      >
        <div className="metric-grid compact">
          <MetricCard
            label="支出"
            tone="expense"
            value={formatCurrency(summary?.expense ?? 0)}
          />
          <MetricCard
            label="收入"
            tone="income"
            value={formatCurrency(summary?.income ?? 0)}
          />
          <MetricCard
            label="结余"
            tone="balance"
            value={formatCurrency(summary?.balance ?? 0)}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        className="home-manual"
        description="保存后会立即刷新云端数据和本地只读缓存。"
        eyebrow="手动"
        title="新增账单"
      >
        {!isOnline ? (
          <StateBlock title="离线缓存" tone="warning">
            当前只能查看已同步缓存，联网后可保存正式账单。
          </StateBlock>
        ) : null}

        {isManualOpen ? (
          <TransactionForm
            defaultLedgerId={activeLedger.id}
            isSubmitting={createMutation.isPending}
            ledgers={ledgers}
            onCancel={() => setIsManualOpen(false)}
            onSubmit={(values) => createMutation.mutateAsync(values)}
            submitLabel="保存账单"
          />
        ) : (
          <AppButton
            disabled={!isOnline}
            icon={<Plus size={16} />}
            type="button"
            onClick={() => setIsManualOpen(true)}
          >
            手动记账
          </AppButton>
        )}
      </SectionBlock>

      <Link className="chat-entry-card" to="/chat">
        <span className="chat-entry-icon"><MessageCircle size={24} aria-hidden="true" /></span>
        <span>
          <small>AI 记账与问账</small>
          <strong>和狐狐聊聊账本</strong>
          <em>一句话记账，或基于云端事实查看有依据的回答。</em>
        </span>
        <span aria-hidden="true">进入</span>
      </Link>
    </div>
  );
}
