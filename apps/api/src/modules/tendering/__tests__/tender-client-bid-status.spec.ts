import { TenderingService } from "../tendering.service";

// tender-lifecycle S2a — TenderClient.bidStatus must reach the database on
// EVERY path that writes a tender_clients row. The column is nullable with no
// default, so a path that forgets to thread it does not fail loudly: it just
// silently writes NULL, and the bid/no-bid record quietly goes missing. These
// tests assert the actual Prisma payload on each write path.

function makeNumberingMock() {
  return {
    generate: jest.fn().mockResolvedValue({
      tenderNumber: "T260906-ACME-Rev1",
      clientSlugSnapshot: "ACME",
      revisionNumber: 1
    }),
    bumpRevision: jest.fn(),
    validate: jest.fn(() => null)
  };
}

function makeService(prisma: unknown) {
  return new TenderingService(
    prisma as never,
    { write: jest.fn().mockResolvedValue({}) } as never,
    { sendNotificationEmail: jest.fn() } as never,
    { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
    makeNumberingMock() as never,
    { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
    { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
    { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
    {
      recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }),
      normalizeOutcome: jest.fn((v) => v ?? {})
    } as never
  );
}

describe("TenderClient.bidStatus — persisted on every write path", () => {
  it("create() writes the supplied bidStatus, and null when omitted", async () => {
    const create = jest.fn().mockResolvedValue({ id: "t-1", tenderNumber: "T260906-ACME-Rev1" });
    const service = makeService({
      tender: { create, findFirst: jest.fn().mockResolvedValue(null) },
      client: { findUnique: jest.fn().mockResolvedValue({ name: "Acme" }) }
    });

    await service.create(
      {
        tenderNumber: "T260906-ACME-Rev1",
        title: "bid status create",
        siteId: "site-1",
        tenderClients: [
          { clientId: "client-priced", bidStatus: "PRICED" as never },
          { clientId: "client-nobid", bidStatus: "NO_BID" as never },
          { clientId: "client-unknown" }
        ]
      },
      "user-1"
    );

    const nested = create.mock.calls[0][0].data.tenderClients.create;
    expect(nested).toHaveLength(3);
    expect(nested[0]).toEqual(expect.objectContaining({ bidStatus: "PRICED" }));
    expect(nested[1]).toEqual(expect.objectContaining({ bidStatus: "NO_BID" }));
    // Omitted must land as an explicit null ("not recorded"), never a member.
    expect(nested[2]).toEqual(expect.objectContaining({ bidStatus: null }));
  });

  it("update() writes bidStatus in the createMany payload", async () => {
    const tx = {
      tender: { update: jest.fn().mockResolvedValue({}) },
      tenderClient: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    const service = makeService({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "t-1",
          tenderNumber: "T260906-ACME-Rev1",
          title: "existing"
        })
      },
      $transaction: jest.fn().mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx))
    });

    await service.update(
      "t-1",
      {
        tenderNumber: "T260906-ACME-Rev1",
        title: "bid status update",
        siteId: "site-1",
        tenderClients: [
          { clientId: "client-watch", bidStatus: "WATCHING" as never },
          { clientId: "client-unknown" }
        ]
      },
      "user-1"
    );

    expect(tx.tenderClient.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ clientId: "client-watch", bidStatus: "WATCHING" }),
        expect.objectContaining({ clientId: "client-unknown", bidStatus: null })
      ]
    });
  });

  it("duplicate() carries bid intent onto the copy while resetting the outcome flags", async () => {
    const create = jest.fn().mockResolvedValue({ id: "t-2", tenderNumber: "T260906-ACME-Rev1" });
    const service = makeService({
      tender: {
        findUnique: jest.fn().mockResolvedValue({
          id: "t-1",
          title: "source",
          description: null,
          siteId: "site-1",
          estimatorUserId: null,
          notes: null,
          tenderClients: [
            {
              clientId: "client-priced",
              contactId: null,
              bidStatus: "PRICED",
              relationshipType: "Primary",
              notes: null
            },
            {
              clientId: "client-legacy",
              contactId: null,
              // A row that predates the column reads NULL and must stay NULL.
              bidStatus: null,
              relationshipType: null,
              notes: null
            }
          ]
        }),
        create
      },
      client: { findUnique: jest.fn().mockResolvedValue({ name: "Acme" }) }
    });

    await service.duplicate("t-1", "user-1");

    const nested = create.mock.calls[0][0].data.tenderClients.create;
    expect(nested[0]).toEqual(
      expect.objectContaining({ bidStatus: "PRICED", isAwarded: false, contractIssued: false })
    );
    expect(nested[1]).toEqual(expect.objectContaining({ bidStatus: null }));
  });
});
