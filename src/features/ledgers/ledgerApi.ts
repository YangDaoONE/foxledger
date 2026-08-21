import {
  DEFAULT_LEDGER_NAME,
  MAX_LEDGER_COUNT,
  MAX_LEDGER_NAME_LENGTH,
  type CachedLedger,
} from "@/features/ledgers/types";
import { supabase } from "@/lib/supabase";

export const LEDGER_CACHE_SELECT =
  "id,user_id,name,created_at,updated_at";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RemoteLedgerRow = {
  created_at: unknown;
  id: unknown;
  name: unknown;
  updated_at: unknown;
  user_id: unknown;
};

type LedgerApiError = {
  code?: string;
  message?: string;
};

export function normalizeLedgerName(value: string) {
  const name = value.trim();

  if (!name) {
    throw new Error("账本名称不能为空。");
  }

  if (name.length > MAX_LEDGER_NAME_LENGTH) {
    throw new Error(`账本名称不能超过 ${MAX_LEDGER_NAME_LENGTH} 个字符。`);
  }

  return name;
}

export function normalizeRemoteLedgerRow(
  value: RemoteLedgerRow,
  userId: string,
): CachedLedger {
  if (value.user_id !== userId) {
    throw new Error("远端返回了不属于当前用户的账本。");
  }

  if (typeof value.id !== "string" || !uuidPattern.test(value.id)) {
    throw new Error("远端账本 ID 格式异常。");
  }

  if (typeof value.name !== "string") {
    throw new Error("远端账本名称格式异常。");
  }

  const name = normalizeLedgerName(value.name);

  if (name !== value.name) {
    throw new Error("远端账本名称包含未清理的空格。");
  }

  if (
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    throw new Error("远端账本时间格式异常。");
  }

  return {
    cache_key: `${userId}:${value.id}`,
    created_at: value.created_at,
    id: value.id,
    name,
    updated_at: value.updated_at,
    user_id: userId,
  };
}

export async function fetchRemoteLedgersForUser(userId: string) {
  const { data, error } = await supabase
    .from("ledgers")
    .select(LEDGER_CACHE_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    throw new Error("远端账本没有返回完整数组。");
  }

  return (data as RemoteLedgerRow[]).map((row) =>
    normalizeRemoteLedgerRow(row, userId),
  );
}

export async function ensureDefaultLedgerForUser(userId: string) {
  let ledgers = await fetchRemoteLedgersForUser(userId);

  if (ledgers.length > 0) {
    return ledgers;
  }

  const { error } = await supabase.from("ledgers").insert({
    name: DEFAULT_LEDGER_NAME,
    user_id: userId,
  });

  if (error && !isUniqueViolation(error)) {
    throw new Error(error.message);
  }

  ledgers = await fetchRemoteLedgersForUser(userId);

  if (ledgers.length === 0) {
    throw new Error("默认账本初始化失败，请重新同步。");
  }

  return ledgers;
}

export async function createLedger(userId: string, rawName: string) {
  const name = normalizeLedgerName(rawName);
  const ledgers = await fetchRemoteLedgersForUser(userId);

  if (ledgers.length >= MAX_LEDGER_COUNT) {
    throw new Error(`每个账号最多创建 ${MAX_LEDGER_COUNT} 个账本。`);
  }

  if (ledgers.some((ledger) => ledger.name === name)) {
    throw new Error("已经存在同名账本。");
  }

  const { data, error } = await supabase
    .from("ledgers")
    .insert({ name, user_id: userId })
    .select(LEDGER_CACHE_SELECT)
    .single();

  if (error) {
    throw new Error(getLedgerWriteError(error));
  }

  return normalizeRemoteLedgerRow(data as RemoteLedgerRow, userId);
}

export async function renameLedger(
  userId: string,
  ledgerId: string,
  rawName: string,
) {
  const name = normalizeLedgerName(rawName);
  const { data, error } = await supabase
    .from("ledgers")
    .update({ name })
    .eq("id", ledgerId)
    .eq("user_id", userId)
    .select(LEDGER_CACHE_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(getLedgerWriteError(error));
  }

  if (!data) {
    throw new Error("未找到可重命名的账本，或当前账号没有权限。");
  }

  return normalizeRemoteLedgerRow(data as RemoteLedgerRow, userId);
}

export async function deleteEmptyLedger(
  userId: string,
  ledgerId: string,
) {
  const ledgers = await fetchRemoteLedgersForUser(userId);

  if (ledgers.length <= 1) {
    throw new Error("最后一个账本不能删除。");
  }

  if (!ledgers.some((ledger) => ledger.id === ledgerId)) {
    throw new Error("未找到可删除的账本，或当前账号没有权限。");
  }

  const { data, error } = await supabase
    .from("ledgers")
    .delete()
    .eq("id", ledgerId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(getLedgerWriteError(error));
  }

  if (!data?.id) {
    throw new Error("未找到可删除的账本，或当前账号没有权限。");
  }
}

function isUniqueViolation(error: LedgerApiError) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "23505" || message.includes("unique");
}

function getLedgerWriteError(error: LedgerApiError) {
  const message = error.message?.toLowerCase() ?? "";

  if (isUniqueViolation(error)) {
    return "已经存在同名账本。";
  }

  if (message.includes("last ledger")) {
    return "最后一个账本不能删除。";
  }

  if (
    error.code === "23503" ||
    message.includes("foreign key") ||
    message.includes("still referenced")
  ) {
    return "这个账本还有账单，不能直接删除。请先处理其中的账单。";
  }

  if (message.includes("permission") || message.includes("rls")) {
    return "当前账号没有管理这个账本的权限。";
  }

  return error.message ?? "账本操作失败。";
}
