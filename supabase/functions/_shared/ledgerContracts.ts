const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const LEDGER_TRANSACTION_TYPES = ["expense", "income", "transfer"] as const;
export const LEDGER_QUERY_CATEGORIES = [
  "餐饮",
  "交通",
  "购物",
  "住房",
  "学习",
  "医疗",
  "娱乐",
  "日用",
  "旅行",
  "订阅",
  "人情",
  "收入",
  "转账",
  "其他",
] as const;
export const LEDGER_ANSWER_GOALS = [
  "lookup",
  "summary",
  "comparison",
  "trend",
  "explanation",
] as const;
export const LEDGER_METRICS = [
  "count",
  "expense",
  "income",
  "balance",
  "average_daily_expense",
  "max_expense",
] as const;
export const LEDGER_GROUPS = [
  "day",
  "week",
  "month",
  "category",
  "merchant",
  "type",
] as const;
export const LEDGER_ORDERS = [
  "date_asc",
  "date_desc",
  "amount_asc",
  "amount_desc",
] as const;

export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];
export type LedgerAnswerGoal = (typeof LEDGER_ANSWER_GOALS)[number];
export type LedgerMetric = (typeof LEDGER_METRICS)[number];
export type LedgerGroup = (typeof LEDGER_GROUPS)[number];
export type LedgerOrder = (typeof LEDGER_ORDERS)[number];

export type LedgerDateRange = {
  endDate: string;
  label: string;
  startDate: string;
};

export type LedgerQueryFilters = {
  categories: string[];
  keyword: string | null;
  maxAmount: number | null;
  merchants: string[];
  minAmount: number | null;
  types: LedgerTransactionType[];
};

export type LedgerQueryOperation = {
  compareRange?: LedgerDateRange;
  filters: LedgerQueryFilters;
  groupBy: LedgerGroup[];
  metrics: LedgerMetric[];
  order: LedgerOrder;
  range: LedgerDateRange;
};

export type LedgerQueryPlan = {
  answer_goal: LedgerAnswerGoal;
  operations: LedgerQueryOperation[];
};

export type LedgerStatsEnvelope = {
  averageDailyExpense: number;
  categorySpend: Array<{ amount: number; category: string }>;
  comparison?: {
    absoluteChange: number;
    baseRange: LedgerDateRange;
    percentChange: number | null;
  };
  dailySpend: Array<{ amount: number; date: string }>;
  merchantSpend: Array<{ amount: number; count: number; merchant: string }>;
  maxExpenseAmount: number;
  range: LedgerDateRange;
  summary: {
    balance: number;
    expense: number;
    income: number;
  };
  transactionCount: number;
  typeBreakdown: Array<{
    amount: number;
    count: number;
    type: LedgerTransactionType;
  }>;
};

export type GroundedLedgerAnswer = {
  answerTemplate: string;
  evidenceRefs: string[];
  metricRefs: string[];
  suggestion: string | null;
};

export class LedgerContractError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`契约字段 ${path} ${message}`);
    this.name = "LedgerContractError";
  }
}

function fail(path: string, message: string): never {
  throw new LedgerContractError(path, message);
}

function readStrictObject(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(path, "必须是对象。");
  }

  const record = value as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    return fail(path, `包含未知字段：${unknownKeys.join(", ")}。`);
  }

  return record;
}

function readArray(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    return fail(path, "必须是数组。");
  }

  return value;
}

function readTrimmedString(value: unknown, path: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(path, "必须是非空字符串。");
  }

  return value.trim();
}

function readNullableString(value: unknown, path: string) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return fail(path, "必须是字符串或 null。");
  }

  return value.trim() || null;
}

function readFiniteNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(path, "必须是有限数字。");
  }

  return value;
}

function readNonNegativeNumber(value: unknown, path: string) {
  const result = readFiniteNumber(value, path);

  if (result < 0) {
    return fail(path, "不能小于 0。");
  }

  return result;
}

function readNullableNonNegativeNumber(value: unknown, path: string) {
  return value === null ? null : readNonNegativeNumber(value, path);
}

function readNonNegativeInteger(value: unknown, path: string) {
  const result = readNonNegativeNumber(value, path);

  if (!Number.isInteger(result)) {
    return fail(path, "必须是整数。");
  }

  return result;
}

function readEnum<const Values extends readonly string[]>(
  value: unknown,
  path: string,
  allowedValues: Values,
): Values[number] {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    return fail(path, `必须是以下值之一：${allowedValues.join(", ")}。`);
  }

  return value as Values[number];
}

function readEnumArray<const Values extends readonly string[]>(
  value: unknown,
  path: string,
  allowedValues: Values,
  options: { allowEmpty: boolean },
): Values[number][] {
  const values = readArray(value, path).map((item, index) =>
    readEnum(item, `${path}[${index}]`, allowedValues),
  );

  if (!options.allowEmpty && values.length === 0) {
    return fail(path, "不能为空数组。");
  }

  if (new Set(values).size !== values.length) {
    return fail(path, "不能包含重复值。");
  }

  return values;
}

function readStringArray(value: unknown, path: string) {
  const values = readArray(value, path).map((item, index) =>
    readTrimmedString(item, `${path}[${index}]`),
  );

  if (new Set(values).size !== values.length) {
    return fail(path, "不能包含重复值。");
  }

  return values;
}

export function isLedgerIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function readDate(value: unknown, path: string) {
  if (typeof value !== "string" || !isLedgerIsoDate(value)) {
    return fail(path, "必须是有效的 YYYY-MM-DD 日期。");
  }

  return value;
}

function parseDateRange(value: unknown, path: string): LedgerDateRange {
  const range = readStrictObject(value, path, ["endDate", "label", "startDate"]);
  const startDate = readDate(range.startDate, `${path}.startDate`);
  const endDate = readDate(range.endDate, `${path}.endDate`);

  if (startDate > endDate) {
    return fail(path, "开始日期不能晚于结束日期。");
  }

  return {
    endDate,
    label: readTrimmedString(range.label, `${path}.label`),
    startDate,
  };
}

function parseQueryFilters(value: unknown, path: string): LedgerQueryFilters {
  const filters = readStrictObject(value, path, [
    "categories",
    "keyword",
    "maxAmount",
    "merchants",
    "minAmount",
    "types",
  ]);
  const minAmount = readNullableNonNegativeNumber(filters.minAmount, `${path}.minAmount`);
  const maxAmount = readNullableNonNegativeNumber(filters.maxAmount, `${path}.maxAmount`);

  if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
    return fail(path, "最小金额不能大于最大金额。");
  }

  return {
    categories: readEnumArray(
      filters.categories,
      `${path}.categories`,
      LEDGER_QUERY_CATEGORIES,
      { allowEmpty: true },
    ),
    keyword: readNullableString(filters.keyword, `${path}.keyword`),
    maxAmount,
    merchants: readStringArray(filters.merchants, `${path}.merchants`),
    minAmount,
    types: readEnumArray(
      filters.types,
      `${path}.types`,
      LEDGER_TRANSACTION_TYPES,
      { allowEmpty: true },
    ),
  };
}

function parseQueryOperation(value: unknown, path: string): LedgerQueryOperation {
  const operation = readStrictObject(value, path, [
    "compareRange",
    "filters",
    "groupBy",
    "metrics",
    "order",
    "range",
  ]);
  const result: LedgerQueryOperation = {
    filters: parseQueryFilters(operation.filters, `${path}.filters`),
    groupBy: readEnumArray(operation.groupBy, `${path}.groupBy`, LEDGER_GROUPS, {
      allowEmpty: true,
    }),
    metrics: readEnumArray(operation.metrics, `${path}.metrics`, LEDGER_METRICS, {
      allowEmpty: false,
    }),
    order: readEnum(operation.order, `${path}.order`, LEDGER_ORDERS),
    range: parseDateRange(operation.range, `${path}.range`),
  };

  if (operation.compareRange !== undefined) {
    result.compareRange = parseDateRange(operation.compareRange, `${path}.compareRange`);
  }

  return result;
}

export function parseLedgerQueryPlan(value: unknown): LedgerQueryPlan {
  const plan = readStrictObject(value, "plan", ["answer_goal", "operations"]);
  const operations = readArray(plan.operations, "plan.operations").map((operation, index) =>
    parseQueryOperation(operation, `plan.operations[${index}]`),
  );

  if (operations.length === 0) {
    return fail("plan.operations", "不能为空数组。");
  }

  return {
    answer_goal: readEnum(plan.answer_goal, "plan.answer_goal", LEDGER_ANSWER_GOALS),
    operations,
  };
}

function parseCategorySpend(value: unknown, path: string) {
  return readArray(value, path).map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const row = readStrictObject(item, itemPath, ["amount", "category"]);

    return {
      amount: readNonNegativeNumber(row.amount, `${itemPath}.amount`),
      category: readEnum(row.category, `${itemPath}.category`, LEDGER_QUERY_CATEGORIES),
    };
  });
}

function parseDailySpend(value: unknown, path: string) {
  return readArray(value, path).map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const row = readStrictObject(item, itemPath, ["amount", "date"]);

    return {
      amount: readNonNegativeNumber(row.amount, `${itemPath}.amount`),
      date: readDate(row.date, `${itemPath}.date`),
    };
  });
}

function parseMerchantSpend(value: unknown, path: string) {
  return readArray(value, path).map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const row = readStrictObject(item, itemPath, ["amount", "count", "merchant"]);

    return {
      amount: readNonNegativeNumber(row.amount, `${itemPath}.amount`),
      count: readNonNegativeInteger(row.count, `${itemPath}.count`),
      merchant: readTrimmedString(row.merchant, `${itemPath}.merchant`),
    };
  });
}

function parseTypeBreakdown(value: unknown, path: string) {
  return readArray(value, path).map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const row = readStrictObject(item, itemPath, ["amount", "count", "type"]);

    return {
      amount: readNonNegativeNumber(row.amount, `${itemPath}.amount`),
      count: readNonNegativeInteger(row.count, `${itemPath}.count`),
      type: readEnum(row.type, `${itemPath}.type`, LEDGER_TRANSACTION_TYPES),
    };
  });
}

function parseComparison(value: unknown, path: string) {
  const comparison = readStrictObject(value, path, [
    "absoluteChange",
    "baseRange",
    "percentChange",
  ]);

  return {
    absoluteChange: readFiniteNumber(comparison.absoluteChange, `${path}.absoluteChange`),
    baseRange: parseDateRange(comparison.baseRange, `${path}.baseRange`),
    percentChange:
      comparison.percentChange === null
        ? null
        : readFiniteNumber(comparison.percentChange, `${path}.percentChange`),
  };
}

export function parseLedgerStatsEnvelope(value: unknown): LedgerStatsEnvelope {
  const envelope = readStrictObject(value, "stats", [
    "averageDailyExpense",
    "categorySpend",
    "comparison",
    "dailySpend",
    "merchantSpend",
    "maxExpenseAmount",
    "range",
    "summary",
    "transactionCount",
    "typeBreakdown",
  ]);
  const summary = readStrictObject(envelope.summary, "stats.summary", [
    "balance",
    "expense",
    "income",
  ]);
  const result: LedgerStatsEnvelope = {
    averageDailyExpense: readNonNegativeNumber(
      envelope.averageDailyExpense,
      "stats.averageDailyExpense",
    ),
    categorySpend: parseCategorySpend(envelope.categorySpend, "stats.categorySpend"),
    dailySpend: parseDailySpend(envelope.dailySpend, "stats.dailySpend"),
    merchantSpend: parseMerchantSpend(envelope.merchantSpend, "stats.merchantSpend"),
    maxExpenseAmount: readNonNegativeNumber(
      envelope.maxExpenseAmount,
      "stats.maxExpenseAmount",
    ),
    range: parseDateRange(envelope.range, "stats.range"),
    summary: {
      balance: readFiniteNumber(summary.balance, "stats.summary.balance"),
      expense: readNonNegativeNumber(summary.expense, "stats.summary.expense"),
      income: readNonNegativeNumber(summary.income, "stats.summary.income"),
    },
    transactionCount: readNonNegativeInteger(
      envelope.transactionCount,
      "stats.transactionCount",
    ),
    typeBreakdown: parseTypeBreakdown(envelope.typeBreakdown, "stats.typeBreakdown"),
  };

  if (envelope.comparison !== undefined) {
    result.comparison = parseComparison(envelope.comparison, "stats.comparison");
  }

  return result;
}

export function parseGroundedLedgerAnswer(value: unknown): GroundedLedgerAnswer {
  const answer = readStrictObject(value, "answer", [
    "answerTemplate",
    "evidenceRefs",
    "metricRefs",
    "suggestion",
  ]);

  return {
    answerTemplate: readTrimmedString(answer.answerTemplate, "answer.answerTemplate"),
    evidenceRefs: readStringArray(answer.evidenceRefs, "answer.evidenceRefs"),
    metricRefs: readStringArray(answer.metricRefs, "answer.metricRefs"),
    suggestion: readNullableString(answer.suggestion, "answer.suggestion"),
  };
}
