import { useState } from "react";

import { AppButton } from "@/components/ui/AppButton";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { parseTransactionsCsv, type CsvImportResult } from "@/features/import/csvImport";
import type { TransactionWritePayload } from "@/features/transactions/types";
import { insertTransactions } from "@/features/transactions/transactionsApi";

type ImportTransactionsProps = {
  isOnline: boolean;
  onImported: () => Promise<void>;
  userId: string;
};

export function ImportTransactions({ isOnline, onImported, userId }: ImportTransactionsProps) {
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleFile(file: File | null) {
    setMessage(null);

    if (!file) {
      return;
    }

    const text = await file.text();
    setResult(parseTransactionsCsv(text));
  }

  async function handleImport() {
    if (!isOnline) {
      setMessage("离线时不能导入 CSV。");
      return;
    }

    if (!result || result.validRows.length === 0) {
      setMessage("没有可导入的合法行。");
      return;
    }

    setIsImporting(true);
    setMessage(null);

    try {
      const payload = result.validRows.map<TransactionWritePayload>(({ transaction }) => ({
        ...transaction,
        user_id: userId,
      }));

      const count = await insertTransactions(payload);
      await onImported();
      setMessage(`已导入 ${count} 条账单。`);
      setResult(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV 导入失败。");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <SectionBlock eyebrow="CSV" title="导入账单">
      <label className="file-input">
        <span>选择 CSV 文件</span>
        <input
          accept=".csv,text/csv"
          disabled={!isOnline || isImporting}
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>

      {result ? (
        <div className="import-summary">
          <span>总行数：{result.totalRows}</span>
          <span>合法：{result.validRows.length}</span>
          <span>错误：{result.errorRows.length}</span>
        </div>
      ) : null}

      {result?.fileError ? <p className="form-message danger">{result.fileError}</p> : null}

      {result && result.errorRows.length > 0 ? (
        <div className="error-list">
          {result.errorRows.slice(0, 5).map((row) => (
            <p key={row.rowNumber}>
              第 {row.rowNumber} 行：{row.reasons.join(" ")}
            </p>
          ))}
        </div>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}

      <AppButton
        disabled={!isOnline || isImporting || !result || result.validRows.length === 0}
        type="button"
        onClick={handleImport}
      >
        {isImporting ? "导入中..." : "确认导入"}
      </AppButton>
    </SectionBlock>
  );
}
