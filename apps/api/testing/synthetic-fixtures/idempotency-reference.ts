/**
 * Reference implementation of the three flows in
 * `docs/architecture/drafts/idempotency-pattern.md`, backed by an in-memory
 * store. Test-only — the production version lives in the api and is backed by
 * a Prisma `IdempotencyRecord` table.
 *
 *  - Case A: DB-only single-transaction. Create the key FIRST (unique key
 *    arbitrates duplicates), run the business logic, mark COMPLETED with the
 *    stored payload. On failure the transaction rolls back and the key vanishes
 *    with the work — a retry sees no record and starts fresh.
 *
 *  - Case B: effect crosses an external system. Phase 1 (own short tx,
 *    COMMITTED before the call) writes a PROCESSING row with the request
 *    fingerprint. External call runs OUTSIDE any tx. Phase 2 (own tx) marks
 *    COMPLETED with the provider's returned id. A mid-call failure leaves
 *    PROCESSING — that is the FEATURE. A reaper resolves stale PROCESSING rows
 *    by PROBING the provider ("did the entity with this reference land?"),
 *    never by assumption ([[LL-39]]).
 *
 *  - withDegrade: outbound side-effect wrapper. On any failure it writes a
 *    delivery-audit entry and returns. Never throws upward, so the primary
 *    action survives (Forms v2 §4.4 bar).
 */

export type IdempotencyStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export interface IdempotencyRecord {
  key: string;
  status: IdempotencyStatus;
  requestFingerprint?: string;
  responsePayload?: unknown;
  providerReference?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * In-memory stand-in for the eventual Prisma `IdempotencyRecord` table. The
 * key is the unique constraint. `createIfAbsent` is the analogue of
 * `create` + P2002-catch: it never TOCTOU-races.
 */
export class IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();

  createIfAbsent(
    key: string,
    initial: Omit<IdempotencyRecord, "key" | "createdAt" | "updatedAt">,
  ): { created: boolean; record: IdempotencyRecord } {
    const existing = this.records.get(key);
    if (existing) return { created: false, record: existing };
    const now = Date.now();
    const record: IdempotencyRecord = { key, ...initial, createdAt: now, updatedAt: now };
    this.records.set(key, record);
    return { created: true, record };
  }

  get(key: string): IdempotencyRecord | null {
    return this.records.get(key) ?? null;
  }

  update(key: string, patch: Partial<Omit<IdempotencyRecord, "key" | "createdAt">>): IdempotencyRecord {
    const existing = this.records.get(key);
    if (!existing) throw new Error(`IdempotencyStore.update: missing key ${key}`);
    const updated: IdempotencyRecord = { ...existing, ...patch, updatedAt: Date.now() };
    this.records.set(key, updated);
    return updated;
  }

  delete(key: string): void {
    this.records.delete(key);
  }

  size(): number {
    return this.records.size;
  }
}

// --- Case A ----------------------------------------------------------------

/**
 * Single-transaction idempotency. Simulates the "key vanishes on rollback"
 * property by deleting the key in the catch — in real code the Prisma tx
 * rollback does this atomically.
 */
export async function runCaseA<T>(
  store: IdempotencyStore,
  key: string,
  businessFn: () => Promise<T> | T,
): Promise<T> {
  const { created, record } = store.createIfAbsent(key, { status: "PROCESSING" });
  if (!created) {
    if (record.status === "COMPLETED") {
      return record.responsePayload as T;
    }
    throw new Error(`runCaseA: key ${key} already in flight (status=${record.status})`);
  }
  try {
    const result = await businessFn();
    store.update(key, { status: "COMPLETED", responsePayload: result });
    return result;
  } catch (err) {
    // Simulate transaction rollback: the key row vanishes WITH the work.
    store.delete(key);
    throw err;
  }
}

// --- Case B ----------------------------------------------------------------

export interface ProbeResult<T> {
  landed: boolean;
  providerReference?: string;
  responsePayload?: T;
}

/**
 * Two-phase idempotency for external calls. Phase 1 commits a PROCESSING row.
 * The external call runs outside any tx. Phase 2 marks COMPLETED.
 *
 * A retry that finds PROCESSING does NOT re-fire the call — it hands off to
 * the reaper (`reapCaseB`), which probes the provider and only completes the
 * record if the entity actually landed.
 */
export async function runCaseB<T>(
  store: IdempotencyStore,
  key: string,
  externalCall: () => Promise<{ providerReference: string; payload: T }>,
): Promise<T> {
  const { created, record } = store.createIfAbsent(key, {
    status: "PROCESSING",
    requestFingerprint: key,
  });
  if (!created) {
    if (record.status === "COMPLETED") {
      return record.responsePayload as T;
    }
    throw new Error(`runCaseB: key ${key} is PROCESSING — call reapCaseB, do not re-fire`);
  }
  const result = await externalCall();
  store.update(key, {
    status: "COMPLETED",
    responsePayload: result.payload,
    providerReference: result.providerReference,
  });
  return result.payload;
}

/**
 * Reaper for stale PROCESSING rows. Probes the provider to decide:
 *  - landed → mark COMPLETED with the provider's data
 *  - not landed → mark FAILED so a caller can retry with a fresh key
 *
 * Never assumes. Never blindly re-fires the external call. Matches the
 * pattern doc's Case B step 4 and the [[LL-39]] "prove the instrument" rule.
 */
export async function reapCaseB<T>(
  store: IdempotencyStore,
  key: string,
  probe: () => Promise<ProbeResult<T>> | ProbeResult<T>,
): Promise<IdempotencyRecord> {
  const record = store.get(key);
  if (!record) throw new Error(`reapCaseB: missing key ${key}`);
  if (record.status !== "PROCESSING") return record;
  const probed = await probe();
  if (probed.landed) {
    return store.update(key, {
      status: "COMPLETED",
      providerReference: probed.providerReference,
      responsePayload: probed.responsePayload,
    });
  }
  return store.update(key, { status: "FAILED" });
}

// --- Degrade, never crash --------------------------------------------------

export interface DeliveryAuditEntry {
  key: string;
  ok: boolean;
  error?: string;
  at: number;
}

/**
 * Wrap an outbound side-effect. On failure it writes a delivery-audit entry
 * and returns — the primary action already succeeded and must not be undone
 * by a downstream integration hiccup (Forms v2 §4.4).
 */
export async function withDegrade(
  key: string,
  sideEffect: () => Promise<void> | void,
  audit: DeliveryAuditEntry[],
): Promise<{ ok: boolean }> {
  try {
    await sideEffect();
    audit.push({ key, ok: true, at: Date.now() });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    audit.push({ key, ok: false, error: message, at: Date.now() });
    return { ok: false };
  }
}
