// CRM-S11: archiveEntry, restoreEntry, deleteEntry — unit tests.
//
// Test plan (from spec):
//   1. Archive without a reason is rejected.                (s11-1)
//   2. Archive records archivedAt, archivedById, reason;
//      Restore clears all three.                            (s11-2a, s11-2b)
//   3. Delete refuses entry with a description.             (s11-3a)
//      Delete refuses entry with a contact.                 (s11-3b)
//      Delete refuses entry with a value.                   (s11-3c)
//      Delete refuses entry with a thread.                  (s11-3d)
//   4. Delete succeeds on a genuinely empty entry.          (s11-4)
//   5. Refusal message names the blocking field.            (s11-5)

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CrmService } from "../crm.service";

// ── Minimal mock types ────────────────────────────────────────────────────────

type MockOpportunity = {
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  findMany: jest.Mock;
};

type MockPrisma = {
  opportunity: MockOpportunity;
  dropReason: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  commThread: { count: jest.Mock };
  client: { findUnique: jest.Mock };
  contact: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  site: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    opportunity: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn()
    },
    dropReason: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    commThread: {
      count: jest.fn()
    },
    client: { findUnique: jest.fn() },
    contact: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    site: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (p: MockPrisma) => unknown)(prisma);
      return Promise.all(arg as Promise<unknown>[]);
    })
  };
  return prisma;
}

function makeService(prisma: MockPrisma) {
  const tendering = { create: jest.fn() };
  return new CrmService(prisma as never, tendering as never);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: "opp-1",
    title: "Test opp",
    description: null,
    stage: "open",
    isLead: false,
    probability: 20,
    estimatedValue: null,
    source: "other",
    clientId: null,
    contactId: null,
    ownerId: null,
    accountId: null,
    dropReasonId: null,
    dropReasonDetail: null,
    convertedTenderId: null,
    archiveReasonId: null,
    archiveReasonDetail: null,
    archivedAt: null,
    archivedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// ── archiveEntry ──────────────────────────────────────────────────────────────

describe("CrmService.archiveEntry", () => {
  it("(s11-1) rejects if archiveReasonId refers to a non-existent DropReason", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(makeOpportunity());
    prisma.dropReason.findUnique.mockResolvedValue(null); // reason not found

    const service = makeService(prisma);
    await expect(
      service.archiveEntry("opp-1", { archiveReasonId: "dr-bad" }, "user-1")
    ).rejects.toThrow(BadRequestException);
  });

  it("(s11-2a) archives the entry — sets stage, archiveReason, archivedAt, archivedById", async () => {
    const prisma = makePrisma();
    const now = new Date();
    prisma.opportunity.findUnique.mockResolvedValue(makeOpportunity());
    prisma.dropReason.findUnique.mockResolvedValue({ id: "dr-1" });
    const archived = makeOpportunity({
      stage: "archived",
      archiveReasonId: "dr-1",
      archiveReasonDetail: "context",
      archivedAt: now,
      archivedById: "user-1"
    });
    prisma.opportunity.update.mockResolvedValue(archived);

    const service = makeService(prisma);
    const result = await service.archiveEntry(
      "opp-1",
      { archiveReasonId: "dr-1", detail: "context" },
      "user-1"
    );

    expect(result.stage).toBe("archived");
    expect(result.archivedById).toBe("user-1");
    expect(result.archiveReasonId).toBe("dr-1");
    expect(result.archivedAt).toEqual(now);

    const updateCall = prisma.opportunity.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    // Verify the reason is written as a scalar FK (unchecked update)
    expect(updateCall.data.archiveReasonId).toBe("dr-1");
    expect(updateCall.data.archiveReasonDetail).toBe("context");
    expect(updateCall.data.archivedById).toBe("user-1");
  });

  it("(s11-1 variant) rejects when opportunity does not exist", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(
      service.archiveEntry("bad-id", { archiveReasonId: "dr-1" }, "user-1")
    ).rejects.toThrow(NotFoundException);
  });
});

// ── restoreEntry ──────────────────────────────────────────────────────────────

describe("CrmService.restoreEntry", () => {
  it("(s11-2b) restore clears archivedAt, archivedById, archiveReasonId and sets stage back to open", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(
      makeOpportunity({
        stage: "archived",
        archiveReasonId: "dr-1",
        archivedAt: new Date(),
        archivedById: "user-1"
      })
    );
    const restored = makeOpportunity({ stage: "open" });
    prisma.opportunity.update.mockResolvedValue(restored);

    const service = makeService(prisma);
    const result = await service.restoreEntry("opp-1");

    expect(result.stage).toBe("open");
    const updateCall = prisma.opportunity.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.stage).toBe("open");
    expect(updateCall.data.archiveReasonId).toBeNull();
    expect(updateCall.data.archiveReasonDetail).toBeNull();
    expect(updateCall.data.archivedAt).toBeNull();
    expect(updateCall.data.archivedById).toBeNull();
  });

  it("rejects if the entry is not archived", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(makeOpportunity({ stage: "open" }));

    const service = makeService(prisma);
    await expect(service.restoreEntry("opp-1")).rejects.toThrow(BadRequestException);
  });
});

// ── deleteEntry ───────────────────────────────────────────────────────────────

describe("CrmService.deleteEntry", () => {
  it("(s11-3a) refuses entry with a description — names 'description' in the error", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(
      makeOpportunity({ description: "Some notes" })
    );
    prisma.commThread.count.mockResolvedValue(0);

    const service = makeService(prisma);
    const err = await service.deleteEntry("opp-1").catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toContain("description");
  });

  it("(s11-3b) refuses entry with a contact — names 'contact' in the error", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(
      makeOpportunity({ contactId: "contact-1" })
    );
    prisma.commThread.count.mockResolvedValue(0);

    const service = makeService(prisma);
    const err = await service.deleteEntry("opp-1").catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toContain("contact");
  });

  it("(s11-3c) refuses entry with an estimatedValue — names 'estimatedValue' in the error", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(
      makeOpportunity({ estimatedValue: 15000 })
    );
    prisma.commThread.count.mockResolvedValue(0);

    const service = makeService(prisma);
    const err = await service.deleteEntry("opp-1").catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toContain("estimatedValue");
  });

  it("(s11-3d) refuses entry with an anchored comms thread — names 'commThread' in the error", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(makeOpportunity());
    prisma.commThread.count.mockResolvedValue(1); // one thread exists

    const service = makeService(prisma);
    const err = await service.deleteEntry("opp-1").catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toContain("commThread");
  });

  it("(s11-4) succeeds on a genuinely empty entry — the row is deleted", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(makeOpportunity());
    prisma.commThread.count.mockResolvedValue(0);
    prisma.opportunity.delete.mockResolvedValue(undefined);

    const service = makeService(prisma);
    await expect(service.deleteEntry("opp-1")).resolves.toBeUndefined();

    expect(prisma.opportunity.delete).toHaveBeenCalledWith({ where: { id: "opp-1" } });
  });

  it("(s11-5) refusal message names ALL blocking fields when multiple are non-empty", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(
      makeOpportunity({
        description: "notes",
        contactId: "c-1",
        estimatedValue: 5000
      })
    );
    prisma.commThread.count.mockResolvedValue(1);

    const service = makeService(prisma);
    const err = await service.deleteEntry("opp-1").catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    const msg = (err as BadRequestException).message;
    expect(msg).toContain("description");
    expect(msg).toContain("contact");
    expect(msg).toContain("estimatedValue");
    expect(msg).toContain("commThread");
  });

  it("returns NotFoundException when the entry does not exist", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.deleteEntry("bad-id")).rejects.toThrow(NotFoundException);
  });
});
