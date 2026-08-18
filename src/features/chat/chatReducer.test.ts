import { describe, expect, it } from "vitest";

import type { ParsedTransaction } from "@/features/ai/types";
import {
  canConfirmCandidateBatch,
  getCandidateIssues,
  summarizeCandidateBatch,
} from "@/features/chat/batchCalculations";
import {
  chatReducer,
  createChatCandidateBatch,
  createInitialChatState,
} from "@/features/chat/chatReducer";
import type {
  ChatLedgerResultMessage,
  ChatState,
} from "@/features/chat/chatTypes";

const parsedTransaction: ParsedTransaction = {
  account: null,
  ai_confidence: 0.9,
  amount: 32,
  category: "餐饮",
  currency: "CNY",
  date: "2026-08-13",
  merchant: "小狐餐厅",
  needs_clarification: false,
  note: null,
  payment_method: null,
  raw_text: "午饭 32",
  source: "ai",
  tag: null,
  type: "expense",
};

const saveRequest = {
  batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  transactions: [],
};

function createResultMessage(
  batch = createChatCandidateBatch([parsedTransaction], false, () => "fixed-id"),
): ChatLedgerResultMessage {
  return {
    batch,
    createdAt: "2026-08-13T01:00:00.000Z",
    id: "result-message",
    role: "assistant",
    type: "ledger_result",
  };
}

function stateWithBatch(batch = createResultMessage().batch): ChatState {
  return {
    ...createInitialChatState("user-1"),
    messages: [createResultMessage(batch)],
  };
}

describe("Chat 候选 reducer", () => {
  it("clarification 候选在补全并明确完成核对前保持阻断", () => {
    const batch = createChatCandidateBatch(
      [
        {
          ...parsedTransaction,
          amount: null,
          needs_clarification: true,
          raw_text: "午饭",
        },
      ],
      false,
      () => "candidate-id",
    );
    let state = stateWithBatch(batch);

    expect(batch.status).toBe("needs_attention");
    expect(canConfirmCandidateBatch(batch)).toBe(false);

    state = chatReducer(state, {
      candidateId: "candidate-id",
      messageId: "result-message",
      patch: { amount: "32" },
      type: "update_candidate",
    });
    expect(getBatch(state).status).toBe("needs_attention");

    state = chatReducer(state, {
      candidateId: "candidate-id",
      messageId: "result-message",
      type: "complete_candidate_review",
    });
    expect(getBatch(state).status).toBe("draft");
    expect(canConfirmCandidateBatch(getBatch(state))).toBe(true);
  });

  it("紧凑小数无法判定日期或金额时给出针对性核对说明", () => {
    const batch = createChatCandidateBatch(
      [
        {
          ...parsedTransaction,
          amount: null,
          needs_clarification: true,
          raw_text: "7.6吃饭",
          type: null,
        },
      ],
      false,
      () => "ambiguous-candidate",
    );

    expect(getCandidateIssues(batch.candidates[0])[0]).toBe(
      "请确认 7.6 是日期还是金额，并补全后完成核对。",
    );
  });

  it("移除未补全候选后用剩余候选重新计算批次状态", () => {
    const ids = ["valid", "attention", "batch"];
    const batch = createChatCandidateBatch(
      [
        parsedTransaction,
        { ...parsedTransaction, amount: null, needs_clarification: true },
      ],
      false,
      () => ids.shift()!,
    );
    const state = chatReducer(stateWithBatch(batch), {
      candidateId: "attention",
      messageId: "result-message",
      type: "remove_candidate",
    });

    expect(getBatch(state).candidates.map((candidate) => candidate.id)).toEqual(["valid"]);
    expect(getBatch(state).status).toBe("draft");
  });

  it("只有可确认批次能进入 saving，进入后禁止继续修改 draft", () => {
    const blockedBatch = createChatCandidateBatch(
      [{ ...parsedTransaction, needs_clarification: true }],
      false,
      () => "blocked",
    );
    const blockedState = chatReducer(stateWithBatch(blockedBatch), {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    expect(getBatch(blockedState).status).toBe("needs_attention");

    const readyState = chatReducer(stateWithBatch(), {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    expect(getBatch(readyState).status).toBe("saving");

    const unchanged = chatReducer(readyState, {
      candidateId: "fixed-id",
      messageId: "result-message",
      patch: { amount: "999" },
      type: "update_candidate",
    });
    expect(getBatch(unchanged).candidates[0].draft.amount).toBe("32");
  });

  it("用户变化会清空消息和 parsing 状态", () => {
    const reset = chatReducer(stateWithBatch(), { type: "reset", userId: "user-2" });

    expect(reset).toEqual(createInitialChatState("user-2"));
  });

  it("远端成功后不再回到 draft，同步失败只进入 sync_warning", () => {
    let state = chatReducer(stateWithBatch(), {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      messageId: "result-message",
      transactionIds: ["transaction-1"],
      type: "save_succeeded",
      userId: "user-1",
    });
    expect(getBatch(state)).toMatchObject({
      status: "saved",
      transactionIds: ["transaction-1"],
    });

    state = chatReducer(state, {
      error: "sync failed",
      messageId: "result-message",
      type: "sync_failed",
      userId: "user-1",
    });
    expect(getBatch(state).status).toBe("sync_warning");

    const noDuplicateSave = chatReducer(state, {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    expect(getBatch(noDuplicateSave).status).toBe("sync_warning");

    state = chatReducer(state, {
      messageId: "result-message",
      type: "sync_succeeded",
      userId: "user-1",
    });
    expect(getBatch(state).status).toBe("saved");
  });

  it("只有明确可重试的保存失败才能使用原固定请求再次进入 saving", () => {
    let state = chatReducer(stateWithBatch(), {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    state = chatReducer(state, {
      canRetry: true,
      error: "temporary",
      messageId: "result-message",
      type: "save_failed",
      userId: "user-1",
    });
    const retainedRequest = getBatch(state).saveRequest;

    state = chatReducer(state, {
      messageId: "result-message",
      request: { batchId: "new-id", transactions: [] },
      type: "request_save",
    });
    expect(getBatch(state).status).toBe("saving");
    expect(getBatch(state).saveRequest).toBe(retainedRequest);
  });

  it("整组撤销只更新匹配的已保存批次", () => {
    let state = chatReducer(stateWithBatch(), {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      messageId: "result-message",
      transactionIds: ["transaction-1"],
      type: "save_succeeded",
      userId: "user-1",
    });
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      type: "request_batch_undo",
    });
    expect(getBatch(state).status).toBe("undoing");
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      type: "mark_batch_undone",
    });

    expect(getBatch(state).status).toBe("undone");
  });

  it("删除最后一笔后可按正式 batchId 将 saved 直接标记为 undone", () => {
    let state = chatReducer(stateWithBatch(), {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      messageId: "result-message",
      transactionIds: ["transaction-1"],
      type: "save_succeeded",
      userId: "user-1",
    });

    const wrongIdState = chatReducer(state, {
      batchId: getBatch(state).id,
      type: "mark_batch_undone",
    });
    expect(getBatch(wrongIdState).status).toBe("saved");

    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      type: "mark_batch_undone",
    });
    expect(getBatch(state).status).toBe("undone");
  });

  it("整组撤销远端失败时恢复撤销前状态，不误标为已撤销", () => {
    let state = chatReducer(stateWithBatch(), {
      messageId: "result-message",
      request: saveRequest,
      type: "request_save",
    });
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      messageId: "result-message",
      transactionIds: ["transaction-1"],
      type: "save_succeeded",
      userId: "user-1",
    });
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      type: "request_batch_undo",
    });
    state = chatReducer(state, {
      batchId: saveRequest.batchId,
      error: "delete failed",
      type: "batch_undo_failed",
    });

    expect(getBatch(state)).toMatchObject({
      error: "delete failed",
      status: "saved",
      statusBeforeUndo: null,
    });
  });
});

describe("内存候选批次汇总", () => {
  it("收入、支出和转账按现有统计口径计算", () => {
    const ids = ["expense", "income", "transfer", "batch"];
    const batch = createChatCandidateBatch(
      [
        parsedTransaction,
        { ...parsedTransaction, amount: 100, type: "income" },
        { ...parsedTransaction, amount: 20, type: "transfer" },
      ],
      false,
      () => ids.shift()!,
    );

    expect(summarizeCandidateBatch(batch.candidates)).toEqual({
      balance: 68,
      expense: 32,
      expenseCount: 1,
      income: 100,
      incomeCount: 1,
      transactionCount: 3,
      transferCount: 1,
    });
  });
});

function getBatch(state: ChatState) {
  const message = state.messages.find((item) => item.type === "ledger_result");

  if (!message || message.type !== "ledger_result") {
    throw new Error("测试状态缺少候选批次。");
  }

  return message.batch;
}
