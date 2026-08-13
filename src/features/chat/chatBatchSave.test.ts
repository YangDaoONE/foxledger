import { describe, expect, it } from "vitest";

import { createChatBatchInsertRequest } from "@/features/chat/chatBatchSave";
import { createChatCandidateBatch } from "@/features/chat/chatReducer";
import type { ParsedTransaction } from "@/features/ai/types";

const parsedTransaction: ParsedTransaction = {
  account: "日常账户",
  ai_confidence: 0.9,
  amount: 32,
  category: "餐饮",
  currency: "CNY",
  date: "2026-08-13",
  merchant: "小狐餐厅",
  needs_clarification: false,
  note: null,
  payment_method: "支付宝",
  raw_text: "午饭 32",
  source: "ai",
  tag: "工作日",
  type: "expense",
};

describe("Chat 候选转正式 AI 批次", () => {
  it("使用核对后的 draft 创建固定 IDs，且不持久化 raw_text", () => {
    const batch = createChatCandidateBatch(
      [parsedTransaction],
      false,
      () => "memory-id",
    );
    batch.candidates[0].draft.amount = "40";
    batch.candidates[0].draft.note = "加餐";
    const ids = [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "11111111-1111-4111-8111-111111111111",
    ];
    const request = createChatBatchInsertRequest(batch, () => ids.shift()!);
    const transaction = request.transactions[0] as unknown as Record<string, unknown>;

    expect(request.batchId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(transaction).toMatchObject({
      ai_batch_id: request.batchId,
      amount: 40,
      id: "11111111-1111-4111-8111-111111111111",
      note: "加餐",
      source: "ai",
    });
    expect(transaction).not.toHaveProperty("raw_text");
  });
});
