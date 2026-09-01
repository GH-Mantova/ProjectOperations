// =============================================================================
// scripts/crm/__tests__/recompute-client-stats.spec.mjs
// =============================================================================
// Unit tests for recompute-client-stats.mjs.
//
// Uses a mocked PrismaClient -- no live DB required.
// Run with:
//   pnpm vitest run scripts/crm/__tests__/recompute-client-stats.spec.mjs
//
// Test cases:
//   1. Client with 3 linked scored tenders, 1 won -> 3/1/33.33
//   2. Client whose cached values are already correct -> zero delta, no write
//   3. Client with inflated win_count (historical over-count) is brought DOWN
//   4. Client reached only through a bypass path is brought UP
//   5. tender_count = 0 -> win_rate = 0, no division error
//   6. Default and --dry-run perform zero writes
//   7. --apply without a successful snapshot refuses and exits non-zero
//   8. Idempotence: running twice changes nothing the second time
// =============================================================================

import { describe, expect, it, vi } from "vitest";
import {
  computeStats,
  parseArgs,
  run,
  writeSnapshot,
} from "../recompute-client-stats.mjs";

// ---------------------------------------------------------------------------
// Helper: build a mock PrismaClient
//
// clients: array of { id, name, tenderCount, winCount, winRate }
// tenderLinks: array of { clientId, tender: { tenderScoreCounted, wonAt, status } }
// ---------------------------------------------------------------------------
function buildMock({ clients = [], tenderLinks = [] } = {}) {
  const updateCalls = [];

  const mockPrisma = {
    client: {
      findMany: vi.fn(async () => clients),
      update: vi.fn(async ({ where, data }) => {
        updateCalls.push({ where, data });
        return { ...clients.find((c) => c.id === where.id), ...data };
      }),
    },
    tenderClient: {
      findMany: vi.fn(async () => tenderLinks),
    },
    $transaction: vi.fn(async (ops) => {
      // ops is an array of Promises (from prisma.client.update calls)
      return Promise.all(ops);
    }),
  };

  return { mockPrisma, updateCalls };
}

// ---------------------------------------------------------------------------
// 1. computeStats: 3 scored tenders, 1 won -> 3 / 1 / 33.33
// ---------------------------------------------------------------------------

describe("computeStats", () => {
  it("1: 3 scored tenders, 1 won -> tender_count=3, win_count=1, win_rate=33.33", () => {
    const tenders = [
      { tenderScoreCounted: true, wonAt: new Date("2026-01-01"), status: "AWARDED" },
      { tenderScoreCounted: true, wonAt: null, status: "LOST" },
      { tenderScoreCounted: true, wonAt: null, status: "SUBMITTED" },
    ];
    const result = computeStats(tenders);
    expect(result.tenderCount).toBe(3);
    expect(result.winCount).toBe(1);
    expect(result.winRate).toBe(33.33);
  });

  it("1b: un-scored tenders are excluded from all counts", () => {
    const tenders = [
      { tenderScoreCounted: false, wonAt: new Date(), status: "AWARDED" },
      { tenderScoreCounted: false, wonAt: null, status: "LOST" },
    ];
    const result = computeStats(tenders);
    expect(result.tenderCount).toBe(0);
    expect(result.winCount).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it("3: inflated win_count scenario: 2 scored, 0 actually won -> win_count=0", () => {
    const tenders = [
      { tenderScoreCounted: true, wonAt: null, status: "LOST" },
      { tenderScoreCounted: true, wonAt: null, status: "SUBMITTED" },
    ];
    const result = computeStats(tenders);
    expect(result.tenderCount).toBe(2);
    expect(result.winCount).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it("4: bypass-path wins: status IN (AWARDED|CONTRACT_ISSUED|CONVERTED) counts even when wonAt=null", () => {
    const tenders = [
      { tenderScoreCounted: true, wonAt: null, status: "AWARDED" },
      { tenderScoreCounted: true, wonAt: null, status: "CONTRACT_ISSUED" },
      { tenderScoreCounted: true, wonAt: null, status: "CONVERTED" },
      { tenderScoreCounted: true, wonAt: null, status: "LOST" },
    ];
    const result = computeStats(tenders);
    expect(result.tenderCount).toBe(4);
    expect(result.winCount).toBe(3);
    expect(result.winRate).toBe(75);
  });

  it("5: tender_count=0 -> win_rate=0 (no division error)", () => {
    const result = computeStats([]);
    expect(result.tenderCount).toBe(0);
    expect(result.winCount).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it("5b: all tenders un-scored -> tender_count=0 -> win_rate=0", () => {
    const tenders = [
      { tenderScoreCounted: false, wonAt: null, status: "LOST" },
    ];
    const result = computeStats(tenders);
    expect(result.tenderCount).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it("win_count never exceeds tender_count", () => {
    const tenders = [
      { tenderScoreCounted: true, wonAt: new Date(), status: "AWARDED" },
      { tenderScoreCounted: true, wonAt: new Date(), status: "CONTRACT_ISSUED" },
    ];
    const result = computeStats(tenders);
    expect(result.winCount).toBeLessThanOrEqual(result.tenderCount);
    expect(result.winRate).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 2. run() in dry-run: client already correct -> zero delta, no write calls
// ---------------------------------------------------------------------------

describe("run() -- no change case", () => {
  it("2: cached values already correct -> no update calls", async () => {
    const { mockPrisma, updateCalls } = buildMock({
      clients: [
        { id: "c1", name: "Corp A", tenderCount: 2, winCount: 1, winRate: 50 },
      ],
      tenderLinks: [
        { clientId: "c1", tender: { tenderScoreCounted: true, wonAt: new Date(), status: "AWARDED" } },
        { clientId: "c1", tender: { tenderScoreCounted: true, wonAt: null, status: "LOST" } },
      ],
    });

    const logs = [];
    const result = await run({
      mode: "dry-run",
      snapshotPath: null,
      prisma: mockPrisma,
      log: (m) => logs.push(m),
    });

    expect(result.wouldChange).toBe(0);
    expect(updateCalls.length).toBe(0);
    expect(logs.some((l) => l.includes("no change"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. run() -- inflated win_count brought DOWN
// ---------------------------------------------------------------------------

describe("run() -- win_count brought down", () => {
  it("3: inflated win_count (2 cached, 0 actual) -> delta reported, write in apply mode", async () => {
    const { mockPrisma } = buildMock({
      clients: [
        // Cached win_count=2, but computed will be 0
        { id: "c-down", name: "Inflated Corp", tenderCount: 2, winCount: 2, winRate: 100 },
      ],
      tenderLinks: [
        { clientId: "c-down", tender: { tenderScoreCounted: true, wonAt: null, status: "LOST" } },
        { clientId: "c-down", tender: { tenderScoreCounted: true, wonAt: null, status: "SUBMITTED" } },
      ],
    });

    const logs = [];
    const result = await run({
      mode: "apply",
      snapshotPath: null,
      snapshotWritten: true,
      prisma: mockPrisma,
      log: (m) => logs.push(m),
    });

    expect(result.wouldChange).toBe(1);
    expect(result.wouldDecrease).toBe(1);
    expect(result.wouldIncrease).toBe(0);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. run() -- bypass-path client brought UP
// ---------------------------------------------------------------------------

describe("run() -- bypass-path client brought up", () => {
  it("4: win_count=0 cached, bypass-path status AWARDED -> brought up to 1", async () => {
    const { mockPrisma } = buildMock({
      clients: [
        // Cached: 1 tender, 0 wins (the old bug missed bypass paths)
        { id: "c-up", name: "Bypass Corp", tenderCount: 1, winCount: 0, winRate: 0 },
      ],
      tenderLinks: [
        { clientId: "c-up", tender: { tenderScoreCounted: true, wonAt: null, status: "AWARDED" } },
      ],
    });

    const logs = [];
    const result = await run({
      mode: "apply",
      snapshotPath: null,
      snapshotWritten: true,
      prisma: mockPrisma,
      log: (m) => logs.push(m),
    });

    expect(result.wouldChange).toBe(1);
    expect(result.wouldIncrease).toBe(1);
    expect(result.wouldDecrease).toBe(0);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Default and --dry-run perform zero writes
// ---------------------------------------------------------------------------

describe("run() -- dry-run writes nothing", () => {
  it("6a: mode=dry-run -> $transaction never called", async () => {
    const { mockPrisma } = buildMock({
      clients: [
        { id: "c2", name: "Write-Free Corp", tenderCount: 0, winCount: 1, winRate: 50 },
      ],
      tenderLinks: [],
    });

    await run({
      mode: "dry-run",
      snapshotPath: null,
      prisma: mockPrisma,
      log: () => {},
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it("6b: parseArgs with no flags -> mode=dry-run", () => {
    expect(parseArgs(["node", "script.mjs"]).mode).toBe("dry-run");
  });

  it("6c: parseArgs with --dry-run -> mode=dry-run", () => {
    expect(parseArgs(["node", "script.mjs", "--dry-run"]).mode).toBe("dry-run");
  });
});

// ---------------------------------------------------------------------------
// 7. --apply without a snapshot refuses and exits non-zero
// ---------------------------------------------------------------------------

describe("run() -- apply guard", () => {
  it("7: --apply without snapshotPath and snapshotWritten=false -> refuses, refusedNoSnapshot=true", async () => {
    const { mockPrisma } = buildMock({
      clients: [
        { id: "c3", name: "Guard Corp", tenderCount: 1, winCount: 0, winRate: 0 },
      ],
      tenderLinks: [
        { clientId: "c3", tender: { tenderScoreCounted: true, wonAt: null, status: "AWARDED" } },
      ],
    });

    const logs = [];
    const result = await run({
      mode: "apply",
      snapshotPath: null,
      // snapshotWritten defaults to false
      prisma: mockPrisma,
      log: (m) => logs.push(m),
    });

    expect(result.refusedNoSnapshot).toBe(true);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("--apply requires --snapshot"))).toBe(true);
  });

  it("7b: parseArgs --apply without --snapshot -> mode=apply, snapshotPath=null (guard happens in run)", () => {
    const parsed = parseArgs(["node", "script.mjs", "--apply"]);
    expect(parsed.mode).toBe("apply");
    expect(parsed.snapshotPath).toBeNull();
  });

  it("7c: parseArgs --apply with --snapshot path -> mode=apply, snapshotPath set", () => {
    const parsed = parseArgs(["node", "script.mjs", "--apply", "--snapshot", "/tmp/snap.csv"]);
    expect(parsed.mode).toBe("apply");
    expect(parsed.snapshotPath).toBe("/tmp/snap.csv");
  });
});

// ---------------------------------------------------------------------------
// 8. Idempotence: running twice changes nothing the second time
// ---------------------------------------------------------------------------

describe("run() -- idempotence", () => {
  it("8: second run over same data -> wouldChange=0", async () => {
    // First run: client with stale counts
    const staleCounts = { id: "c-idem", name: "Idem Corp", tenderCount: 0, winCount: 0, winRate: 0 };
    const correctCounts = { id: "c-idem", name: "Idem Corp", tenderCount: 1, winCount: 1, winRate: 100 };

    const tenderLinks = [
      { clientId: "c-idem", tender: { tenderScoreCounted: true, wonAt: new Date(), status: "AWARDED" } },
    ];

    // First run
    const mock1 = buildMock({ clients: [staleCounts], tenderLinks });
    const result1 = await run({
      mode: "apply",
      snapshotPath: null,
      snapshotWritten: true,
      prisma: mock1.mockPrisma,
      log: () => {},
    });
    expect(result1.wouldChange).toBe(1);

    // Second run: now the client has the correct cached values
    const mock2 = buildMock({ clients: [correctCounts], tenderLinks });
    const result2 = await run({
      mode: "apply",
      snapshotPath: null,
      snapshotWritten: true,
      prisma: mock2.mockPrisma,
      log: () => {},
    });
    expect(result2.wouldChange).toBe(0);
    expect(mock2.mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// parseArgs edge cases
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("--help -> mode=help", () => {
    expect(parseArgs(["node", "s.mjs", "--help"]).mode).toBe("help");
  });

  it("-h -> mode=help", () => {
    expect(parseArgs(["node", "s.mjs", "-h"]).mode).toBe("help");
  });

  it("--help beats --apply", () => {
    expect(parseArgs(["node", "s.mjs", "--apply", "--help"]).mode).toBe("help");
  });

  it("unknown flag -> mode=error", () => {
    const result = parseArgs(["node", "s.mjs", "--unknown"]);
    expect(result.mode).toBe("error");
  });

  it("--apply and --dry-run together -> mode=error", () => {
    const result = parseArgs(["node", "s.mjs", "--apply", "--dry-run"]);
    expect(result.mode).toBe("error");
  });

  it("--snapshot without value -> mode=error", () => {
    const result = parseArgs(["node", "s.mjs", "--snapshot"]);
    expect(result.mode).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// writeSnapshot
// ---------------------------------------------------------------------------

describe("writeSnapshot", () => {
  it("returns false and logs when path is invalid", () => {
    const logs = [];
    const result = writeSnapshot(
      "Z:\\nonexistent\\path\\snap.csv",
      [{ id: "c1", name: "Corp", tenderCount: 0, winCount: 0, winRate: 0 }],
      (m) => logs.push(m)
    );
    expect(result).toBe(false);
    expect(logs.some((l) => l.includes("could not write snapshot"))).toBe(true);
  });
});
