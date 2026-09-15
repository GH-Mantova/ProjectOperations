// draft-carry-over.spec.ts
//
// DraftPanel S3 -- proves the carry-over snapshot and dismiss logic in
// TenderingService.updateStatus and dismissDraftCarryOver.
// All Prisma and service calls are mocked -- no DB required.

import { TenderingService } from "../tendering.service";

// ── Shared helpers ──────────────────────────────────────────────────────────

function makeMinimalTender(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    tenderNumber: "T260915-INIT-Rev1",
    status: "DRAFT",
    submittedAt: null,
    ratesSnapshotAt: null,
    wonAt: null,
    lostAt: null,
    tenderScoreCounted: false,
    tenderWinCounted: false,
    draftCarryOver: null,
    ...overrides
  };
}

function makePrisma(tenderRow: ReturnType<typeof makeMinimalTender>) {
  const updatedTender = {
    ...tenderRow,
    status: "IN_PROGRESS",
    tenderClients: [],
    estimatedValue: null
  };
  return {
    tender: {
      findUnique: jest.fn().mockResolvedValue(tenderRow),
      update: jest.fn().mockImplementation(({ data }) => {
        return Promise.resolve({ ...updatedTender, ...data });
      })
    }
  };
}

function makeLockSvc() {
  return { lock: jest.fn().mockResolvedValue({}) };
}

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

describe("TenderingService.updateStatus -- draftCarryOver snapshot (DraftPanel S3)", () => {
  const ROWS = [
    { step: "builders", text: "Acme: no contact selected, no submission date set." },
    { step: "documents", text: "No files uploaded yet." }
  ];

  it("writes the snapshot with capturedAt when DRAFT -> IN_PROGRESS with rows", async () => {
    const tender = makeMinimalTender({ status: "DRAFT" });
    const prisma = makePrisma(tender);
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "IN_PROGRESS", "actor-1", undefined, { rows: ROWS });

    expect(prisma.tender.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftCarryOver: expect.objectContaining({
            capturedAt: expect.any(String),
            rows: ROWS
          })
        })
      })
    );
  });

  it("does NOT write the snapshot when source status is IN_PROGRESS (not DRAFT)", async () => {
    const tender = makeMinimalTender({ status: "IN_PROGRESS", submittedAt: null });
    const prisma = makePrisma(tender);
    // Update mock to return submitted tender
    prisma.tender.update.mockImplementation(({ data }) => {
      return Promise.resolve({ ...tender, status: "SUBMITTED", tenderClients: [], estimatedValue: null, ...data });
    });
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "SUBMITTED", "actor-1", undefined, { rows: ROWS });

    const updateCall = prisma.tender.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("draftCarryOver");
  });

  it("does NOT write the snapshot when no draftCarryOver payload is provided", async () => {
    const tender = makeMinimalTender({ status: "DRAFT" });
    const prisma = makePrisma(tender);
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.updateStatus("t-1", "IN_PROGRESS", "actor-1");

    const updateCall = prisma.tender.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("draftCarryOver");
  });
});

describe("TenderingService.dismissDraftCarryOver (DraftPanel S3)", () => {
  it("merges dismissedAt into existing snapshot, keeping rows", async () => {
    const existingCarryOver = {
      capturedAt: "2026-09-15T10:00:00.000Z",
      rows: [{ step: "builders", text: "Acme: no contact selected." }]
    };
    const tender = makeMinimalTender({
      status: "IN_PROGRESS",
      draftCarryOver: existingCarryOver
    });
    const prisma = makePrisma(tender);
    prisma.tender.update.mockImplementation(({ data }) => {
      return Promise.resolve({ ...tender, tenderClients: [], estimatedValue: null, ...data });
    });
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.dismissDraftCarryOver("t-1", "actor-1");

    expect(prisma.tender.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftCarryOver: expect.objectContaining({
            capturedAt: "2026-09-15T10:00:00.000Z",
            rows: existingCarryOver.rows,
            dismissedAt: expect.any(String)
          })
        })
      })
    );
  });

  it("writes { dismissedAt } when there is no snapshot (legacy tender)", async () => {
    const tender = makeMinimalTender({ status: "IN_PROGRESS", draftCarryOver: null });
    const prisma = makePrisma(tender);
    prisma.tender.update.mockImplementation(({ data }) => {
      return Promise.resolve({ ...tender, tenderClients: [], estimatedValue: null, ...data });
    });
    const lockSvc = makeLockSvc();
    const svc = makeService(prisma, lockSvc);

    await svc.dismissDraftCarryOver("t-1", "actor-1");

    expect(prisma.tender.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftCarryOver: expect.objectContaining({
            dismissedAt: expect.any(String)
          })
        })
      })
    );
    // Must not have rows or capturedAt for a null snapshot
    const updateCall = prisma.tender.update.mock.calls[0][0];
    const co = updateCall.data.draftCarryOver as Record<string, unknown>;
    expect(co).not.toHaveProperty("capturedAt");
    expect(co).not.toHaveProperty("rows");
  });
});
