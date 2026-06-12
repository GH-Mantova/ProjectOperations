// Unit tests for the offline sync manager — the queue drain that replays
// field-app mutations once the device reconnects (backlog pr-133). The
// companion ./db module is mocked entirely with an in-memory store, so no
// IndexedDB is involved; authFetch is a per-test vi.fn(). Framework is
// Vitest, matching the rest of apps/web.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOfflineFetch, flushQueue } from "../syncManager";
import type { PendingMutation } from "../db";
import * as db from "../db";

vi.mock("../db", () => {
  let pending: PendingMutation[] = [];
  let deadLetter: Array<PendingMutation & { failedAt: number }> = [];
  let seq = 0;
  return {
    __reset: () => {
      pending = [];
      deadLetter = [];
      seq = 0;
    },
    __pending: () => pending,
    __deadLetter: () => deadLetter,
    enqueueMutation: vi.fn(async (m: Omit<PendingMutation, "id" | "createdAt" | "attempts">) => {
      seq += 1;
      const row: PendingMutation = { id: `mut-${seq}`, createdAt: seq, attempts: 0, ...m };
      pending.push(row);
      return row;
    }),
    listPending: vi.fn(async () => [...pending].sort((a, b) => a.createdAt - b.createdAt)),
    countPending: vi.fn(async () => pending.length),
    deletePending: vi.fn(async (id: string) => {
      pending = pending.filter((r) => r.id !== id);
    }),
    bumpAttempt: vi.fn(async (id: string, error?: string) => {
      pending = pending.map((r) => (r.id === id ? { ...r, attempts: r.attempts + 1, lastError: error } : r));
    }),
    moveToDeadLetter: vi.fn(async (m: PendingMutation) => {
      deadLetter.push({ ...m, failedAt: Date.now() });
      pending = pending.filter((r) => r.id !== m.id);
    })
  };
});

type MockedDb = typeof db & {
  __reset: () => void;
  __pending: () => PendingMutation[];
  __deadLetter: () => Array<PendingMutation & { failedAt: number }>;
};
const mockDb = db as MockedDb;

const response = (status: number, body = "") => new Response(body, { status });

async function seed(count: number, overrides: Partial<PendingMutation> = {}) {
  const rows: PendingMutation[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = await db.enqueueMutation({
      kind: "field-timesheet",
      url: `/api/v1/timesheets/${i}`,
      method: "POST",
      body: { index: i }
    });
    if (Object.keys(overrides).length > 0) {
      const stored = mockDb.__pending().find((r) => r.id === row.id)!;
      Object.assign(stored, overrides);
    }
    rows.push(row);
  }
  return rows;
}

beforeEach(() => {
  mockDb.__reset();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ─── flushQueue ────────────────────────────────────────────────────────────

describe("flushQueue", () => {
  it("drains an empty queue without fetching", async () => {
    const authFetch = vi.fn();

    const result = await flushQueue(authFetch);

    expect(authFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0, remaining: 0 });
  });

  it("happy path — every row succeeds, is deleted, and the tally matches", async () => {
    await seed(3);
    const authFetch = vi.fn().mockResolvedValue(response(200));

    const result = await flushQueue(authFetch);

    expect(authFetch).toHaveBeenCalledTimes(3);
    expect(db.deletePending).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ attempted: 3, succeeded: 3, failed: 0, remaining: 0 });
  });

  it("replays rows in createdAt order with the stored method/body", async () => {
    await seed(2);
    const authFetch = vi.fn().mockResolvedValue(response(200));

    await flushQueue(authFetch);

    expect(authFetch).toHaveBeenNthCalledWith(1, "/api/v1/timesheets/0", {
      method: "POST",
      body: JSON.stringify({ index: 0 })
    });
    expect(authFetch).toHaveBeenNthCalledWith(2, "/api/v1/timesheets/1", {
      method: "POST",
      body: JSON.stringify({ index: 1 })
    });
  });

  it("a 4xx bumps the attempt with the response text and moves on to the next row", async () => {
    await seed(2);
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(response(422, "validation failed"))
      .mockResolvedValueOnce(response(200));

    const result = await flushQueue(authFetch);

    expect(db.bumpAttempt).toHaveBeenCalledWith("mut-1", "validation failed");
    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1, remaining: 1 });
  });

  it("a 5xx bumps the attempt and stops the drain so order is preserved", async () => {
    await seed(3);
    const authFetch = vi.fn().mockResolvedValue(response(503));

    const result = await flushQueue(authFetch);

    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(db.bumpAttempt).toHaveBeenCalledWith("mut-1", "HTTP 503");
    expect(result).toEqual({ attempted: 3, succeeded: 0, failed: 1, remaining: 3 });
  });

  it("a thrown fetch (network down) bumps with the error message and stops, like a 5xx", async () => {
    await seed(2);
    const authFetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    const result = await flushQueue(authFetch);

    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(db.bumpAttempt).toHaveBeenCalledWith("mut-1", "Failed to fetch");
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(2);
  });

  it("sweeps rows already at MAX_ATTEMPTS to the dead letter without re-fetching them", async () => {
    await seed(1, { attempts: 5 });
    await seed(1);
    const authFetch = vi.fn().mockResolvedValue(response(200));

    const result = await flushQueue(authFetch);

    expect(db.moveToDeadLetter).toHaveBeenCalledWith(expect.objectContaining({ id: "mut-1" }));
    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(authFetch).toHaveBeenCalledWith("/api/v1/timesheets/0", expect.anything());
    expect(mockDb.__deadLetter()).toHaveLength(1);
    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 0, remaining: 0 });
  });

  it("a 4xx that lands on the final attempt is promoted to the dead letter immediately", async () => {
    await seed(1, { attempts: 4 });
    const authFetch = vi.fn().mockResolvedValue(response(400, "bad payload"));

    const result = await flushQueue(authFetch);

    expect(db.bumpAttempt).toHaveBeenCalledWith("mut-1", "bad payload");
    expect(db.moveToDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mut-1", attempts: 5, lastError: "bad payload" })
    );
    expect(result.remaining).toBe(0);
  });

  it("a 4xx below the final attempt stays in the queue (no dead-letter)", async () => {
    await seed(1, { attempts: 2 });
    const authFetch = vi.fn().mockResolvedValue(response(400, "bad payload"));

    await flushQueue(authFetch);

    expect(db.moveToDeadLetter).not.toHaveBeenCalled();
    expect(mockDb.__pending()[0]).toMatchObject({ attempts: 3, lastError: "bad payload" });
  });

  it("truncates long 4xx error bodies to 200 chars", async () => {
    await seed(1);
    const authFetch = vi.fn().mockResolvedValue(response(400, "e".repeat(500)));

    await flushQueue(authFetch);

    const bump = vi.mocked(db.bumpAttempt);
    expect((bump.mock.calls[0][1] as string).length).toBe(200);
  });

  it("sends string bodies through untouched instead of double-encoding", async () => {
    await db.enqueueMutation({
      kind: "safety-incident",
      url: "/api/v1/safety/incidents",
      method: "POST",
      body: '{"already":"json"}'
    });
    const authFetch = vi.fn().mockResolvedValue(response(200));

    await flushQueue(authFetch);

    expect(authFetch).toHaveBeenCalledWith("/api/v1/safety/incidents", {
      method: "POST",
      body: '{"already":"json"}'
    });
  });
});

// ─── buildOfflineFetch ─────────────────────────────────────────────────────

describe("buildOfflineFetch", () => {
  const init = { method: "POST" as const, body: { note: "prestart" } };

  it("returns the response without queueing when online and the call succeeds", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const authFetch = vi.fn().mockResolvedValue(response(200));
    const offlineFetch = buildOfflineFetch(authFetch);

    const result = await offlineFetch("/api/v1/prestarts", init, "field-prestart");

    expect(result.queued).toBe(false);
    expect(result.response?.status).toBe(200);
    expect(db.enqueueMutation).not.toHaveBeenCalled();
  });

  it("queues on a 5xx so the mutation survives a flaky server", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const authFetch = vi.fn().mockResolvedValue(response(502));
    const offlineFetch = buildOfflineFetch(authFetch);

    const result = await offlineFetch("/api/v1/prestarts", init, "field-prestart");

    expect(result.queued).toBe(true);
    expect(result.mutationId).toBe("mut-1");
    expect(db.enqueueMutation).toHaveBeenCalledWith({
      kind: "field-prestart",
      url: "/api/v1/prestarts",
      method: "POST",
      body: { note: "prestart" }
    });
  });

  it("does NOT queue a 4xx — permanent rejections surface to the caller", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const authFetch = vi.fn().mockResolvedValue(response(403));
    const offlineFetch = buildOfflineFetch(authFetch);

    const result = await offlineFetch("/api/v1/prestarts", init, "field-prestart");

    expect(result.queued).toBe(false);
    expect(result.response?.status).toBe(403);
    expect(db.enqueueMutation).not.toHaveBeenCalled();
  });

  it("queues when the fetch throws (network drop mid-request)", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const authFetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const offlineFetch = buildOfflineFetch(authFetch);

    const result = await offlineFetch("/api/v1/prestarts", init, "field-prestart");

    expect(result.queued).toBe(true);
    expect(result.mutationId).toBe("mut-1");
  });

  it("queues immediately without touching the network while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const authFetch = vi.fn();
    const offlineFetch = buildOfflineFetch(authFetch);

    const result = await offlineFetch("/api/v1/timesheets", init, "field-timesheet");

    expect(authFetch).not.toHaveBeenCalled();
    expect(result.queued).toBe(true);
    expect(db.enqueueMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "field-timesheet" })
    );
  });

  it("stringifies object bodies once and passes string bodies through", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const authFetch = vi.fn().mockResolvedValue(response(200));
    const offlineFetch = buildOfflineFetch(authFetch);

    await offlineFetch("/api/v1/a", { method: "PATCH", body: { v: 1 } }, "field-timesheet");
    await offlineFetch("/api/v1/b", { method: "POST", body: '{"raw":true}' }, "field-timesheet");

    expect(authFetch).toHaveBeenNthCalledWith(1, "/api/v1/a", {
      method: "PATCH",
      body: JSON.stringify({ v: 1 })
    });
    expect(authFetch).toHaveBeenNthCalledWith(2, "/api/v1/b", {
      method: "POST",
      body: '{"raw":true}'
    });
  });
});
