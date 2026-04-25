import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// IndexedDB layout for offline-queued mutations. Two stores:
//   pendingMutations — outbox of POST/PATCH calls captured while offline
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

interface OfflineDb extends DBSchema {
  pendingMutations: {
    key: string;
    value: PendingMutation;
    indexes: { "by-kind": PendingKind; "by-createdAt": number };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDb>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDb>("project-ops-offline", 1, {
      upgrade(db) {
        const store = db.createObjectStore("pendingMutations", { keyPath: "id" });
        store.createIndex("by-kind", "kind");
        store.createIndex("by-createdAt", "createdAt");
        db.createObjectStore("meta", { keyPath: "key" });
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
