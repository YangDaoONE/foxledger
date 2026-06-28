import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { useAuthUser } from "@/auth/AuthProvider";
import { AppButton } from "@/components/ui/AppButton";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StateBlock } from "@/components/ui/StateBlock";
import { AiParsePanel } from "@/features/ai/AiParsePanel";
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
  const { isOnline, refreshAfterWrite } = useSyncState();
  const [isManualOpen, setIsManualOpen] = useState(false);
  const monthRange = useMemo(() => getPresetStatsRange("month"), []);

  const summaryQuery = useQuery({
    queryFn: () => getStatsForRange(user.id, monthRange),
    queryKey: ["monthlySummary", user.id, monthRange.startDate, monthRange.endDate],
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
    <div className="view-stack">
      <SectionBlock eyebrow="本月" title="概览">
        <div className="summary-grid">
          <div className="summary-card expense">
            <span>支出</span>
            <strong>{formatCurrency(summary?.expense ?? 0)}</strong>
          </div>
          <div className="summary-card income">
            <span>收入</span>
            <strong>{formatCurrency(summary?.income ?? 0)}</strong>
          </div>
          <div className="summary-card balance">
            <span>结余</span>
            <strong>{formatCurrency(summary?.balance ?? 0)}</strong>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock eyebrow="手动" title="新增账单">
        {!isOnline ? (
          <StateBlock title="离线缓存" tone="warning">
            当前只能查看已同步缓存，联网后可保存正式账单。
          </StateBlock>
        ) : null}

        {isManualOpen ? (
          <TransactionForm
            isSubmitting={createMutation.isPending}
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

      <AiParsePanel isOnline={isOnline} onSaved={refreshAfterWrite} userId={user.id} />
    </div>
  );
}
