import { TenderingService } from "../tendering.service";

// P0 — regression tests for the silent-data-loss bug in TenderingService.update().
//
// Before the fix, update() unconditionally deleted tenderNotes, clarifications,
// pricingSnapshots, followUps and outcomes on every call — so a PATCH that sent
// only { tenderClients: [...] } silently destroyed every note, clarification,
// snapshot, follow-up and outcome on that tender.
//
// The fix: each child collection is only touched when the caller explicitly sent
// that key. Absent (undefined) → leave rows alone. Explicit [] → clear. Items → replace.
// Guard is `!== undefined` — `?.length` cannot distinguish absent from empty.

type ChildMock = {
  deleteMany: jest.Mock;
  createMany: jest.Mock;
  create: jest.Mock;
};

function makeChildMock(): ChildMock {
  return {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({})
  };
}

function makeTx() {
  return {
    tender: { update: jest.fn().mockResolvedValue({}) },
    tenderClient: makeChildMock(),
    tenderNote: makeChildMock(),
    tenderClarification: makeChildMock(),
    tenderPricingSnapshot: makeChildMock(),
    tenderFollowUp: makeChildMock(),
    tenderOutcome: makeChildMock()
  };
}

function makePrisma(tx: ReturnType<typeof makeTx>) {
  return {
    tender: {
      findUnique: jest.fn().mockResolvedValue({
        id: "t-1",
        tenderNumber: "T260612-ACME-Rev1",
        title: "existing"
      })
    },
    $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx))
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
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
    { createFromTender: jest.fn().mockResolvedValue(undefined) } as never
  );
}

describe("TenderingService.update — partial semantics", () => {
  it("does NOT touch collections that are absent from the payload (headline data-loss case)", async () => {
    // A partial PATCH that sends only tenderClients must leave notes, clarifications,
    // pricing snapshots, follow-ups and outcomes ALONE. Before the fix all five were
    // wiped — that is the data-loss bug this test proves is closed.
    const tx = makeTx();
    const prisma = makePrisma(tx);
    const service = makeService(prisma);

    await service.update(
      "t-1",
      {
        tenderNumber: "T260612-ACME-Rev1",
        title: "still here",
        siteId: "site-1",
        tenderClients: [{ clientId: "client-1" }]
      },
      "user-1"
    );

    // The clients collection WAS sent, so it is deleted and recreated.
    expect(tx.tenderClient.deleteMany).toHaveBeenCalledWith({ where: { tenderId: "t-1" } });
    expect(tx.tenderClient.createMany).toHaveBeenCalledTimes(1);

    // The other five were NOT sent — nothing must be deleted or created.
    expect(tx.tenderNote.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenderNote.create).not.toHaveBeenCalled();
    expect(tx.tenderClarification.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenderClarification.createMany).not.toHaveBeenCalled();
    expect(tx.tenderPricingSnapshot.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenderPricingSnapshot.createMany).not.toHaveBeenCalled();
    expect(tx.tenderFollowUp.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenderFollowUp.createMany).not.toHaveBeenCalled();
    expect(tx.tenderOutcome.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenderOutcome.createMany).not.toHaveBeenCalled();
  });

  it("treats an explicit empty array as a clear (delete, no recreate)", async () => {
    // `absent` must not be conflated with `explicitly emptied`. Sending
    // { tenderNotes: [] } means "clear the notes" — the delete must run,
    // but no create should follow.
    const tx = makeTx();
    const prisma = makePrisma(tx);
    const service = makeService(prisma);

    await service.update(
      "t-1",
      {
        tenderNumber: "T260612-ACME-Rev1",
        title: "clear notes",
        siteId: "site-1",
        tenderNotes: []
      },
      "user-1"
    );

    expect(tx.tenderNote.deleteMany).toHaveBeenCalledWith({ where: { tenderId: "t-1" } });
    expect(tx.tenderNote.create).not.toHaveBeenCalled();
    expect(tx.tenderNote.createMany).not.toHaveBeenCalled();

    // Untouched collections stay untouched.
    expect(tx.tenderClient.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenderClarification.deleteMany).not.toHaveBeenCalled();
  });

  it("replaces the collection when items are provided", async () => {
    const tx = makeTx();
    const prisma = makePrisma(tx);
    const service = makeService(prisma);

    await service.update(
      "t-1",
      {
        tenderNumber: "T260612-ACME-Rev1",
        title: "one note",
        siteId: "site-1",
        tenderNotes: [{ body: "hello" }]
      },
      "user-1"
    );

    expect(tx.tenderNote.deleteMany).toHaveBeenCalledWith({ where: { tenderId: "t-1" } });
    expect(tx.tenderNote.create).toHaveBeenCalledTimes(1);
    expect(tx.tenderNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenderId: "t-1", body: "hello", authorUserId: "user-1" })
    });
  });

  it("full-shape update touches every collection exactly once (no regression)", async () => {
    const tx = makeTx();
    const prisma = makePrisma(tx);
    const service = makeService(prisma);

    await service.update(
      "t-1",
      {
        tenderNumber: "T260612-ACME-Rev1",
        title: "full replace",
        siteId: "site-1",
        tenderClients: [{ clientId: "client-1" }],
        tenderNotes: [{ body: "note" }],
        clarifications: [{ subject: "subj" }],
        pricingSnapshots: [{ versionLabel: "v1" }],
        followUps: [{ dueAt: new Date().toISOString(), details: "chase estimator" }],
        outcomes: [{ outcomeType: "WON" }]
      },
      "user-1"
    );

    expect(tx.tenderClient.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.tenderClient.createMany).toHaveBeenCalledTimes(1);

    expect(tx.tenderNote.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.tenderNote.create).toHaveBeenCalledTimes(1);

    expect(tx.tenderClarification.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.tenderClarification.createMany).toHaveBeenCalledTimes(1);

    expect(tx.tenderPricingSnapshot.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.tenderPricingSnapshot.createMany).toHaveBeenCalledTimes(1);

    expect(tx.tenderFollowUp.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.tenderFollowUp.createMany).toHaveBeenCalledTimes(1);

    expect(tx.tenderOutcome.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.tenderOutcome.createMany).toHaveBeenCalledTimes(1);
  });
});
