// =============================================================================
// scripts/crm/__tests__/backfill-accounts.spec.mjs
// =============================================================================
// Unit tests for backfill-accounts.mjs.
//
// Mocked Prisma -- no live DB required.
// Run with:
//   node --test scripts/crm/__tests__/backfill-accounts.spec.mjs
//
// Test cases:
//   1. lifecycleStatus derivation: ACTIVE / PAST / PROSPECT for three shapes
//   2. Boundary: tender updatedAt exactly at the window edge counts as ACTIVE
//   3. Client that already has an Account is skipped -- zero writes
//   4. --dry-run (and no flags) produces zero write calls
//   5. Idempotency: second run over same input produces zero writes
// =============================================================================

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveLifecycleStatus,
  computeCutoff,
  run,
  parseArgs,
} from "../backfill-accounts.mjs";

// ---------------------------------------------------------------------------
// Helper: build a Date that is exactly N months ago from `now`
// ---------------------------------------------------------------------------
function monthsAgo(months, now = new Date()) {
  return computeCutoff(now, months);
}

// ---------------------------------------------------------------------------
// 1. deriveLifecycleStatus -- three input shapes
// ---------------------------------------------------------------------------

test("1a: client with a recent tender (6 months ago) -> ACTIVE", () => {
  const now = new Date("2026-08-25T00:00:00.000Z");
  const tenderClients = [
    { tenderUpdatedAt: new Date("2026-02-25T00:00:00.000Z") }, // 6 months ago
  ];
  assert.equal(deriveLifecycleStatus(tenderClients, now), "ACTIVE");
});

test("1b: client whose only tender is 18 months ago -> PAST", () => {
  const now = new Date("2026-08-25T00:00:00.000Z");
  const tenderClients = [
    { tenderUpdatedAt: new Date("2025-02-25T00:00:00.000Z") }, // 18 months ago
  ];
  assert.equal(deriveLifecycleStatus(tenderClients, now), "PAST");
});

test("1c: client with no TenderClient rows -> PROSPECT", () => {
  assert.equal(deriveLifecycleStatus([], new Date()), "PROSPECT");
});

test("1d: null/undefined tenderClients array -> PROSPECT", () => {
  assert.equal(deriveLifecycleStatus(null, new Date()), "PROSPECT");
  assert.equal(deriveLifecycleStatus(undefined, new Date()), "PROSPECT");
});

// ---------------------------------------------------------------------------
// 2. Boundary: exactly at the window edge (>= cutoff) counts as ACTIVE
// ---------------------------------------------------------------------------

test("2: tender updatedAt exactly at the 12-month cutoff -> ACTIVE (>= not >)", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const cutoff = computeCutoff(now, 12);
  // Exactly at the cutoff: should be ACTIVE because condition is >=
  const tenderClients = [{ tenderUpdatedAt: cutoff }];
  assert.equal(deriveLifecycleStatus(tenderClients, now), "ACTIVE");
});

test("2b: tender updatedAt 1ms before the cutoff -> PAST", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const cutoff = computeCutoff(now, 12);
  const justBefore = new Date(cutoff.getTime() - 1);
  const tenderClients = [{ tenderUpdatedAt: justBefore }];
  assert.equal(deriveLifecycleStatus(tenderClients, now), "PAST");
});

// ---------------------------------------------------------------------------
// 3. Client that already has an Account -> skipped, ZERO write attempts
// ---------------------------------------------------------------------------

test("3: client with existing Account is skipped -- account.create never called", async () => {
  const createCalls = [];

  const mockPrisma = {
    tenderClient: {
      findMany: async () => [
        {
          clientId: "client-already-has-account",
          client: { name: "Existing Corp" },
          tender: { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
        },
      ],
    },
    account: {
      findMany: async () => [
        // This client already has an Account
        { clientId: "client-already-has-account" },
      ],
      create: async (data) => {
        createCalls.push(data);
        return data;
      },
    },
  };

  const logs = [];
  const result = await run({
    mode: "apply",
    prisma: mockPrisma,
    now: new Date("2026-08-25T00:00:00.000Z"),
    log: (msg) => logs.push(msg),
  });

  assert.equal(createCalls.length, 0, "account.create must never be called");
  assert.equal(result.alreadyExists, 1);
  assert.equal(result.wouldCreate, 0);
  assert.equal(result.failed, 0);
  assert.ok(
    logs.some((l) => l.includes("already exists")),
    "log must mention already exists"
  );
});

// ---------------------------------------------------------------------------
// 4. --dry-run (and no flags) -> zero writes
// ---------------------------------------------------------------------------

test("4a: mode=dry-run -> account.create is never called", async () => {
  const createCalls = [];

  const mockPrisma = {
    tenderClient: {
      findMany: async () => [
        {
          clientId: "client-new",
          client: { name: "New Corp" },
          tender: { updatedAt: new Date("2026-07-01T00:00:00.000Z") },
        },
      ],
    },
    account: {
      findMany: async () => [], // no existing accounts
      create: async (data) => {
        createCalls.push(data);
        return data;
      },
    },
  };

  const result = await run({
    mode: "dry-run",
    prisma: mockPrisma,
    now: new Date("2026-08-25T00:00:00.000Z"),
    log: () => {},
  });

  assert.equal(createCalls.length, 0, "no writes on dry-run");
  assert.equal(result.wouldCreate, 1);
  assert.equal(result.alreadyExists, 0);
});

test("4b: parseArgs with no flags -> mode=dry-run", () => {
  const result = parseArgs(["node", "script.mjs"]);
  assert.equal(result.mode, "dry-run");
});

test("4c: parseArgs with --dry-run -> mode=dry-run", () => {
  const result = parseArgs(["node", "script.mjs", "--dry-run"]);
  assert.equal(result.mode, "dry-run");
});

test("4d: parseArgs with --apply -> mode=apply", () => {
  const result = parseArgs(["node", "script.mjs", "--apply"]);
  assert.equal(result.mode, "apply");
});

test("4e: parseArgs with --help -> mode=help", () => {
  const result = parseArgs(["node", "script.mjs", "--help"]);
  assert.equal(result.mode, "help");
});

test("4f: parseArgs with -h -> mode=help", () => {
  const result = parseArgs(["node", "script.mjs", "-h"]);
  assert.equal(result.mode, "help");
});

test("4g: parseArgs with --help and --dry-run -> mode=help (help wins)", () => {
  const result = parseArgs(["node", "script.mjs", "--dry-run", "--help"]);
  assert.equal(result.mode, "help");
});

test("4h: parseArgs with unknown flag -> mode=error", () => {
  const result = parseArgs(["node", "script.mjs", "--unknown"]);
  assert.equal(result.mode, "error");
});

// ---------------------------------------------------------------------------
// 5. Idempotency: second run over same input -> zero writes
// ---------------------------------------------------------------------------

test("5: second run over same input produces zero new Account rows", async () => {
  // Simulate: first run writes the Account. Second run finds it in findMany.
  const CLIENT_ID = "client-idempotent";
  const writtenAccounts = new Set();

  function buildMock(firstRun) {
    return {
      tenderClient: {
        findMany: async () => [
          {
            clientId: CLIENT_ID,
            client: { name: "Idempotent Corp" },
            tender: { updatedAt: new Date("2026-07-01T00:00:00.000Z") },
          },
        ],
      },
      account: {
        findMany: async () =>
          // Second run: the account now exists in the set
          firstRun
            ? []
            : [{ clientId: CLIENT_ID }],
        create: async (data) => {
          if (writtenAccounts.has(data.data.clientId)) {
            throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
          }
          writtenAccounts.add(data.data.clientId);
          return data;
        },
      },
    };
  }

  const now = new Date("2026-08-25T00:00:00.000Z");

  // First run: should create 1 row
  const run1 = await run({
    mode: "apply",
    prisma: buildMock(true),
    now,
    log: () => {},
  });
  assert.equal(run1.wouldCreate, 1, "first run must create 1 row");
  assert.equal(run1.failed, 0);

  // Second run: account already exists, zero new writes
  const run2 = await run({
    mode: "apply",
    prisma: buildMock(false),
    now,
    log: () => {},
  });
  assert.equal(run2.wouldCreate, 0, "second run must create 0 rows");
  assert.equal(run2.alreadyExists, 1, "second run must report 1 already-exists");
  assert.equal(run2.failed, 0);
  assert.equal(writtenAccounts.size, 1, "only one Account was ever written");
});

// ---------------------------------------------------------------------------
// 6. Multiple clients -- mixed states (integration of derivation + runner)
// ---------------------------------------------------------------------------

test("6: mixed clients: one ACTIVE, one PAST, one already-has-account", async () => {
  const now = new Date("2026-08-25T00:00:00.000Z");
  const createCalls = [];

  const mockPrisma = {
    tenderClient: {
      findMany: async () => [
        {
          clientId: "client-active",
          client: { name: "Active Corp" },
          tender: { updatedAt: new Date("2026-06-01T00:00:00.000Z") }, // recent
        },
        {
          clientId: "client-past",
          client: { name: "Past Corp" },
          tender: { updatedAt: new Date("2024-01-01T00:00:00.000Z") }, // old
        },
        {
          clientId: "client-with-account",
          client: { name: "Already Linked Corp" },
          tender: { updatedAt: new Date("2026-07-01T00:00:00.000Z") },
        },
      ],
    },
    account: {
      findMany: async () => [{ clientId: "client-with-account" }],
      create: async (data) => {
        createCalls.push(data);
        return data;
      },
    },
  };

  const result = await run({
    mode: "apply",
    prisma: mockPrisma,
    now,
    log: () => {},
  });

  assert.equal(result.wouldCreate, 2, "two new Accounts should be created");
  assert.equal(result.alreadyExists, 1, "one skipped");
  assert.equal(result.failed, 0);

  assert.equal(createCalls.length, 2);
  const statuses = createCalls.map((c) => c.data.lifecycleStatus).sort();
  assert.deepEqual(statuses, ["ACTIVE", "PAST"]);
});
