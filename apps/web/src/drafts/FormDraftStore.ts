import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// PR #111 (FIX 4) — IndexedDB-backed form drafts. Lives in its own DB
// (form_drafts) separate from the PWA outbox (project-ops-offline) so
// the two concerns can evolve independently and a v-bump on one
// doesn't risk migrating the other.

export type DraftRecord = {
  userId: string;
  formType: string;
  contextKey: string | null;
  data: unknown;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
};

interface DraftsDb extends DBSchema {
  drafts: {
    // Composite key: [userId, formType] — at most one draft per
    // (user, form). contextKey is stored but not part of the key, so
    // restoring a draft when the user is on a different tender/job
    // requires the caller to compare contextKey before applying.
    key: [string, string];
    value: DraftRecord;
    indexes: {
      "by-user": string;
      "by-updated": number;
    };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown; updatedAt: number };
  };
}

// Field names that must NEVER be written to a draft. Defence-in-depth on
// top of the per-form opt-in: even if a form forgets to skip the hook,
// a password-shaped field will hard-fail the save. Matched
// case-insensitive against any key in the saved data object (top level
// only — nested objects are walked recursively).
const SENSITIVE_FIELD_REGEX = /password|secret|token|otp|cvv|card.?number/i;

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class SensitiveFieldError extends Error {
  constructor(fieldName: string) {
    super(`Refusing to save draft — field "${fieldName}" looks sensitive (denylist match).`);
    this.name = "SensitiveFieldError";
  }
}

let dbPromise: Promise<IDBPDatabase<DraftsDb>> | null = null;

function getDb(): Promise<IDBPDatabase<DraftsDb>> {
  if (!dbPromise) {
    dbPromise = openDB<DraftsDb>("form_drafts", 1, {
      upgrade(db) {
        const store = db.createObjectStore("drafts", {
          keyPath: ["userId", "formType"]
        });
        store.createIndex("by-user", "userId");
        store.createIndex("by-updated", "updatedAt");
        db.createObjectStore("meta", { keyPath: "key" });
      }
    });
  }
  return dbPromise;
}

// Walk the saved data and throw if any field name matches the
// sensitive regex. Top-level + nested. Arrays of primitives are
// fine; arrays of objects are walked.
function assertNoSensitiveFields(data: unknown, path = ""): void {
  if (data === null || typeof data !== "object") return;
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i += 1) {
      assertNoSensitiveFields(data[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELD_REGEX.test(key)) {
      throw new SensitiveFieldError(path ? `${path}.${key}` : key);
    }
    assertNoSensitiveFields(value, path ? `${path}.${key}` : key);
  }
}

export const FormDraftStore = {
  async save(
    userId: string,
    formType: string,
    contextKey: string | null,
    data: unknown,
    schemaVersion: number
  ): Promise<void> {
    if (!userId) throw new Error("userId is required to save a draft.");
    if (!formType) throw new Error("formType is required to save a draft.");
    assertNoSensitiveFields(data);
    const db = await getDb();
    const existing = await db.get("drafts", [userId, formType]);
    const now = Date.now();
    await db.put("drafts", {
      userId,
      formType,
      contextKey,
      data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      schemaVersion
    });
  },

  async get(userId: string, formType: string): Promise<DraftRecord | null> {
    if (!userId || !formType) return null;
    const db = await getDb();
    const row = await db.get("drafts", [userId, formType]);
    return row ?? null;
  },

  async delete(userId: string, formType: string): Promise<void> {
    if (!userId || !formType) return;
    const db = await getDb();
    await db.delete("drafts", [userId, formType]);
  },

  async list(userId: string): Promise<DraftRecord[]> {
    if (!userId) return [];
    const db = await getDb();
    return db.getAllFromIndex("drafts", "by-user", userId);
  },

  // Daily purge sweep — caller invokes once per session after auth
  // resolves. Returns the count purged so the caller can log in dev.
  async purgeExpired(now: number = Date.now()): Promise<number> {
    const db = await getDb();
    const cutoff = now - PURGE_AFTER_MS;
    const all = await db.getAll("drafts");
    let purged = 0;
    for (const row of all) {
      if (row.updatedAt < cutoff) {
        await db.delete("drafts", [row.userId, row.formType]);
        purged += 1;
      }
    }
    return purged;
  },

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await getDb();
    await db.put("meta", { key, value, updatedAt: Date.now() });
  },

  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    const db = await getDb();
    const row = await db.get("meta", key);
    return row?.value as T | undefined;
  },

  // Test-only: reset the cached connection so unit tests can rebuild
  // the DB between cases. Not for production use.
  __resetForTests(): void {
    dbPromise = null;
  }
};

export const __SENSITIVE_FIELD_REGEX = SENSITIVE_FIELD_REGEX;
export const __PURGE_AFTER_MS = PURGE_AFTER_MS;
