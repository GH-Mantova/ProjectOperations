import { TenderingService } from "../tendering.service";

// crm-wincount slice 1 — tenderWinCounted guard.
//
// A tender that starts SUBMITTED and then advances through
//   AWARDED → CONTRACT_ISSUED → CONVERTED
// passes through three isWon-true statuses. Without the guard, each transition
// would call recordTenderOutcome with mode:"win-flip", inflating winCount by
// three for a single win. With the guard (tenderWinCounted flag), only the
// FIRST transition to an isWon status fires a win-flip; subsequent transitions
// are silent.
//
// This is a pure unit test: PrismaService and ClientStatsService are mocked.
// No live DB required.

// Minimal Prisma mock that tracks update calls and simulates the flag write-back.
function makePrismaMock(initialTender: Record<string, unknown>) {
  // Mutable state so write-backs to tenderWinCounted/tenderScoreCounted
  // are visible to subsequent findUnique calls.
  const state = { ...initialTender };

  const mock = {
    tender: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state, data);
        return Promise.resolve({ ...state });
      })
    },
    $transaction: jest.fn()
  };
  return mock;
}

function makeClientStatsMock() {
  return {
    recordTenderOutcome: jest.fn().mockResolvedValue(undefined)
  };
}

function makeService(
  prisma: ReturnType<typeof makePrismaMock>,
  clientStats: ReturnType<typeof makeClientStatsMock>
) {
  return new TenderingService(
    prisma as never,
    { write: jest.fn().mockResolvedValue({}) } as never,
    { sendNotificationEmail: jest.fn() } as never,
    { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
    {
      generate: jest.fn(),
      bumpRevision: jest.fn(),
      validate: jest.fn(() => null)
    } as never,
    clientStats as never,
    { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
    { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
    {
      recordOutcome: jest.fn().mockResolvedValue(null),
      normalizeOutcome: jest.fn((input) => input ?? {})
    } as never
  );
}

describe("tenderWinCounted guard — updateStatus", () => {
  it("fires win-flip exactly once across SUBMITTED → AWARDED → CONTRACT_ISSUED → CONVERTED", async () => {
    // Start with a tender that has tenderScoreCounted=true (already counted
    // for SUBMITTED) and tenderWinCounted=false (not yet won).
    const prisma = makePrismaMock({
      id: "t-win-guard",
      tenderNumber: "T-WG-001",
      status: "SUBMITTED",
      submittedAt: new Date(),
      ratesSnapshotAt: new Date(),
      wonAt: null,
      lostAt: null,
      tenderScoreCounted: true,
      tenderWinCounted: false,
      withdrawalState: null,
      allocationState: "UNALLOCATED",
      folderProvisioningStatus: null
    });

    const clientStats = makeClientStatsMock();
    const service = makeService(prisma, clientStats);

    // Transition 1: SUBMITTED → AWARDED (first isWon; win-flip should fire)
    await service.updateStatus("t-win-guard", "AWARDED");

    // Transition 2: AWARDED → CONTRACT_ISSUED (isWon again; guard blocks)
    await service.updateStatus("t-win-guard", "CONTRACT_ISSUED");

    // Transition 3: CONTRACT_ISSUED → CONVERTED (isWon again; guard blocks)
    await service.updateStatus("t-win-guard", "CONVERTED");

    const winFlipCalls = clientStats.recordTenderOutcome.mock.calls.filter(
      (call: unknown[]) => (call[1] as { mode: string }).mode === "win-flip"
    );

    expect(winFlipCalls).toHaveLength(1);
    expect(winFlipCalls[0][1]).toEqual({ isWin: true, mode: "win-flip" });
  });

  it("fires first-count (with win) and no win-flip when first status is AWARDED", async () => {
    // Tender has never been counted at all — tenderScoreCounted=false.
    const prisma = makePrismaMock({
      id: "t-win-first",
      tenderNumber: "T-WF-001",
      status: "DRAFT",
      submittedAt: null,
      ratesSnapshotAt: null,
      wonAt: null,
      lostAt: null,
      tenderScoreCounted: false,
      tenderWinCounted: false,
      withdrawalState: null,
      allocationState: "UNALLOCATED",
      folderProvisioningStatus: null
    });

    const clientStats = makeClientStatsMock();
    const service = makeService(prisma, clientStats);

    // Transition: DRAFT → AWARDED (first-count fires, sets both flags)
    await service.updateStatus("t-win-first", "AWARDED");

    // Transition: AWARDED → CONTRACT_ISSUED (both flags now true; guard blocks)
    await service.updateStatus("t-win-first", "CONTRACT_ISSUED");

    // Transition: CONTRACT_ISSUED → CONVERTED (still guarded)
    await service.updateStatus("t-win-first", "CONVERTED");

    const firstCountCalls = clientStats.recordTenderOutcome.mock.calls.filter(
      (call: unknown[]) => (call[1] as { mode: string }).mode === "first-count"
    );
    const winFlipCalls = clientStats.recordTenderOutcome.mock.calls.filter(
      (call: unknown[]) => (call[1] as { mode: string }).mode === "win-flip"
    );

    // Exactly one first-count (the AWARDED transition), zero win-flips.
    expect(firstCountCalls).toHaveLength(1);
    expect(firstCountCalls[0][1]).toEqual({ isWin: true, mode: "first-count" });
    expect(winFlipCalls).toHaveLength(0);
  });
});
