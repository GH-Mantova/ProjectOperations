import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// IndexedDB layout for offline-queued mutations. Stores:
//   pendingMutations — outbox of POST/PATCH calls captured while offline
//   deadLetter       — mutations that exceeded MAX_ATTEMPTS (PR F FIX 3)
//   meta             — last-sync timestamps, etc.

export type PendingKind = "field-timesheet" | "field-prestart" | "safety-incident" | "safety-hazard";

export type PendingMutation = {
  id: string;
  kind: PendingKind;
  url: string;
  method: "POST" | "PATCH";
  body: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type DeadLetterMutation = PendingMutation & {
  failedAt: number;
};

interface OfflineDb extends DBSchema {
  pendingMutations: {
    key: string;
    value: PendingMutation;
    indexes: { "by-kind": PendingKind; "by-createdAt": number };
  };
  deadLetter: {
    key: string;
    value: DeadLetterMutation;
    indexes: { "by-failedAt": number };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDb>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDb>("project-ops-offline", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("pendingMutations", { keyPath: "id" });
          store.createIndex("by-kind", "kind");
          store.createIndex("by-createdAt", "createdAt");
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (oldVersion < 2) {
          // PR F FIX 3 — dead-letter store added in v2. Existing v1 dbs
          // get the new store on next open without losing pending rows.
          const dl = db.createObjectStore("deadLetter", { keyPath: "id" });
          dl.createIndex("by-failedAt", "failedAt");
        }
      }
    });
  }
  return dbPromise;
}

export async function enqueueMutation(
  m: Omit<PendingMutation, "id" | "createdAt" | "attempts">
): Promise<PendingMutation> {
  const db = await getDb();
  const row: PendingMutation = {
    id: `${m.kind}::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
    ...m
  };
  await db.put("pendingMutations", row);
  return row;
}

export async function listPending(): Promise<PendingMutation[]> {
  const db = await getDb();
  return (await db.getAll("pendingMutations")).sort((a, b) => a.createdAt - b.createdAt);
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  return db.count("pendingMutations");
}

export async function deletePending(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("pendingMutations", id);
}

export async function bumpAttempt(id: string, error?: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get("pendingMutations", id);
  if (!existing) return;
  await db.put("pendingMutations", {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: error
  });
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, value, updatedAt: Date.now() });
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.get("meta", key);
  return row?.value as T | undefined;
}

// PR F FIX 3 — dead-letter helpers. Items land here once the sync manager
// gives up, so the field user can review what failed instead of staring at
// a perpetually-stuck queue.

export async function moveToDeadLetter(m: PendingMutation): Promise<void> {
  const db = await getDb();
  await db.put("deadLetter", { ...m, failedAt: Date.now() });
  await db.delete("pendingMutations", m.id);
}

export async function listDeadLetter(): Promise<DeadLetterMutation[]> {
  const db = await getDb();
  return (await db.getAll("deadLetter")).sort((a, b) => b.failedAt - a.failedAt);
}

export async function countDeadLetter(): Promise<number> {
  const db = await getDb();
  return db.count("deadLetter");
}

export async function deleteDeadLetter(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("deadLetter", id);
}

export async function retryDeadLetter(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.get("deadLetter", id);
  if (!row) return;
  // Reset attempts so the row gets a fresh shot at the network on the
  // next flush. lastError is preserved as a breadcrumb.
  await db.put("pendingMutations", {
    id: row.id,
    kind: row.kind,
    url: row.url,
    method: row.method,
    body: row.body,
    createdAt: row.createdAt,
    attempts: 0,
    lastError: row.lastError
  });
  await db.delete("deadLetter", id);
}
