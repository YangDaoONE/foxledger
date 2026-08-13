import type {
  AiBatchTransactionInput,
  AiBatchTransactionInsert,
} from "@/features/transactions/types";

export type AiBatchInsertRequest = {
  batchId: string;
  transactions: AiBatchTransactionInsert[];
};

type UuidFactory = () => string;

function toAiBatchTransactionInsert(
  transaction: AiBatchTransactionInput,
  batchId: string,
  transactionId: string,
): AiBatchTransactionInsert {
  return {
    account: transaction.account,
    ai_batch_id: batchId,
    ai_confidence: transaction.ai_confidence,
    amount: transaction.amount,
    category: transaction.category,
    currency: transaction.currency,
    date: transaction.date,
    id: transactionId,
    merchant: transaction.merchant,
    note: transaction.note,
    payment_method: transaction.payment_method,
    source: "ai",
    tag: transaction.tag,
    type: transaction.type,
  };
}

export function createAiBatchInsertRequest(
  transactions: AiBatchTransactionInput[],
  uuidFactory: UuidFactory = () => crypto.randomUUID(),
): AiBatchInsertRequest {
  if (transactions.length === 0) {
    throw new Error("没有可保存的 AI 候选。");
  }

  const batchId = uuidFactory();

  return {
    batchId,
    transactions: transactions.map((transaction) =>
      toAiBatchTransactionInsert(transaction, batchId, uuidFactory()),
    ),
  };
}
