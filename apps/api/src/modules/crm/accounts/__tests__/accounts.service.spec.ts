import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AccountsService, deriveGoingCold } from "../accounts.service";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

type MockPrisma = {
  account: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  client: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  contact: { findMany: jest.Mock };
  tenderClient: { findMany: jest.Mock; count: jest.Mock };
  job: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    account: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0)
    },
    client: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    contact: { findMany: jest.fn().mockResolvedValue([]) },
    tenderClient: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    job: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    })
  };
  return prisma;
}

function makeService(prisma: MockPrisma) {
  return new AccountsService(prisma as never);
}

const ACCOUNT_STUB = {
  id: "acct-1",
  clientId: "client-1",
  lifecycleStatus: "ACTIVE" as const,
  accountType: "CLIENT" as const,
  source: "DIRECT" as const,
  ownerId: null,
  notes: null,
  archivedAt: null,
  archivedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: { id: "client-1", name: "Acme Pty Ltd", code: null, isActive: true },
  owner: null,
  archivedBy: null
};

// ── createAccount ─────────────────────────────────────────────────────────────

describe("AccountsService.createAccount", () => {
  it("creates an account with a valid clientId", async () => {
    const prisma = makePrisma();
    prisma.client.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.account.create.mockResolvedValue(ACCOUNT_STUB);

    const service = makeService(prisma);
    const result = await service.createAccount({
      clientId: "client-1",
      lifecycleStatus: "ACTIVE",
      accountType: "CLIENT",
      source: "DIRECT"
    });

    expect(result).toEqual(ACCOUNT_STUB);
    expect(prisma.account.create).toHaveBeenCalledTimes(1);
  });

  it("throws NotFoundException when clientId refers to unknown client", async () => {
    const prisma = makePrisma();
    prisma.client.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.createAccount({ clientId: "bad-client" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("creates a prospect account without a clientId", async () => {
    const prisma = makePrisma();
    prisma.account.create.mockResolvedValue({ ...ACCOUNT_STUB, clientId: null, client: null });

    const service = makeService(prisma);
    const result = await service.createAccount({ lifecycleStatus: "PROSPECT" });
    expect(result.clientId).toBeNull();
  });
});

// ── getAccount ────────────────────────────────────────────────────────────────

describe("AccountsService.getAccount", () => {
  it("returns account when found", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue(ACCOUNT_STUB);

    const service = makeService(prisma);
    const result = await service.getAccount("acct-1");
    expect(result).toEqual(ACCOUNT_STUB);
  });

  it("throws NotFoundException when account does not exist", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.getAccount("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── archiveAccount ────────────────────────────────────────────────────────────

describe("AccountsService.archiveAccount", () => {
  it("archives a non-archived account", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue(ACCOUNT_STUB);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    const archived = { ...ACCOUNT_STUB, archivedAt: new Date() };
    prisma.account.update.mockResolvedValue(archived);

    const service = makeService(prisma);
    const result = await service.archiveAccount("acct-1", { actorId: "user-1" });
    expect(result.archivedAt).toBeDefined();
  });

  it("throws BadRequestException when account is already archived", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue({
      ...ACCOUNT_STUB,
      archivedAt: new Date()
    });

    const service = makeService(prisma);
    await expect(
      service.archiveAccount("acct-1", { actorId: "user-1" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when account does not exist", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(
      service.archiveAccount("missing", { actorId: "user-1" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── unarchiveAccount ──────────────────────────────────────────────────────────

describe("AccountsService.unarchiveAccount", () => {
  it("restores an archived account", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue({
      ...ACCOUNT_STUB,
      archivedAt: new Date(),
      archivedById: "user-1"
    });
    prisma.account.update.mockResolvedValue(ACCOUNT_STUB);

    const service = makeService(prisma);
    const result = await service.unarchiveAccount("acct-1");
    expect(result.archivedAt).toBeNull();
  });

  it("throws BadRequestException when account is not archived", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue(ACCOUNT_STUB); // archivedAt: null

    const service = makeService(prisma);
    await expect(service.unarchiveAccount("acct-1")).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── getAccount360 ─────────────────────────────────────────────────────────────

describe("AccountsService.getAccount360", () => {
  it("returns 360 view with rollUps for a client-linked account", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue({
      ...ACCOUNT_STUB,
      client: {
        id: "client-1",
        name: "Acme Pty Ltd",
        code: null,
        tradingName: null,
        abn: null,
        acn: null,
        email: null,
        phone: null,
        website: null,
        physicalAddress: null,
        physicalSuburb: null,
        physicalState: null,
        physicalPostcode: null,
        industry: null,
        winCount: 2,
        tenderCount: 5,
        winRate: "0.40",
        lastTenderAt: null,
        lastWonAt: null,
        isActive: true,
        onHold: false,
        onHoldReason: null
      }
    });
    prisma.contact.findMany.mockResolvedValue([
      {
        id: "contact-1",
        firstName: "Jane",
        lastName: "Smith",
        role: "Director",
        email: "jane@acme.com",
        phone: null,
        mobile: null,
        isPrimary: true,
        isAccountsContact: false,
        isActive: true
      }
    ]);
    prisma.tenderClient.findMany.mockResolvedValue([
      { tender: { id: "tender-1", tenderNumber: "T-001", title: "Roof Fix", status: "AWARDED", dueDate: null, createdAt: new Date() } }
    ]);
    prisma.job.findMany.mockResolvedValue([
      { id: "job-1", jobNumber: "J-001", name: "Build", status: "ACTIVE", createdAt: new Date() }
    ]);

    const service = makeService(prisma);
    const result = await service.getAccount360("acct-1");

    expect(result.rollUps.contacts).toHaveLength(1);
    expect(result.rollUps.tenders).toHaveLength(1);
    expect(result.rollUps.jobs).toHaveLength(1);
    expect(result.rollUps.contacts[0].firstName).toBe("Jane");
  });

  it("throws NotFoundException when account does not exist", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.getAccount360("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns tenderTotal from count, not capped by findMany (e.g. 42 total, 20 shown)", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue({ ...ACCOUNT_STUB });
    // Simulate 42 linked tenders in the DB but findMany only returns 20 (capped)
    const twentyRows = Array.from({ length: 20 }, (_, i) => ({
      tender: {
        id: `tender-${i + 1}`,
        tenderNumber: `T-${String(i + 1).padStart(3, "0")}`,
        title: `Tender ${i + 1}`,
        status: "OPEN",
        dueDate: null,
        createdAt: new Date()
      }
    }));
    prisma.tenderClient.findMany.mockResolvedValue(twentyRows);
    prisma.tenderClient.count.mockResolvedValue(42);

    const service = makeService(prisma);
    const result = await service.getAccount360("acct-1");

    expect(result.rollUps.tenders).toHaveLength(20);
    expect(result.rollUps.tenderTotal).toBe(42);
  });

  it("returns tenderTotal of 0 and does not call count when clientId is null", async () => {
    const prisma = makePrisma();
    prisma.account.findUnique.mockResolvedValue({
      ...ACCOUNT_STUB,
      clientId: null,
      client: null
    });

    const service = makeService(prisma);
    const result = await service.getAccount360("acct-1");

    expect(result.rollUps.tenderTotal).toBe(0);
    expect(prisma.tenderClient.count).not.toHaveBeenCalled();
  });
});

// ── deriveGoingCold (NAV-2) ───────────────────────────────────────────────────

describe("deriveGoingCold (NAV-2 accounts summary)", () => {
  // NOW is a FIXED instant and is injected into the function under test.
  // It must never be compared against the real wall clock: `daysAgo(1)` is a
  // literal date, so a spec that let deriveGoingCold read Date.now() passed in
  // CI until exactly 2026-08-27T12:00:00Z and failed permanently from then on
  // (14 days + 1 after NOW). The clock is now pinned on BOTH sides.
  const NOW = new Date("2026-08-14T12:00:00Z");
  const NOW_MS = NOW.getTime();
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

  // Case 1: >14 days + non-PAST → cold. Now assertable, because the clock is injected.
  it("returns true when lastContactedAt is >14 days ago and lifecycle is ACTIVE", () => {
    expect(deriveGoingCold("ACTIVE", daysAgo(15), NOW_MS)).toBe(true);
    expect(deriveGoingCold("PROSPECT", daysAgo(15), NOW_MS)).toBe(true);
    expect(deriveGoingCold("PAST", daysAgo(15), NOW_MS)).toBe(false);   // PAST → never cold
    expect(deriveGoingCold("ACTIVE", null, NOW_MS)).toBe(false);        // null → not cold
    expect(deriveGoingCold("PROSPECT", null, NOW_MS)).toBe(false);      // null → not cold
  });

  // Case 1b: the boundary itself — exactly 14 days is NOT cold, 14 days + 1ms is.
  it("treats exactly 14 days as not cold, and one millisecond past it as cold", () => {
    expect(deriveGoingCold("ACTIVE", daysAgo(14), NOW_MS)).toBe(false);
    const justOver = new Date(daysAgo(14).getTime() - 1);
    expect(deriveGoingCold("ACTIVE", justOver, NOW_MS)).toBe(true);
  });

  // Case 2: PAST lifecycle → never cold regardless of date
  it("returns false for PAST lifecycle even with a very old lastContactedAt", () => {
    expect(deriveGoingCold("PAST", daysAgo(365), NOW_MS)).toBe(false);
    expect(deriveGoingCold("PAST", daysAgo(1), NOW_MS)).toBe(false);
  });

  // Case 3: null lastContactedAt → not cold
  it("returns false when lastContactedAt is null", () => {
    expect(deriveGoingCold("ACTIVE", null, NOW_MS)).toBe(false);
    expect(deriveGoingCold("PROSPECT", null, NOW_MS)).toBe(false);
  });

  // Case 4: very fresh contact → not cold
  it("returns false when lastContactedAt is very recent (1 day ago)", () => {
    // A date 1 day ago is well within the 14-day window.
    expect(deriveGoingCold("ACTIVE", daysAgo(1), NOW_MS)).toBe(false);
  });

  // Case 5: the DEFAULT clock still works — no caller has to pass nowMs.
  it("defaults to the real wall clock when nowMs is omitted", () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    expect(deriveGoingCold("ACTIVE", oneDayAgo)).toBe(false);
    expect(deriveGoingCold("ACTIVE", twentyDaysAgo)).toBe(true);
  });
});

// ── listAccountSummaries (NAV-2) ──────────────────────────────────────────────

describe("AccountsService.listAccountSummaries", () => {
  function makeAccountRow(overrides: {
    lifecycleStatus?: string;
    lastContactedAt?: Date | null;
    winRate?: string | null;
    oppCount?: number;
    noteCreatedAt?: Date | null;
  } = {}) {
    return {
      id: "acct-1",
      lifecycleStatus: overrides.lifecycleStatus ?? "ACTIVE",
      accountType: "CLIENT",
      client: {
        name: "Acme Pty Ltd",
        winRate: overrides.winRate !== undefined ? overrides.winRate : "0.40"
      },
      _count: { opportunities: overrides.oppCount ?? 3 },
      contacts: overrides.lastContactedAt != null
        ? [{ lastContactedAt: overrides.lastContactedAt }]
        : [],
      relationshipNotes: overrides.noteCreatedAt != null
        ? [{ createdAt: overrides.noteCreatedAt }]
        : []
    };
  }

  it("returns summary DTO shape with winRate, openOpportunitiesCount, lastContactedAt, goingCold", async () => {
    const prisma = makePrisma();
    const pastContact = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    prisma.account.findMany.mockResolvedValue([
      makeAccountRow({ lastContactedAt: pastContact })
    ]);

    const service = makeService(prisma);
    const summaries = await service.listAccountSummaries();

    expect(summaries).toHaveLength(1);
    const row = summaries[0];
    expect(row).toHaveProperty("id", "acct-1");
    expect(row).toHaveProperty("name", "Acme Pty Ltd");
    expect(row).toHaveProperty("type", "CLIENT");
    expect(row).toHaveProperty("lifecycle", "ACTIVE");
    expect(row).toHaveProperty("winRate");
    expect(typeof row.winRate).toBe("number");
    expect(row).toHaveProperty("openOpportunitiesCount", 3);
    expect(row).toHaveProperty("lastContactedAt");
    // 30 days ago → goingCold should be true (>14 days, ACTIVE)
    expect(row).toHaveProperty("goingCold", true);
  });

  it("goingCold is false when lastContactedAt is null", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([
      makeAccountRow({ lastContactedAt: null, noteCreatedAt: null })
    ]);

    const service = makeService(prisma);
    const summaries = await service.listAccountSummaries();

    expect(summaries[0].goingCold).toBe(false);
    expect(summaries[0].lastContactedAt).toBeNull();
  });

  it("goingCold is false for PAST lifecycle even with old lastContactedAt", async () => {
    const prisma = makePrisma();
    const veryOld = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    prisma.account.findMany.mockResolvedValue([
      makeAccountRow({ lifecycleStatus: "PAST", lastContactedAt: veryOld })
    ]);

    const service = makeService(prisma);
    const summaries = await service.listAccountSummaries();

    expect(summaries[0].lifecycle).toBe("PAST");
    expect(summaries[0].goingCold).toBe(false);
  });

  it("uses the max of contact.lastContactedAt and note.createdAt for lastContactedAt", async () => {
    const prisma = makePrisma();
    const olderDate = new Date("2026-07-01T00:00:00Z");
    const newerDate = new Date("2026-07-20T00:00:00Z");
    prisma.account.findMany.mockResolvedValue([
      makeAccountRow({ lastContactedAt: olderDate, noteCreatedAt: newerDate })
    ]);

    const service = makeService(prisma);
    const summaries = await service.listAccountSummaries();

    // lastContactedAt should be the newer of the two
    expect(summaries[0].lastContactedAt).toEqual(newerDate);
  });

  it("winRate is null when client has no winRate", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([
      makeAccountRow({ winRate: null })
    ]);

    const service = makeService(prisma);
    const summaries = await service.listAccountSummaries();

    expect(summaries[0].winRate).toBeNull();
  });

  it("returns empty array when there are no accounts", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([]);

    const service = makeService(prisma);
    const summaries = await service.listAccountSummaries();
    expect(summaries).toEqual([]);
  });
});
