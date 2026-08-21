import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  deleteTransaction,
  deleteTransactionsByIds,
  insertAiBatchTransactionsForUser,
  insertTransactionsForUser,
  normalizeRemoteCacheRow,
  TRANSACTION_CACHE_SELECT,
  updateTransaction,
} from "@/features/transactions/transactionsApi";
import type {
  AiBatchTransactionInsert,
  TransactionInsertPayload,
} from "@/features/transactions/types";

afterEach(() => {
  fromMock.mockReset();
});

const ledgerId = "33333333-3333-4333-8333-333333333333";
const otherLedgerId = "44444444-4444-4444-8444-444444444444";

const remoteRow: Parameters<typeof normalizeRemoteCacheRow>[0] = {
  ai_batch_id: null,
  amount: "12.50",
  category: "餐饮",
  created_at: "2026-08-13T01:00:00.000Z",
  currency: "CNY",
  date: "2026-08-13",
  id: "transaction-1",
  ledger_id: ledgerId,
  merchant: "小狐餐厅",
  note: null,
  payment_method: null,
  source: "manual",
  type: "expense",
  updated_at: "2026-08-13T01:00:00.000Z",
  user_id: "user-1",
};

const insertPayload: TransactionInsertPayload = {
  amount: 12.5,
  category: "餐饮",
  currency: "CNY",
  date: "2026-08-13",
  ledger_id: ledgerId,
  merchant: null,
  note: null,
  payment_method: null,
  source: "manual",
  type: "expense",
};

const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const transactionIdOne = "11111111-1111-4111-8111-111111111111";
const transactionIdTwo = "22222222-2222-4222-8222-222222222222";

function createAiBatchTransaction(
  overrides: Partial<AiBatchTransactionInsert> = {},
): AiBatchTransactionInsert {
  return {
    ai_batch_id: batchId,
    amount: 12.5,
    category: "餐饮",
    currency: "CNY",
    date: "2026-08-13",
    id: transactionIdOne,
    ledger_id: ledgerId,
    merchant: null,
    note: null,
    payment_method: null,
    source: "ai",
    type: "expense",
    ...overrides,
  };
}

describe("远端缓存契约", () => {
  it("只选择允许进入 IndexedDB 的账单字段", () => {
    expect(TRANSACTION_CACHE_SELECT.split(",")).toEqual([
      "id",
      "user_id",
      "ledger_id",
      "ai_batch_id",
      "type",
      "amount",
      "currency",
      "category",
      "merchant",
      "payment_method",
      "date",
      "note",
      "source",
      "created_at",
      "updated_at",
    ]);

    for (const forbiddenField of [
      "raw_text",
      "tag",
      "account",
      "ai_confidence",
      "access_token",
    ]) {
      expect(TRANSACTION_CACHE_SELECT).not.toContain(forbiddenField);
    }
  });

  it("规范化金额与缓存键，并拒绝其他用户或非法金额", () => {
    expect(normalizeRemoteCacheRow(remoteRow, "user-1")).toEqual({
      ...remoteRow,
      amount: 12.5,
      cache_key: "user-1:transaction-1",
      currency: "CNY",
    });
    expect(() => normalizeRemoteCacheRow(remoteRow, "user-2")).toThrow(
      "远端返回了不属于当前用户的账单。",
    );
    expect(() =>
      normalizeRemoteCacheRow({ ...remoteRow, amount: 0 }, "user-1"),
    ).toThrow("远端账单金额异常。");
  });

  it("只接受合法 AI batch UUID，并禁止手动账单进入 AI 批次", () => {
    expect(
      normalizeRemoteCacheRow(
        { ...remoteRow, ai_batch_id: batchId, source: "ai" },
        "user-1",
      ).ai_batch_id,
    ).toBe(batchId);
    expect(() =>
      normalizeRemoteCacheRow(
        { ...remoteRow, ai_batch_id: "invalid", source: "ai" },
        "user-1",
      ),
    ).toThrow("远端账单 AI 批次 ID 异常。");
    expect(() =>
      normalizeRemoteCacheRow(
        { ...remoteRow, ai_batch_id: batchId, source: "manual" },
        "user-1",
      ),
    ).toThrow("非 AI 账单不能属于 AI 批次。");
  });
});

describe("交易 API 用户隔离契约", () => {
  it("批量新增由 API 注入当前 user_id，并核对返回数量", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: "transaction-1" }],
      error: null,
    });
    const insert = vi.fn(() => ({ select }));
    fromMock.mockReturnValue({ insert });
    const untrustedPayload = {
      ...insertPayload,
      user_id: "other-user",
    } as unknown as TransactionInsertPayload;

    await expect(insertTransactionsForUser("user-1", [untrustedPayload])).resolves.toEqual([
      "transaction-1",
    ]);
    expect(fromMock).toHaveBeenCalledWith("transactions");
    expect(insert).toHaveBeenCalledWith([{ ...insertPayload, user_id: "user-1" }]);
    expect(select).toHaveBeenCalledWith("id");
  });

  it("固定 ID 批量新增会校验返回 ID 集合", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: transactionIdTwo }],
      error: null,
    });
    fromMock.mockReturnValue({ insert: vi.fn(() => ({ select })) });

    await expect(
      insertTransactionsForUser("user-1", [
        { ...insertPayload, id: transactionIdOne },
      ]),
    ).rejects.toThrow("保存失败，返回账单 ID 与提交不一致。");
  });

  it("返回行数与提交数量不一致时不能视为成功", async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue({ insert: vi.fn(() => ({ select })) });

    await expect(
      insertTransactionsForUser("user-1", [insertPayload]),
    ).rejects.toThrow("保存失败，创建账单数量不一致。");
  });

  it("更新同时约束 transaction id 和当前 user_id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "transaction-1" },
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const update = vi.fn(() => ({ eq: eqId }));
    fromMock.mockReturnValue({ update });

    await updateTransaction("user-1", "transaction-1", {
      amount: "12.5",
      category: "餐饮",
      date: "2026-08-13",
      ledger_id: ledgerId,
      merchant: "",
      note: "",
      payment_method: "",
      type: "expense",
    });

    expect(eqId).toHaveBeenCalledWith("id", "transaction-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("单条和批量删除都显式约束当前 user_id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "transaction-1" },
      error: null,
    });
    const selectSingle = vi.fn(() => ({ maybeSingle }));
    const eqUserSingle = vi.fn(() => ({ select: selectSingle }));
    const eqId = vi.fn(() => ({ eq: eqUserSingle }));
    const deleteSingle = vi.fn(() => ({ eq: eqId }));
    fromMock.mockReturnValueOnce({ delete: deleteSingle });

    await deleteTransaction("user-1", "transaction-1");

    expect(eqId).toHaveBeenCalledWith("id", "transaction-1");
    expect(eqUserSingle).toHaveBeenCalledWith("user_id", "user-1");

    const selectBatch = vi.fn().mockResolvedValue({
      data: [{ id: "transaction-1" }, { id: "transaction-2" }],
      error: null,
    });
    const eqUserBatch = vi.fn(() => ({ select: selectBatch }));
    const inIds = vi.fn(() => ({ eq: eqUserBatch }));
    const deleteBatch = vi.fn(() => ({ in: inIds }));
    fromMock.mockReturnValueOnce({ delete: deleteBatch });

    await expect(
      deleteTransactionsByIds("user-1", ["transaction-1", "transaction-1", "transaction-2"]),
    ).resolves.toBe(2);
    expect(inIds).toHaveBeenCalledWith("id", ["transaction-1", "transaction-2"]);
    expect(eqUserBatch).toHaveBeenCalledWith("user_id", "user-1");
  });
});

describe("AI 批次保存协调", () => {
  it("写入前拒绝非法 batch ID、混合 batch 和重复 transaction IDs", async () => {
    await expect(
      insertAiBatchTransactionsForUser("user-1", [
        createAiBatchTransaction({ ai_batch_id: "invalid" }),
      ]),
    ).rejects.toThrow("AI 批次 ID 格式不正确。");
    await expect(
      insertAiBatchTransactionsForUser("user-1", [
        createAiBatchTransaction(),
        createAiBatchTransaction({
          ai_batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          id: transactionIdTwo,
        }),
      ]),
    ).rejects.toThrow("同一次确认的 AI 候选必须使用相同批次 ID。");
    await expect(
      insertAiBatchTransactionsForUser("user-1", [
        createAiBatchTransaction(),
        createAiBatchTransaction(),
      ]),
    ).rejects.toThrow("AI 批次包含重复账单 ID。");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("写入前拒绝同一 AI 批次跨账本", async () => {
    await expect(
      insertAiBatchTransactionsForUser("user-1", [
        createAiBatchTransaction(),
        createAiBatchTransaction({ id: transactionIdTwo, ledger_id: otherLedgerId }),
      ]),
    ).rejects.toThrow("同一个 AI 批次的所有账单必须属于同一个账本。");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("保存成功时返回真实 IDs，并确保写入不包含 raw_text", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: transactionIdOne }, { id: transactionIdTwo }],
      error: null,
    });
    const insertedPayloads: unknown[] = [];
    const insert = vi.fn((payload: unknown) => {
      insertedPayloads.push(payload);
      return { select };
    });
    fromMock.mockReturnValue({ insert });
    const transactions = [
      createAiBatchTransaction(),
      createAiBatchTransaction({ id: transactionIdTwo }),
    ];
    const untrustedTransactions = transactions.map((transaction) => ({
      ...transaction,
      raw_text: "不得持久化的当前输入",
    })) as unknown as AiBatchTransactionInsert[];

    await expect(
      insertAiBatchTransactionsForUser("user-1", untrustedTransactions),
    ).resolves.toEqual({
      batchId,
      coordinated: false,
      transactionIds: [transactionIdOne, transactionIdTwo],
    });

    const insertedRows = insertedPayloads[0] as Array<Record<string, unknown>>;
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows.every((row) => row.user_id === "user-1")).toBe(true);
    expect(insertedRows.every((row) => !("raw_text" in row))).toBe(true);
  });

  it("响应丢失但远端 ID 集合完整时按已保存处理", async () => {
    const insertSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "network response lost" },
    });
    fromMock.mockReturnValueOnce({ insert: vi.fn(() => ({ select: insertSelect })) });

    const batchEq = vi.fn().mockResolvedValue({
      data: [
        { id: transactionIdTwo, ledger_id: ledgerId },
        { id: transactionIdOne, ledger_id: ledgerId },
      ],
      error: null,
    });
    const userEq = vi.fn(() => ({ eq: batchEq }));
    const selectRemote = vi.fn(() => ({ eq: userEq }));
    fromMock.mockReturnValueOnce({ select: selectRemote });

    await expect(
      insertAiBatchTransactionsForUser("user-1", [
        createAiBatchTransaction(),
        createAiBatchTransaction({ id: transactionIdTwo }),
      ]),
    ).resolves.toEqual({
      batchId,
      coordinated: true,
      transactionIds: [transactionIdOne, transactionIdTwo],
    });
    expect(userEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(batchEq).toHaveBeenCalledWith("ai_batch_id", batchId);
  });

  it("远端为零条时保留原错误，允许使用原 IDs 重试", async () => {
    const insertSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "temporary failure" },
    });
    fromMock.mockReturnValueOnce({ insert: vi.fn(() => ({ select: insertSelect })) });
    const batchEq = vi.fn().mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValueOnce({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: batchEq })) })),
    });

    await expect(
      insertAiBatchTransactionsForUser("user-1", [createAiBatchTransaction()]),
    ).rejects.toThrow("temporary failure");
  });

  it("远端出现非零但不完整集合时禁止自动补写", async () => {
    const insertSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "request failed" },
    });
    fromMock.mockReturnValueOnce({ insert: vi.fn(() => ({ select: insertSelect })) });
    const batchEq = vi.fn().mockResolvedValue({
      data: [{ id: transactionIdOne, ledger_id: ledgerId }],
      error: null,
    });
    fromMock.mockReturnValueOnce({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: batchEq })) })),
    });

    await expect(
      insertAiBatchTransactionsForUser("user-1", [
        createAiBatchTransaction(),
        createAiBatchTransaction({ id: transactionIdTwo }),
      ]),
    ).rejects.toThrow(
      "AI 批次保存结果不完整，已禁止自动补写。请重新同步并人工核对账单。",
    );
  });

  it("协调查询失败时不猜测写入结果", async () => {
    const insertSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "request failed" },
    });
    fromMock.mockReturnValueOnce({ insert: vi.fn(() => ({ select: insertSelect })) });
    const batchEq = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });
    fromMock.mockReturnValueOnce({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: batchEq })) })),
    });

    await expect(
      insertAiBatchTransactionsForUser("user-1", [createAiBatchTransaction()]),
    ).rejects.toThrow(
      "无法确认 AI 批次保存状态，请重新同步并核对账单后再操作。",
    );
  });
});
