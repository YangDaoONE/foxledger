import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: fromMock },
}));

import {
  deleteEmptyLedger,
  normalizeLedgerName,
  normalizeRemoteLedgerRow,
  renameLedger,
} from "@/features/ledgers/ledgerApi";

const ledgerOneId = "33333333-3333-4333-8333-333333333333";
const ledgerTwoId = "44444444-4444-4444-8444-444444444444";

afterEach(() => {
  fromMock.mockReset();
});

function createRemoteLedger(id = ledgerOneId, name = "默认账本") {
  return {
    created_at: "2026-08-22T01:00:00.000Z",
    id,
    name,
    updated_at: "2026-08-22T01:00:00.000Z",
    user_id: "user-1",
  };
}

function mockLedgerList(rows: ReturnType<typeof createRemoteLedger>[]) {
  const query = {
    eq: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order
    .mockReturnValueOnce(query)
    .mockResolvedValueOnce({ data: rows, error: null });
  fromMock.mockReturnValueOnce(query);
  return query;
}

describe("账本 API 边界", () => {
  it("规范化名称并拒绝其他用户或未清理的远端账本", () => {
    expect(normalizeLedgerName(" 旅行账本 ")).toBe("旅行账本");
    expect(() => normalizeLedgerName(" ")).toThrow("账本名称不能为空");
    expect(() =>
      normalizeRemoteLedgerRow(
        { ...createRemoteLedger(), user_id: "user-2" },
        "user-1",
      ),
    ).toThrow("不属于当前用户");
    expect(() =>
      normalizeRemoteLedgerRow(
        { ...createRemoteLedger(), name: " 默认账本" },
        "user-1",
      ),
    ).toThrow("未清理的空格");
  });

  it("重命名同时约束 ledger id 与当前 user_id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: createRemoteLedger(ledgerOneId, "旅行账本"),
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const update = vi.fn(() => ({ eq: eqId }));
    fromMock.mockReturnValue({ update });

    await expect(
      renameLedger("user-1", ledgerOneId, " 旅行账本 "),
    ).resolves.toMatchObject({ id: ledgerOneId, name: "旅行账本" });
    expect(update).toHaveBeenCalledWith({ name: "旅行账本" });
    expect(eqId).toHaveBeenCalledWith("id", ledgerOneId);
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("最后一个账本在发起删除前就被保护", async () => {
    mockLedgerList([createRemoteLedger()]);

    await expect(deleteEmptyLedger("user-1", ledgerOneId)).rejects.toThrow(
      "最后一个账本不能删除",
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("删除使用当前用户约束，并把外键保护转换成可操作提示", async () => {
    mockLedgerList([
      createRemoteLedger(),
      createRemoteLedger(ledgerTwoId, "旅行账本"),
    ]);
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23503", message: "foreign key violation" },
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const deleteRow = vi.fn(() => ({ eq: eqId }));
    fromMock.mockReturnValueOnce({ delete: deleteRow });

    await expect(deleteEmptyLedger("user-1", ledgerTwoId)).rejects.toThrow(
      "这个账本还有账单，不能直接删除",
    );
    expect(eqId).toHaveBeenCalledWith("id", ledgerTwoId);
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });
});
