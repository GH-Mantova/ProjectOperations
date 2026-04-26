import {
  bumpAttempt,
  countPending,
  deletePending,
  enqueueMutation,
  listPending,
  moveToDeadLetter,
  type PendingKind
} from "./db";

const MAX_ATTEMPTS = 5;

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type SyncResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  remaining: number;
};

// Tries to flush every queued mutation in createdAt order. Stops on the first
// network-level error so order is preserved when offline; per-row 4xx errors
// increment the attempt counter and move on. Mutations that have hit
// MAX_ATTEMPTS are kept in the queue for the user to inspect manually.
export async function flushQueue(authFetch: AuthFetch): Promise<SyncResult> {
  const pending = await listPending();
  let succeeded = 0;
  let failed = 0;

  for (const row of pending) {
    // PR F FIX 3 — anything still in the outbox at MAX_ATTEMPTS gets
    // promoted to the dead-letter store on next flush so the queue
    // stops blocking healthy mutations behind a stuck row.
    if (row.attempts >= MAX_ATTEMPTS) {
      await moveToDeadLetter(row);
      continue;
    }
    try {
      const response = await authFetch(row.url, {
        method: row.method,
        body: typeof row.body === "string" ? row.body : JSON.stringify(row.body)
      });
      if (response.ok) {
        await deletePending(row.id);
        succeeded += 1;
      } else if (response.status >= 400 && response.status < 500) {
        const text = await response.text().catch(() => `HTTP ${response.status}`);
        await bumpAttempt(row.id, text.slice(0, 200));
        failed += 1;
        // 4xx is permanent — bumping past MAX_ATTEMPTS sweeps to dead
        // letter on next pass without re-trying every flush.
        if (row.attempts + 1 >= MAX_ATTEMPTS) {
          await moveToDeadLetter({ ...row, attempts: row.attempts + 1, lastError: text.slice(0, 200) });
        }
      } else {
        await bumpAttempt(row.id, `HTTP ${response.status}`);
        failed += 1;
        break;
      }
    } catch (err) {
      await bumpAttempt(row.id, err instanceof Error ? err.message : String(err));
      failed += 1;
      break;
    }
  }

  return {
    attempted: pending.length,
    succeeded,
    failed,
    remaining: await countPending()
  };
}

export type OfflineCapableFetch = (
  url: string,
  init: { method: "POST" | "PATCH"; body: unknown },
  fallbackKind: PendingKind
) => Promise<{ queued: boolean; response?: Response; mutationId?: string }>;

// Wrapper used by mutating UIs (timesheets, safety reports). Tries the
// network first; on failure or offline, queues to IndexedDB and returns
// queued=true so the UI can confirm "saved offline — will sync".
export function buildOfflineFetch(authFetch: AuthFetch): OfflineCapableFetch {
  return async (url, init, fallbackKind) => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const response = await authFetch(url, {
          method: init.method,
          body: typeof init.body === "string" ? init.body : JSON.stringify(init.body)
        });
        if (response.ok) return { queued: false, response };
        if (response.status >= 500) {
          const m = await enqueueMutation({
            kind: fallbackKind,
            url,
            method: init.method,
            body: init.body
          });
          return { queued: true, mutationId: m.id };
        }
        return { queued: false, response };
      } catch {
        const m = await enqueueMutation({
          kind: fallbackKind,
          url,
          method: init.method,
          body: init.body
        });
        return { queued: true, mutationId: m.id };
      }
    }
    const m = await enqueueMutation({
      kind: fallbackKind,
      url,
      method: init.method,
      body: init.body
    });
    return { queued: true, mutationId: m.id };
  };
}
