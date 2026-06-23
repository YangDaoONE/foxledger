import type { TransactionSource, TransactionType } from "@/types/transaction";
import {
  DEFAULT_CURRENCY,
  isTransactionType,
  isValidIsoDate,
  normalizeDefaultCategory,
  toNullableText,
} from "@/lib/transactionRules";

export type CsvImportTransaction = {
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  tag: string | null;
  merchant: string | null;
  payment_method: string | null;
  account: string | null;
  date: string;
  note: string | null;
  raw_text: string | null;
  source: TransactionSource;
};

export type CsvImportValidRow = {
  rowNumber: number;
  transaction: CsvImportTransaction;
};

export type CsvImportErrorRow = {
  rowNumber: number;
  reasons: string[];
  raw: string[];
};

export type CsvImportResult = {
  totalRows: number;
  validRows: CsvImportValidRow[];
  errorRows: CsvImportErrorRow[];
  missingRequiredHeaders: string[];
  fileError: string | null;
};

const requiredHeaders = ["date", "amount", "type"];
const supportedHeaders = new Set([
  "date",
  "amount",
  "type",
  "category",
  "note",
  "currency",
  "tag",
  "merchant",
  "payment_method",
  "account",
  "raw_text",
  "source",
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

      continue;
    }

    if (char === '"') {
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

function isTransactionSource(value: string): value is TransactionSource {
  return value === "manual" || value === "ai";
}

function getCell(row: string[], headerIndexes: Map<string, number>, header: string) {
  const index = headerIndexes.get(header);
  return index === undefined ? "" : row[index] ?? "";
}

export function parseTransactionsCsv(text: string): CsvImportResult {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      totalRows: 0,
      validRows: [],
      errorRows: [],
      missingRequiredHeaders: requiredHeaders,
      fileError: "CSV 文件为空。",
    };
  }

  let rows: string[][];

  try {
    rows = parseCsvRows(text);
  } catch (error) {
    return {
      totalRows: 0,
      validRows: [],
      errorRows: [],
      missingRequiredHeaders: [],
      fileError: error instanceof Error ? error.message : "CSV 解析失败。",
    };
  }

  const headerRow = rows[0] ?? [];
  const headerIndexes = new Map<string, number>();

  headerRow.forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (supportedHeaders.has(normalizedHeader) && !headerIndexes.has(normalizedHeader)) {
      headerIndexes.set(normalizedHeader, index);
    }
  });

  const missingRequiredHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
  const dataRows = rows
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => !isBlankRow(row));

  if (missingRequiredHeaders.length > 0) {
    return {
      totalRows: dataRows.length,
      validRows: [],
      errorRows: [],
      missingRequiredHeaders,
      fileError: `CSV 必须包含这些表头：${requiredHeaders.join(", ")}。`,
    };
  }

  const validRows: CsvImportValidRow[] = [];
  const errorRows: CsvImportErrorRow[] = [];

  for (const { row, rowNumber } of dataRows) {
    const reasons: string[] = [];
    const date = getCell(row, headerIndexes, "date").trim();
    const amountText = getCell(row, headerIndexes, "amount").trim();
    const typeText = getCell(row, headerIndexes, "type").trim().toLowerCase();
    const parsedType = isTransactionType(typeText) ? typeText : null;
    const amount = Number(amountText);

    if (!date) {
      reasons.push("date 不能为空。");
    } else if (!isValidIsoDate(date)) {
      reasons.push("date 必须是 YYYY-MM-DD 格式。");
    }

    if (!amountText) {
      reasons.push("amount 不能为空。");
    } else if (!Number.isFinite(amount)) {
      reasons.push("amount 必须是有效数字。");
    } else if (amount <= 0) {
      reasons.push("amount 必须大于 0。");
    }

    if (!parsedType) {
      reasons.push("type 只能是 expense、income 或 transfer。");
    }

    if (reasons.length > 0 || !parsedType) {
      errorRows.push({ rowNumber, reasons, raw: row });
      continue;
    }

    const sourceText = getCell(row, headerIndexes, "source").trim().toLowerCase();
    const categoryText = getCell(row, headerIndexes, "category").trim();

    validRows.push({
      rowNumber,
      transaction: {
        type: parsedType,
        amount,
        currency: DEFAULT_CURRENCY,
        category: normalizeDefaultCategory(categoryText),
        tag: toNullableText(getCell(row, headerIndexes, "tag")),
        merchant: toNullableText(getCell(row, headerIndexes, "merchant")),
        payment_method: toNullableText(getCell(row, headerIndexes, "payment_method")),
        account: toNullableText(getCell(row, headerIndexes, "account")),
        date,
        note: toNullableText(getCell(row, headerIndexes, "note")),
        raw_text: toNullableText(getCell(row, headerIndexes, "raw_text")),
        source: isTransactionSource(sourceText) ? sourceText : "manual",
      },
    });
  }

  return {
    totalRows: dataRows.length,
    validRows,
    errorRows,
    missingRequiredHeaders,
    fileError: null,
  };
}
