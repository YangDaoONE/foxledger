"use client";

import { ChangeEvent, useRef, useState } from "react";
import { CheckCircle2, FileText, Upload } from "lucide-react";
import { parseTransactionsCsv, type CsvImportResult } from "@/lib/csvImport";
import { supabase } from "@/lib/supabase";

type ImportTransactionsProps = {
  onImported?: () => void;
};

function resetFileInput(input: HTMLInputElement | null) {
  if (input) {
    input.value = "";
  }
}

export function ImportTransactions({ onImported }: ImportTransactionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CsvImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setErrorMessage(null);
    setSuccessMessage(null);
    setParseResult(null);
    setFileName(file?.name ?? null);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("请选择 .csv 文件。");
      resetFileInput(fileInputRef.current);
      setFileName(null);
      return;
    }

    try {
      const text = await file.text();
      setParseResult(parseTransactionsCsv(text));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取 CSV 文件失败。");
      resetFileInput(fileInputRef.current);
      setFileName(null);
    }
  }

  function handleClear() {
    setFileName(null);
    setParseResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    resetFileInput(fileInputRef.current);
  }

  async function handleImport() {
    if (!parseResult || parseResult.validRows.length === 0 || isImporting) {
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setIsImporting(false);
      setErrorMessage(userError?.message ?? "请先登录后再导入账单。");
      return;
    }

    const insertPayload = parseResult.validRows.map(({ transaction }) => ({
      user_id: userData.user.id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      category: transaction.category,
      tag: transaction.tag,
      merchant: transaction.merchant,
      payment_method: transaction.payment_method,
      account: transaction.account,
      date: transaction.date,
      note: transaction.note,
      raw_text: transaction.raw_text,
      source: transaction.source,
    }));

    const { error } = await supabase.from("transactions").insert(insertPayload);

    setIsImporting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const importedCount = insertPayload.length;
    setFileName(null);
    setParseResult(null);
    resetFileInput(fileInputRef.current);
    setSuccessMessage(`导入成功：${importedCount} 笔账单。`);
    onImported?.();
  }

  const canImport = Boolean(parseResult && parseResult.validRows.length > 0 && !isImporting);
  const previewRows = parseResult?.validRows.slice(0, 5) ?? [];
  const displayedErrorRows = parseResult?.errorRows.slice(0, 12) ?? [];
  const hiddenErrorCount = parseResult
    ? Math.max(parseResult.errorRows.length - displayedErrorRows.length, 0)
    : 0;

  return (
    <section className="section-block" aria-labelledby="import-title">
      <div className="section-heading">
        <p>CSV 导入</p>
        <h2 id="import-title">批量导入账单</h2>
      </div>

      <label className="manual-field">
        <span>选择 CSV 文件</span>
        <input
          ref={fileInputRef}
          accept=".csv,text/csv"
          type="file"
          onChange={handleFileChange}
          disabled={isImporting}
        />
      </label>

      <div className="import-actions">
        <button className="primary-button" disabled={!canImport} type="button" onClick={handleImport}>
          <Upload size={18} aria-hidden="true" />
          {isImporting ? "导入中" : "确认导入"}
        </button>
        <button className="secondary-button" disabled={isImporting} type="button" onClick={handleClear}>
          清空
        </button>
      </div>

      {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
      {successMessage ? <p className="form-message success">{successMessage}</p> : null}

      {fileName ? (
        <p className="import-file-name">
          <FileText size={15} aria-hidden="true" />
          {fileName}
        </p>
      ) : null}

      {parseResult?.fileError ? <p className="form-message error">{parseResult.fileError}</p> : null}

      {parseResult && !parseResult.fileError ? (
        <div className="import-summary" aria-label="CSV 解析结果">
          <span>总行数：{parseResult.totalRows}</span>
          <span>可导入：{parseResult.validRows.length}</span>
          <span>错误行：{parseResult.errorRows.length}</span>
        </div>
      ) : null}

      {parseResult && parseResult.totalRows > 0 && parseResult.validRows.length === 0 ? (
        <p className="form-message error">没有可导入的合法账单，请修改 CSV 后重新选择文件。</p>
      ) : null}

      {previewRows.length > 0 ? (
        <div className="import-preview">
          <div className="section-heading">
            <p>预览</p>
            <h3>前 5 条合法账单</h3>
          </div>
          <div className="import-row-list">
            {previewRows.map((row) => (
              <div className="import-preview-row" key={row.rowNumber}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <div>
                  <strong>
                    第 {row.rowNumber} 行 · {row.transaction.date} · {row.transaction.type}
                  </strong>
                  <span>
                    {row.transaction.amount} {row.transaction.currency} · {row.transaction.category}
                    {row.transaction.note ? ` · ${row.transaction.note}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {displayedErrorRows.length > 0 ? (
        <div className="import-errors">
          <div className="section-heading">
            <p>错误行</p>
            <h3>需要修改后才能导入</h3>
          </div>
          <div className="import-row-list">
            {displayedErrorRows.map((row) => (
              <div className="import-error-row" key={row.rowNumber}>
                <strong>第 {row.rowNumber} 行</strong>
                <span>{row.reasons.join(" ")}</span>
              </div>
            ))}
          </div>
          {hiddenErrorCount > 0 ? (
            <p className="confirm-note">还有 {hiddenErrorCount} 行错误未显示。</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
