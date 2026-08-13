import { describe, expect, it } from "vitest";

import { createAiBatchInsertRequest } from "@/features/ai/aiBatchSave";
import type { AiBatchTransactionInput } from "@/features/transactions/types";

const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const transactionIdOne = "11111111-1111-4111-8111-111111111111";
const transactionIdTwo = "22222222-2222-4222-8222-222222222222";

const input: AiBatchTransactionInput = {
  account: null,
  ai_confidence: 0.9,
  amount: 32,
  category: "餐饮",
  currency: "CNY",
  date: "2026-08-13",
  merchant: "小狐餐厅",
  note: null,
  payment_method: null,
  tag: null,
  type: "expense",
};

describe("AI 批次固定 ID", () => {
  it("一次确认只生成一个 batch ID，并为每笔候选生成固定 transaction ID", () => {
    const ids = [batchId, transactionIdOne, transactionIdTwo];
    const request = createAiBatchInsertRequest(
      [input, { ...input, amount: 6, category: "交通" }],
      () => ids.shift()!,
    );

    expect(request.batchId).toBe(batchId);
    expect(request.transactions.map((transaction) => transaction.id)).toEqual([
      transactionIdOne,
      transactionIdTwo,
    ]);
    expect(
      request.transactions.every((transaction) => transaction.ai_batch_id === batchId),
    ).toBe(true);
    expect(request.transactions.every((transaction) => transaction.source === "ai")).toBe(true);
  });

  it("即使运行时输入夹带 raw_text，也不会进入最终 AI 写入对象", () => {
    const untrustedInput = {
      ...input,
      ai_batch_id: "untrusted-batch",
      id: "untrusted-id",
      raw_text: "午饭 32",
      source: "manual",
    } as unknown as AiBatchTransactionInput;
    const ids = [batchId, transactionIdOne];
    const request = createAiBatchInsertRequest([untrustedInput], () => ids.shift()!);
    const transaction = request.transactions[0] as unknown as Record<string, unknown>;

    expect(transaction).not.toHaveProperty("raw_text");
    expect(transaction.ai_batch_id).toBe(batchId);
    expect(transaction.id).toBe(transactionIdOne);
    expect(transaction.source).toBe("ai");
  });

  it("拒绝创建空批次", () => {
    expect(() => createAiBatchInsertRequest([])).toThrow("没有可保存的 AI 候选。");
  });
});
