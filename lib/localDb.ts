import type { Transaction } from "@/types/transaction";

const databaseName = "foxledger";
const databaseVersion = 2;
const transactionStoreName = "transactions";
const syncMetaStoreName = "sync_meta";
const manualDraftStoreName = "manual_drafts";

export type CachedTransaction = Transaction & {
  cache_key: string;
  cached_at: string;
};

export type SyncMeta = {
  user_id: string;
  last_attempt_at: string | null;
  last_successful_sync_at: string | null;
  transaction_count: number;
  last_error: string | null;
};

export type ManualTransactionDraftCache = {
  user_id: string;
  type: Transaction["type"];
  amount: string;
  category: string;
  date: string;
  merchant: string;
  payment_method: string;
  note: string;
  updated_at: string;
};

function assertIndexedDbAvailable() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("当前浏览器不支持本地账单缓存。");
  }
}

function createCacheKey(userId: string, transactionId: string) {
  return `${userId}:${transactionId}`;
}

function toCachedTransaction(transaction: Transaction, cachedAt: string): CachedTransaction {
  return {
    ...transaction,
    cache_key: createCacheKey(transaction.user_id, transaction.id),
    cached_at: cachedAt,
  };
}

function fromCachedTransaction(transaction: CachedTransaction): Transaction {
  return {
    id: transaction.id,
    user_id: transaction.user_id,
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
    ai_confidence: transaction.ai_confidence,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
  };
}

export function openLocalDb(): Promise<IDBDatabase> {
  assertIndexedDbAvailable();

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(transactionStoreName)) {
        const store = db.createObjectStore(transactionStoreName, { keyPath: "cache_key" });
        store.createIndex("user_id", "user_id", { unique: false });
        store.createIndex("user_id_date", ["user_id", "date"], { unique: false });
        store.createIndex("user_id_updated_at", ["user_id", "updated_at"], { unique: false });
      }

      if (!db.objectStoreNames.contains(syncMetaStoreName)) {
        db.createObjectStore(syncMetaStoreName, { keyPath: "user_id" });
      }

      if (!db.objectStoreNames.contains(manualDraftStoreName)) {
        db.createObjectStore(manualDraftStoreName, { keyPath: "user_id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("打开本地账单缓存失败。"));
    };
  });
}

export async function readCachedTransactions(userId: string): Promise<Transaction[]> {
  const db = await openLocalDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(transactionStoreName, "readonly");
    const store = transaction.objectStore(transactionStoreName);
    const index = store.index("user_id");
    const request = index.getAll(IDBKeyRange.only(userId));

    request.onsuccess = () => {
      const rows = (request.result as CachedTransaction[]).map(fromCachedTransaction);
      resolve(rows);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("读取本地账单缓存失败。"));
    };

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("读取本地账单缓存失败。"));
    };
  });
}

export async function replaceCachedTransactions(
  userId: string,
  transactions: Transaction[],
): Promise<SyncMeta> {
  const db = await openLocalDb();
  const now = new Date().toISOString();
  const cachedTransactions = transactions.map((transaction) => toCachedTransaction(transaction, now));
  const nextMeta: SyncMeta = {
    user_id: userId,
    last_attempt_at: now,
    last_successful_sync_at: now,
    transaction_count: cachedTransactions.length,
    last_error: null,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([transactionStoreName, syncMetaStoreName], "readwrite");
    const transactionStore = transaction.objectStore(transactionStoreName);
    const syncMetaStore = transaction.objectStore(syncMetaStoreName);
    const userIndex = transactionStore.index("user_id");
    const cursorRequest = userIndex.openCursor(IDBKeyRange.only(userId));

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;

      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }

      for (const cachedTransaction of cachedTransactions) {
        transactionStore.put(cachedTransaction);
      }

      syncMetaStore.put(nextMeta);
    };

    cursorRequest.onerror = () => {
      reject(cursorRequest.error ?? new Error("清理本地账单缓存失败。"));
    };

    transaction.oncomplete = () => {
      db.close();
      resolve(nextMeta);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("写入本地账单缓存失败。"));
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("写入本地账单缓存已中止。"));
    };
  });
}

export async function readSyncMeta(userId: string): Promise<SyncMeta | null> {
  const db = await openLocalDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(syncMetaStoreName, "readonly");
    const store = transaction.objectStore(syncMetaStoreName);
    const request = store.get(userId);

    request.onsuccess = () => {
      resolve((request.result as SyncMeta | undefined) ?? null);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("读取本地同步状态失败。"));
    };

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("读取本地同步状态失败。"));
    };
  });
}

export async function recordSyncFailure(userId: string, message: string): Promise<SyncMeta> {
  const db = await openLocalDb();
  const now = new Date().toISOString();
  let savedMeta: SyncMeta | null = null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(syncMetaStoreName, "readwrite");
    const store = transaction.objectStore(syncMetaStoreName);
    const readRequest = store.get(userId);

    readRequest.onsuccess = () => {
      const currentMeta = (readRequest.result as SyncMeta | undefined) ?? {
        user_id: userId,
        last_attempt_at: null,
        last_successful_sync_at: null,
        transaction_count: 0,
        last_error: null,
      };
      const nextMeta: SyncMeta = {
        ...currentMeta,
        last_attempt_at: now,
        last_error: message,
      };

      savedMeta = nextMeta;
      store.put(nextMeta);
    };

    readRequest.onerror = () => {
      reject(readRequest.error ?? new Error("记录同步失败状态失败。"));
    };

    transaction.oncomplete = () => {
      db.close();
      resolve(
        savedMeta ?? {
          user_id: userId,
          last_attempt_at: now,
          last_successful_sync_at: null,
          transaction_count: 0,
          last_error: message,
        },
      );
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("记录同步失败状态失败。"));
    };
  });
}

export async function readManualTransactionDraft(
  userId: string,
): Promise<ManualTransactionDraftCache | null> {
  const db = await openLocalDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(manualDraftStoreName, "readonly");
    const store = transaction.objectStore(manualDraftStoreName);
    const request = store.get(userId);

    request.onsuccess = () => {
      resolve((request.result as ManualTransactionDraftCache | undefined) ?? null);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("读取本设备草稿失败。"));
    };

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("读取本设备草稿失败。"));
    };
  });
}

export async function saveManualTransactionDraft(
  draft: ManualTransactionDraftCache,
): Promise<void> {
  const db = await openLocalDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(manualDraftStoreName, "readwrite");
    const store = transaction.objectStore(manualDraftStoreName);
    store.put(draft);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("保存本设备草稿失败。"));
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("保存本设备草稿已中止。"));
    };
  });
}

export async function deleteManualTransactionDraft(userId: string): Promise<void> {
  const db = await openLocalDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(manualDraftStoreName, "readwrite");
    const store = transaction.objectStore(manualDraftStoreName);
    store.delete(userId);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("删除本设备草稿失败。"));
    };
  });
}

export async function clearUserLocalData(userId: string): Promise<void> {
  const db = await openLocalDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [transactionStoreName, syncMetaStoreName, manualDraftStoreName],
      "readwrite",
    );
    const transactionStore = transaction.objectStore(transactionStoreName);
    const syncMetaStore = transaction.objectStore(syncMetaStoreName);
    const manualDraftStore = transaction.objectStore(manualDraftStoreName);
    const userIndex = transactionStore.index("user_id");
    const cursorRequest = userIndex.openCursor(IDBKeyRange.only(userId));

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;

      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }

      syncMetaStore.delete(userId);
      manualDraftStore.delete(userId);
    };

    cursorRequest.onerror = () => {
      reject(cursorRequest.error ?? new Error("清理本设备数据失败。"));
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("清理本设备数据失败。"));
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("清理本设备数据已中止。"));
    };
  });
}
