import { supabase } from "@/lib/supabase";
import {
  DEFAULT_CURRENCY,
  normalizeDefaultCategory,
} from "@/lib/transactionRules";
import type { Transaction, TransactionType } from "@/types/transaction";

type TransactionRow = Omit<Transaction, "amount" | "currency"> & {
  amount: number | string;
  currency: string;
};

export type EditableTransactionValues = {
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  note: string | null;
};

type UpdatedTransactionResult = {
  id: string;
  updated_at: string;
};

type DeletedTransactionResult = {
  id: string;
};

type ListTransactionsOptions = {
  limit?: number;
};

export type TransactionSortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export type TransactionPageFilters = {
  search?: string;
  type?: TransactionType | null;
  category?: string | null;
  startDate?: string;
  endDate?: string;
  sort?: TransactionSortOption;
  limit: number;
  offset: number;
};

export type TransactionFilterSummary = {
  expense: number;
  income: number;
  count: number;
};

export type TransactionPageResult = {
  transactions: Transaction[];
  summary: TransactionFilterSummary;
  hasMore: boolean;
  totalCount: number;
};

const noEditableTransactionMessage = "未找到可编辑的账单，或你没有权限修改这条记录。";
const noDeletableTransactionMessage = "未找到可删除的账单，或你没有权限删除这条记录。";
const summaryPageSize = 1000;
const remoteSyncPageSize = 1000;

const transactionSelectColumns = [
  "id",
  "user_id",
  "type",
  "amount",
  "currency",
  "category",
  "tag",
  "merchant",
  "payment_method",
  "account",
  "date",
  "note",
  "raw_text",
  "source",
  "ai_confidence",
  "created_at",
  "updated_at",
].join(",");

function normalizeTransaction(row: TransactionRow): Transaction {
  return {
    ...row,
    amount: Number(row.amount),
    currency: DEFAULT_CURRENCY,
  };
}

function sanitizeSearchTerm(value: string | undefined) {
  return (value ?? "")
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function listTransactions(options: ListTransactionsOptions = {}): Promise<Transaction[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后查看账单。");
  }

  let query = supabase
    .from("transactions")
    .select(transactionSelectColumns)
    .eq("user_id", userData.user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as TransactionRow[]).map(normalizeTransaction);
}

export async function listTransactionsPage(
  filters: TransactionPageFilters,
): Promise<TransactionPageResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后查看账单。");
  }

  const searchTerm = sanitizeSearchTerm(filters.search);
  const startDate = filters.startDate?.trim() ?? "";
  const endDate = filters.endDate?.trim() ?? "";
  const category = filters.category?.trim() ?? "";
  const limit = Math.max(filters.limit, 1);
  const offset = Math.max(filters.offset, 0);
  const sort = filters.sort ?? "date-desc";

  let pageQuery = supabase
    .from("transactions")
    .select(transactionSelectColumns, { count: "exact" })
    .eq("user_id", userData.user.id);

  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    pageQuery = pageQuery.or(
      `merchant.ilike.${pattern},note.ilike.${pattern},category.ilike.${pattern}`,
    );
  }

  if (filters.type) {
    pageQuery = pageQuery.eq("type", filters.type);
  }

  if (category) {
    pageQuery = pageQuery.eq("category", category);
  }

  if (startDate) {
    pageQuery = pageQuery.gte("date", startDate);
  }

  if (endDate) {
    pageQuery = pageQuery.lte("date", endDate);
  }

  if (sort === "date-asc") {
    pageQuery = pageQuery.order("date", { ascending: true }).order("created_at", { ascending: true });
  } else if (sort === "amount-desc") {
    pageQuery = pageQuery.order("amount", { ascending: false }).order("date", { ascending: false });
  } else if (sort === "amount-asc") {
    pageQuery = pageQuery.order("amount", { ascending: true }).order("date", { ascending: false });
  } else {
    pageQuery = pageQuery.order("date", { ascending: false }).order("created_at", { ascending: false });
  }

  const { data, error, count } = await pageQuery.range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  const summaryRows: Array<{ type: TransactionType; amount: number | string }> = [];
  let summaryOffset = 0;

  while (true) {
    let summaryQuery = supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userData.user.id)
      .order("id", { ascending: true });

    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      summaryQuery = summaryQuery.or(
        `merchant.ilike.${pattern},note.ilike.${pattern},category.ilike.${pattern}`,
      );
    }

    if (filters.type) {
      summaryQuery = summaryQuery.eq("type", filters.type);
    }

    if (category) {
      summaryQuery = summaryQuery.eq("category", category);
    }

    if (startDate) {
      summaryQuery = summaryQuery.gte("date", startDate);
    }

    if (endDate) {
      summaryQuery = summaryQuery.lte("date", endDate);
    }

    const { data: summaryPageRows, error: summaryError } = await summaryQuery.range(
      summaryOffset,
      summaryOffset + summaryPageSize - 1,
    );

    if (summaryError) {
      throw new Error(summaryError.message);
    }

    const currentRows = (summaryPageRows ?? []) as Array<{
      type: TransactionType;
      amount: number | string;
    }>;
    summaryRows.push(...currentRows);

    if (currentRows.length < summaryPageSize) {
      break;
    }

    summaryOffset += summaryPageSize;
  }

  const summary = summaryRows.reduce(
    (current, row) => {
      const amount = Math.abs(Number(row.amount));

      if (row.type === "expense") {
        return { ...current, expense: current.expense + amount, count: current.count + 1 };
      }

      if (row.type === "income") {
        return { ...current, income: current.income + amount, count: current.count + 1 };
      }

      return { ...current, count: current.count + 1 };
    },
    { expense: 0, income: 0, count: 0 },
  );

  const transactions = ((data ?? []) as unknown as TransactionRow[]).map(normalizeTransaction);
  const totalCount = count ?? summary.count;

  return {
    transactions,
    summary,
    hasMore: offset + transactions.length < totalCount,
    totalCount,
  };
}

export async function listAllRemoteTransactionsForCurrentUser(): Promise<Transaction[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后同步账单。");
  }

  const rows: Transaction[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select(transactionSelectColumns)
      .eq("user_id", userData.user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + remoteSyncPageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const currentRows = ((data ?? []) as unknown as TransactionRow[]).map(normalizeTransaction);
    rows.push(...currentRows);

    if (currentRows.length < remoteSyncPageSize) {
      break;
    }

    offset += remoteSyncPageSize;
  }

  return rows;
}

export async function updateTransaction(
  transaction: Transaction,
  values: EditableTransactionValues,
): Promise<UpdatedTransactionResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后再编辑账单。");
  }

  const updatePayload: EditableTransactionValues = {
    type: values.type,
    amount: values.amount,
    category: normalizeDefaultCategory(values.category),
    date: values.date,
    merchant: values.merchant,
    payment_method: values.payment_method,
    note: values.note,
  };

  const { data, error } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", transaction.id)
    .eq("user_id", userData.user.id)
    .select("id, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error(noEditableTransactionMessage);
    }

    throw new Error(error.message);
  }

  const updatedTransaction = data as unknown as UpdatedTransactionResult | null;

  if (!updatedTransaction?.id) {
    throw new Error(noEditableTransactionMessage);
  }

  return updatedTransaction;
}

export async function deleteTransaction(transactionId: string): Promise<DeletedTransactionResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后再删除账单");
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userData.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const deletedTransaction = data as unknown as DeletedTransactionResult | null;

  if (!deletedTransaction?.id) {
    throw new Error(noDeletableTransactionMessage);
  }

  return deletedTransaction;
}

export async function deleteTransactionsByIds(transactionIds: string[]): Promise<number> {
  const uniqueIds = Array.from(new Set(transactionIds.map((id) => id.trim()).filter(Boolean)));

  if (uniqueIds.length === 0) {
    throw new Error("请选择要删除的账单。");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData.user) {
    throw new Error("请先登录后再删除账单。");
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .in("id", uniqueIds)
    .eq("user_id", userData.user.id)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length;
}
