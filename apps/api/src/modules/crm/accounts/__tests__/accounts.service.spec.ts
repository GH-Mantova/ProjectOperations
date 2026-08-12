import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AccountsService } from "../accounts.service";

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
  tenderClient: { findMany: jest.Mock };
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
    tenderClient: { findMany: jest.fn().mockResolvedValue([]) },
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
});
