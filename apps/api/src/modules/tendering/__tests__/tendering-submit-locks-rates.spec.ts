// tendering-submit-locks-rates.spec.ts
//
// Rates-gate (draftpanel S1): proves that the first SUBMITTED transition
// calls TenderRateSetService.lock() when the tender has no existing rate set,
// does NOT call it when a set already exists, and does NOT re-lock on a second
// SUBMITTED. All Prisma and service calls are mocked — no DB required.

import { TenderingService } from "../tendering.service";

// ── Shared helpers ──────────────────────────────────────────────────────────

function makeMinimalTender(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    tenderNumber: "T260913-INIT-Rev1",
    status: "DRAFT",
    submittedAt: null,
    ratesSnapshotAt: null,
    wonAt: null,
    lostAt: null,
    tenderScoreCounted: false,
    tenderWinCounted: false,
    ...overrides
  };
}

/**
 * Build a minimal Prisma stub for updateStatus calls. The test controls
 * what the tender looks like via `tenderRow`.
 *
 * The update mock must return a shape that satisfies the email send code
 * (`tender.tenderClients[0]?.client?.name`), so we add an empty array.
 */
function makePrisma(tenderRow: ReturnType<typeof makeMinimalTender>) {
  const updatedTender = {
    ...tenderRow,
    status: "SUBMITTED",
    tenderClients: [],
    estimatedValue: null
  };
  return {
    tender: {
      findUnique: jest.fn().mockResolvedValue(tenderRow),
      update: jest.fn().mockResolvedValue(updatedTender)
    }
  };
}

function makeLockSvc() {
  return { lock: jest.fn().mockResolvedValue({}) };
}

/**
 * Build TenderingService with every dependency stubbed. The two parameters
 * that matter here are `prisma` (controls what findUnique returns) and
 * `lockSvc` (the mock TenderRateSetService).
 */
function makeService(
  prisma: ReturnType<typeof makePrisma>,
  lockSvc: ReturnType<typeof makeLockSvc>
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
    { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
    { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
    { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
    {
      recordOutcome: jest.fn().mockResolvedValue(null),
      normalizeOutcome: jest.fn((x) => x)
    } as never,
    lockSvc as never
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("TenderingService.updateStatus — rates-gate (draftpanel S1)", () => {
  it("calls lock() once when SUBMITTED with no existing rate set", async () => {
    // Tender has never been submitted and has no rate set.
    const tender = makeMinimalTender({ ratesSnapshotAt: null, submittedAt: null });
    const prisma = makePrisma(tender);
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "SUBMITTED", "actor-1");

    expect(lockSvc.lock).toHaveBeenCalledTimes(1);
    expect(lockSvc.lock).toHaveBeenCalledWith("t-1", "actor-1");
  });

  it("does NOT call lock() when SUBMITTED and a rate set already exists (ratesSnapshotAt set)", async () => {
    // Tender was already submitted once and has a snapshot.
    const tender = makeMinimalTender({
      ratesSnapshotAt: new Date("2026-09-10T00:00:00Z"),
      submittedAt: new Date("2026-09-10T00:00:00Z")
    });
    const prisma = makePrisma(tender);
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "SUBMITTED", "actor-1");

    expect(lockSvc.lock).not.toHaveBeenCalled();
  });

  it("does NOT re-lock on a second SUBMITTED (submittedAt already set)", async () => {
    // Already submitted once (submittedAt set) — second SUBMITTED must not re-lock.
    const tender = makeMinimalTender({
      status: "SUBMITTED",
      submittedAt: new Date("2026-09-11T00:00:00Z"),
      ratesSnapshotAt: new Date("2026-09-11T00:00:00Z")
    });
    const prisma = makePrisma(tender);
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "SUBMITTED", "actor-2");

    expect(lockSvc.lock).not.toHaveBeenCalled();
  });

  it("calls lock() when first won (AWARDED) with no prior submission and no rate set", async () => {
    const tender = makeMinimalTender({ status: "DRAFT", ratesSnapshotAt: null, submittedAt: null });
    const prisma = makePrisma(tender);
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "AWARDED", "actor-1");

    expect(lockSvc.lock).toHaveBeenCalledTimes(1);
    expect(lockSvc.lock).toHaveBeenCalledWith("t-1", "actor-1");
  });

  it("does NOT call lock() on AWARDED when ratesSnapshotAt is already set", async () => {
    const tender = makeMinimalTender({
      ratesSnapshotAt: new Date("2026-09-10T00:00:00Z"),
      submittedAt: new Date("2026-09-10T00:00:00Z")
    });
    const prisma = makePrisma(tender);
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "AWARDED", "actor-1");

    expect(lockSvc.lock).not.toHaveBeenCalled();
  });
});
