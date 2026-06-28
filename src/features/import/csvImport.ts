import type { TransactionSource, TransactionType } from "@/features/transactions/types";
import {
  DEFAULT_CURRENCY,
  isTransactionType,
  normalizeDefaultCategory,
  toNullableText,
} from "@/features/transactions/transactionRules";
import { isValidIsoDate } from "@/lib/date";

export type CsvImportTransaction = {
  account: string | null;
  amount: number;
  category: string;
  currency: "CNY";
  date: string;
  merchant: string | null;
  note: string | null;
  payment_method: string | null;
  raw_text: string | null;
  source: TransactionSource;
  tag: string | null;
  type: TransactionType;
};

export type CsvImportValidRow = {
  rowNumber: number;
  transaction: CsvImportTransaction;
};

export type CsvImportErrorRow = {
  raw: string[];
  reasons: string[];
  rowNumber: number;
};

export type CsvImportResult = {
  errorRows: CsvImportErrorRow[];
  fileError: string | null;
  missingRequiredHeaders: string[];
  totalRows: number;
  validRows: CsvImportValidRow[];
};

const requiredHeaders = ["date", "amount", "type"];
const supportedHeaders = new Set([
  "account",
  "amount",
  "category",
  "currency",
  "date",
  "merchant",
  "note",
  "payment_method",
  "raw_text",
  "source",
  "tag",
  "type",
]);

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      if (nextChar === "\n") {
        index += 1;
      }

      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV 中存在未闭合的引号。");
  }

  row.push(field);
  rows.push(row);

  return rows;
}

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function isBlankRow(row: string[]) {
  return row.every((cell) => cell.trim() === "");
}

function getCell(row: string[], headerIndexes: Map<string, number>, header: string) {
  const index = headerIndexes.get(header);
  return index === undefined ? "" : row[index] ?? "";
}

function isTransactionSource(value: string): value is TransactionSource {
  return value === "manual" || value === "ai";
}

export function parseTransactionsCsv(text: string): CsvImportResult {
  if (!text.trim()) {
    return {
      errorRows: [],
      fileError: "CSV 文件为空。",
      missingRequiredHeaders: requiredHeaders,
      totalRows: 0,
      validRows: [],
    };
  }

  let rows: string[][];

  try {
    rows = parseCsvRows(text);
  } catch (error) {
    return {
      errorRows: [],
      fileError: error instanceof Error ? error.message : "CSV 解析失败。",
      missingRequiredHeaders: [],
      totalRows: 0,
      validRows: [],
    };
  }

  const headerIndexes = new Map<string, number>();

  for (const [index, header] of (rows[0] ?? []).entries()) {
    const normalized = normalizeHeader(header);

    if (supportedHeaders.has(normalized) && !headerIndexes.has(normalized)) {
      headerIndexes.set(normalized, index);
    }
  }

  const missingRequiredHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
  const dataRows = rows
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => !isBlankRow(row));

  if (missingRequiredHeaders.length > 0) {
    return {
      errorRows: [],
      fileError: `CSV 必须包含这些表头：${requiredHeaders.join(", ")}。`,
      missingRequiredHeaders,
      totalRows: dataRows.length,
      validRows: [],
    };
  }

  const errorRows: CsvImportErrorRow[] = [];
  const validRows: CsvImportValidRow[] = [];

  for (const { row, rowNumber } of dataRows) {
    const reasons: string[] = [];
    const date = getCell(row, headerIndexes, "date").trim();
    const amountText = getCell(row, headerIndexes, "amount").trim();
    const typeText = getCell(row, headerIndexes, "type").trim().toLowerCase();
    const amount = Number(amountText);
    const parsedType = isTransactionType(typeText) ? typeText : null;

    if (!date) {
      reasons.push("date 不能为空。");
    } else if (!isValidIsoDate(date)) {
      reasons.push("date 必须是 YYYY-MM-DD 格式。");
    }

    if (!amountText) {
      reasons.push("amount 不能为空。");
    } else if (!Number.isFinite(amount) || amount <= 0) {
      reasons.push("amount 必须是大于 0 的有效数字。");
    }

    if (!parsedType) {
      reasons.push("type 只能是 expense、income 或 transfer。");
    }

    if (reasons.length > 0 || !parsedType) {
      errorRows.push({ raw: row, reasons, rowNumber });
      continue;
    }

    const sourceText = getCell(row, headerIndexes, "source").trim().toLowerCase();

    validRows.push({
      rowNumber,
      transaction: {
        account: toNullableText(getCell(row, headerIndexes, "account")),
        amount,
        category: normalizeDefaultCategory(getCell(row, headerIndexes, "category")),
        currency: DEFAULT_CURRENCY,
        date,
        merchant: toNullableText(getCell(row, headerIndexes, "merchant")),
        note: toNullableText(getCell(row, headerIndexes, "note")),
        payment_method: toNullableText(getCell(row, headerIndexes, "payment_method")),
        raw_text: toNullableText(getCell(row, headerIndexes, "raw_text")),
        source: isTransactionSource(sourceText) ? sourceText : "manual",
        tag: toNullableText(getCell(row, headerIndexes, "tag")),
        type: parsedType,
      },
    });
  }

  return {
    errorRows,
    fileError: null,
    missingRequiredHeaders: [],
    totalRows: dataRows.length,
    validRows,
  };
}
