import {
  calculateLedgerStatsEnvelope,
  type LedgerStatsTransaction,
} from "./ledgerAnalytics.ts";
import {
  createUserScopedSupabaseClient,
  type SupabaseClientFactory,
} from "./auth.ts";
import {
  LEDGER_QUERY_CATEGORIES,
  LEDGER_TRANSACTION_TYPES,
  isLedgerIsoDate,
  parseLedgerQueryPlan,
  type LedgerDateRange,
  type LedgerQueryFilters,
  type LedgerQueryPlan,
  type LedgerStatsEnvelope,
  type LedgerTransactionType,
} from "./ledgerContracts.ts";
import { readRuntimeEnv, type EdgeEnvReader } from "./edgeEnv.ts";

export const LEDGER_READ_SELECT = "id,user_id,date,type,amount,category,merchant";
export const LEDGER_READ_PAGE_SIZE = 500;
export const MAX_AI_LEDGER_DETAILS = 500;
const MAX_LEDGER_READ_PAGES = 1000;

export type LedgerAiDetail = {
  amount: number;
  category: string;
  date: string;
  merchant: string | null;
  type: LedgerTransactionType;
};

export type LedgerQueryOperationResult = {
  aiDetailCount: number;
  aiDetails: LedgerAiDetail[];
  aiDetailsTruncated: boolean;
  compareStats?: LedgerStatsEnvelope;
  matchedTransactionCount: number;
  stats: LedgerStatsEnvelope;
};

export type LedgerQueryExecutionResult = {
  operations: LedgerQueryOperationResult[];
  plan: LedgerQueryPlan;
};

type LedgerReadRow = LedgerStatsTransaction & {
  id: string;
  merchant: string | null;
  user_id: string;
};

type LedgerReadResponse = {
  data: unknown;
  error: { message?: string } | null;
};

export type LedgerReadQuery = PromiseLike<LedgerReadResponse> & {
  eq: (column: string, value: string) => LedgerReadQuery;
  gte: (column: string, value: string) => LedgerReadQuery;
  lte: (column: string, value: string) => LedgerReadQuery;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => LedgerReadQuery;
  range: (from: number, to: number) => LedgerReadQuery;
  select: (columns: string) => LedgerReadQuery;
};

export type LedgerReadClient = {
  from: (table: "transactions") => LedgerReadQuery;
};

function isAllowedTransactionType(value: unknown): value is LedgerTransactionType {
  return (
    typeof value === "string" &&
    LEDGER_TRANSACTION_TYPES.includes(value as LedgerTransactionType)
  );
}

function isAllowedCategory(value: unknown): value is string {
  return (
    typeof value === "string" &&
    LEDGER_QUERY_CATEGORIES.includes(value as (typeof LEDGER_QUERY_CATEGORIES)[number])
  );
}

function normalizeLedgerCategory(value: unknown) {
  if (value !== null && typeof value !== "string") {
    throw new Error("账单查询发现无效分类字段，未生成部分统计。");
  }

  const category = value?.trim() ?? "";
  return isAllowedCategory(category) ? category : "其他";
}

function normalizeLedgerReadRow(value: unknown, verifiedUserId: string): LedgerReadRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("账单查询返回了无效行，未生成部分统计。");
  }

  const row = value as Record<string, unknown>;
  const amount =
    typeof row.amount === "number"
      ? row.amount
      : typeof row.amount === "string" && row.amount.trim()
        ? Number(row.amount)
        : Number.NaN;

  if (typeof row.id !== "string" || !row.id) {
    throw new Error("账单查询返回了无效 transaction ID，未生成部分统计。");
  }

  if (row.user_id !== verifiedUserId) {
    throw new Error("账单查询返回了不属于当前用户的数据，未生成部分统计。");
  }

  if (typeof row.date !== "string" || !isLedgerIsoDate(row.date)) {
    throw new Error("账单查询发现无效日期字段，未生成部分统计。");
  }

  if (!isAllowedTransactionType(row.type)) {
    throw new Error("账单查询发现无效类型字段，未生成部分统计。");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("账单查询发现无效金额字段，未生成部分统计。");
  }

  if (row.merchant !== null && typeof row.merchant !== "string") {
    throw new Error("账单查询发现无效商家字段，未生成部分统计。");
  }

  const category = normalizeLedgerCategory(row.category);

  return {
    amount,
    category,
    date: row.date,
    id: row.id,
    merchant: row.merchant?.trim() || null,
    type: row.type,
    user_id: verifiedUserId,
  };
}

async function readCompleteRange(params: {
  client: LedgerReadClient;
  range: LedgerDateRange;
  verifiedUserId: string;
}) {
  const rows: LedgerReadRow[] = [];
  const seenIds = new Set<string>();

  for (let page = 0; page < MAX_LEDGER_READ_PAGES; page += 1) {
    const from = page * LEDGER_READ_PAGE_SIZE;
    const to = from + LEDGER_READ_PAGE_SIZE - 1;
    const response = await params.client
      .from("transactions")
      .select(LEDGER_READ_SELECT)
      .eq("user_id", params.verifiedUserId)
      .gte("date", params.range.startDate)
      .lte("date", params.range.endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (response.error) {
      throw new Error(
        `账单分页读取失败：${response.error.message ?? "未知错误"}。未生成部分统计。`,
      );
    }

    if (!Array.isArray(response.data)) {
      throw new Error("账单分页读取没有返回完整数组，未生成部分统计。");
    }

    const pageRows = response.data.map((row) =>
      normalizeLedgerReadRow(row, params.verifiedUserId),
    );

    for (const row of pageRows) {
      if (seenIds.has(row.id)) {
        throw new Error("账单分页读取出现重复行，未生成部分统计。");
      }

      seenIds.add(row.id);
      rows.push(row);
    }

    if (pageRows.length < LEDGER_READ_PAGE_SIZE) {
      return rows;
    }
  }

  throw new Error("账单分页读取超过安全页数，未生成部分统计。");
}

function applyLedgerQueryFilters(rows: LedgerReadRow[], filters: LedgerQueryFilters) {
  const typeSet = new Set(filters.types);
  const categorySet = new Set(filters.categories);
  const merchantSet = new Set(filters.merchants);
  const keyword = filters.keyword?.toLocaleLowerCase("zh-CN") ?? null;

  return rows.filter((row) => {
    const amount = Math.abs(row.amount);

    if (typeSet.size > 0 && !typeSet.has(row.type)) {
      return false;
    }

    if (categorySet.size > 0 && !categorySet.has(row.category)) {
      return false;
    }

    if (merchantSet.size > 0 && (!row.merchant || !merchantSet.has(row.merchant))) {
      return false;
    }

    if (filters.minAmount !== null && amount < filters.minAmount) {
      return false;
    }

    if (filters.maxAmount !== null && amount > filters.maxAmount) {
      return false;
    }

    if (keyword) {
      const values = [row.category, row.merchant]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLocaleLowerCase("zh-CN"));

      if (!values.some((value) => value.includes(keyword))) {
        return false;
      }
    }

    return true;
  });
}

function compareByAmountThenDate(first: LedgerReadRow, second: LedgerReadRow) {
  return (
    Math.abs(second.amount) - Math.abs(first.amount) ||
    second.date.localeCompare(first.date) ||
    first.id.localeCompare(second.id)
  );
}

function compareByDateThenAmount(first: LedgerReadRow, second: LedgerReadRow) {
  return (
    second.date.localeCompare(first.date) ||
    Math.abs(second.amount) - Math.abs(first.amount) ||
    first.id.localeCompare(second.id)
  );
}

function selectEvenlySpacedRows(rows: LedgerReadRow[], count: number) {
  if (count <= 0 || rows.length === 0) {
    return [];
  }

  if (rows.length <= count) {
    return rows;
  }

  if (count === 1) {
    return [rows[Math.floor((rows.length - 1) / 2)]];
  }

  const selected: LedgerReadRow[] = [];
  const selectedIndexes = new Set<number>();

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.round((index * (rows.length - 1)) / (count - 1));

    if (!selectedIndexes.has(sourceIndex)) {
      selectedIndexes.add(sourceIndex);
      selected.push(rows[sourceIndex]);
    }
  }

  return selected;
}

export function selectLedgerAiDetails(
  rows: LedgerReadRow[],
  limit = MAX_AI_LEDGER_DETAILS,
): LedgerAiDetail[] {
  const safeLimit = Math.max(0, Math.min(Math.floor(limit), MAX_AI_LEDGER_DETAILS));

  if (safeLimit === 0) {
    return [];
  }

  let selectedRows: LedgerReadRow[];

  if (rows.length <= safeLimit) {
    selectedRows = [...rows];
  } else {
    const extremeCount = Math.ceil(safeLimit / 2);
    const temporalCount = safeLimit - extremeCount;
    const extremeRows = [...rows].sort(compareByAmountThenDate).slice(0, extremeCount);
    const selectedIds = new Set(extremeRows.map((row) => row.id));
    const temporalPool = rows
      .filter((row) => !selectedIds.has(row.id))
      .sort((first, second) =>
        first.date.localeCompare(second.date) || first.id.localeCompare(second.id),
      );
    const temporalRows = selectEvenlySpacedRows(temporalPool, temporalCount);
    selectedRows = [...extremeRows, ...temporalRows];
  }

  return selectedRows.sort(compareByDateThenAmount).map((row) => ({
    amount: Math.abs(row.amount),
    category: row.category,
    date: row.date,
    merchant: row.merchant,
    type: row.type,
  }));
}

function addExpenseComparison(
  stats: LedgerStatsEnvelope,
  compareStats: LedgerStatsEnvelope,
) {
  const absoluteChange = stats.summary.expense - compareStats.summary.expense;
  const percentChange =
    compareStats.summary.expense === 0
      ? null
      : (absoluteChange / compareStats.summary.expense) * 100;

  return {
    ...stats,
    comparison: {
      absoluteChange,
      baseRange: compareStats.range,
      percentChange,
    },
  };
}

function uniqueRowsById(rows: LedgerReadRow[]) {
  const uniqueRows = new Map<string, LedgerReadRow>();

  for (const row of rows) {
    uniqueRows.set(row.id, row);
  }

  return Array.from(uniqueRows.values());
}

export async function executeLedgerQueryPlan(params: {
  accessToken: string;
  createClient: SupabaseClientFactory<LedgerReadClient>;
  plan: unknown;
  readEnv?: EdgeEnvReader;
  verifiedUserId: string;
}): Promise<LedgerQueryExecutionResult> {
  const plan = parseLedgerQueryPlan(params.plan);
  const client = createUserScopedSupabaseClient(
    params.accessToken,
    params.createClient,
    params.readEnv ?? readRuntimeEnv,
  );
  const operations: LedgerQueryOperationResult[] = [];

  for (const operation of plan.operations) {
    const primaryRows = applyLedgerQueryFilters(
      await readCompleteRange({
        client,
        range: operation.range,
        verifiedUserId: params.verifiedUserId,
      }),
      operation.filters,
    );
    let stats = calculateLedgerStatsEnvelope(primaryRows, operation.range);
    let compareStats: LedgerStatsEnvelope | undefined;
    let detailRows = primaryRows;

    if (operation.compareRange) {
      const compareRows = applyLedgerQueryFilters(
        await readCompleteRange({
          client,
          range: operation.compareRange,
          verifiedUserId: params.verifiedUserId,
        }),
        operation.filters,
      );
      compareStats = calculateLedgerStatsEnvelope(compareRows, operation.compareRange);
      stats = addExpenseComparison(stats, compareStats);
      detailRows = uniqueRowsById([...primaryRows, ...compareRows]);
    }

    const aiDetails = selectLedgerAiDetails(detailRows);
    operations.push({
      aiDetailCount: aiDetails.length,
      aiDetails,
      aiDetailsTruncated: detailRows.length > aiDetails.length,
      compareStats,
      matchedTransactionCount: detailRows.length,
      stats,
    });
  }

  return { operations, plan };
}
