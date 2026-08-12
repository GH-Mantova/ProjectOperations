import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EmailLogService } from "../email-log.service";

// ── Mock Prisma + EmailService ────────────────────────────────────────────────

type MockPrisma = {
  emailLog: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

type MockEmail = {
  verifyConnection: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    emailLog: {
      create: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: "user-1" }) },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    })
  };
  return prisma;
}

function makeEmail(): MockEmail {
  return {
    verifyConnection: jest.fn().mockResolvedValue({
      success: true,
      message: "ok",
      diagnosis: {
        provider: "outlook",
        authMode: "graph-app",
        senderAddress: "marco@initialservices.net",
        credentialResolved: true,
        detail: "Verified."
      }
    })
  };
}

function makeService(prisma: MockPrisma, email: MockEmail) {
  return new EmailLogService(prisma as never, email as never);
}

const LOG_STUB = {
  id: "log-1",
  entityType: "ACCOUNT",
  entityId: "acct-1",
  direction: "INBOUND",
  graphMessageId: "AAMkAGRAND0M-1",
  subject: "Site walk-through",
  fromAddress: "pm@client.example",
  toAddresses: ["marco@initialservices.net"],
  ccAddresses: null,
  snippet: "Confirming Thursday at 10am on-site.",
  sentAt: new Date("2026-08-11T09:00:00Z"),
  loggedById: "user-1",
  loggedAt: new Date(),
  createdAt: new Date()
};

const VALID_INPUT = {
  entityType: "ACCOUNT" as const,
  entityId: "acct-1",
  direction: "INBOUND" as const,
  graphMessageId: "AAMkAGRAND0M-1",
  subject: "Site walk-through",
  fromAddress: "pm@client.example",
  toAddresses: ["marco@initialservices.net"],
  snippet: "Confirming Thursday at 10am on-site.",
  sentAt: "2026-08-11T09:00:00Z",
  loggedById: "user-1"
};

// ── logEmail ─────────────────────────────────────────────────────────────────

describe("EmailLogService.logEmail", () => {
  it("persists a new email against ACCOUNT", async () => {
    const prisma = makePrisma();
    prisma.emailLog.create.mockResolvedValue(LOG_STUB);

    const service = makeService(prisma, makeEmail());
    const result = await service.logEmail(VALID_INPUT);

    expect(result).toEqual(LOG_STUB);
    expect(prisma.emailLog.create).toHaveBeenCalledTimes(1);
    const args = prisma.emailLog.create.mock.calls[0][0];
    expect(args.data.entityType).toBe("ACCOUNT");
    expect(args.data.graphMessageId).toBe("AAMkAGRAND0M-1");
    expect(args.data.sentAt).toBeInstanceOf(Date);
  });

  it("is idempotent on graphMessageId — returns the existing row without a second insert", async () => {
    const prisma = makePrisma();
    prisma.emailLog.findUnique.mockResolvedValue(LOG_STUB);

    const service = makeService(prisma, makeEmail());
    const result = await service.logEmail(VALID_INPUT);

    expect(result).toEqual(LOG_STUB);
    expect(prisma.emailLog.create).not.toHaveBeenCalled();
  });

  it("rejects an unsupported entityType (Job/Contract not in scope for CRM-5)", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeEmail());
    await expect(
      service.logEmail({ ...VALID_INPUT, entityType: "JOB" as never })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects empty entityId", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeEmail());
    await expect(
      service.logEmail({ ...VALID_INPUT, entityId: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects blank graphMessageId", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeEmail());
    await expect(
      service.logEmail({ ...VALID_INPUT, graphMessageId: "" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when recipient list is empty", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeEmail());
    await expect(
      service.logEmail({ ...VALID_INPUT, toAddresses: [] })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unparseable sentAt", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeEmail());
    await expect(
      service.logEmail({ ...VALID_INPUT, sentAt: "not-a-date" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when the attributing user is unknown", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    const service = makeService(prisma, makeEmail());
    await expect(
      service.logEmail({ ...VALID_INPUT, loggedById: "ghost" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("accepts a null loggedById for auto-captured webhook rows", async () => {
    const prisma = makePrisma();
    prisma.emailLog.create.mockResolvedValue({ ...LOG_STUB, loggedById: null });

    const service = makeService(prisma, makeEmail());
    const result = await service.logEmail({ ...VALID_INPUT, loggedById: null });

    expect(result.loggedById).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

// ── listEmails ───────────────────────────────────────────────────────────────

describe("EmailLogService.listEmails", () => {
  it("filters by entity and paginates", async () => {
    const prisma = makePrisma();
    prisma.emailLog.findMany.mockResolvedValue([LOG_STUB]);
    prisma.emailLog.count.mockResolvedValue(1);

    const service = makeService(prisma, makeEmail());
    const result = await service.listEmails({
      entityType: "ACCOUNT",
      entityId: "acct-1",
      page: 1,
      limit: 10
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    const args = prisma.emailLog.findMany.mock.calls[0][0];
    expect(args.where.entityType).toBe("ACCOUNT");
    expect(args.where.entityId).toBe("acct-1");
    expect(args.take).toBe(10);
    expect(args.skip).toBe(0);
  });

  it("clamps limit to 100", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeEmail());
    await service.listEmails({ limit: 9999 });
    const args = prisma.emailLog.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
  });

  it("rejects an unsupported entityType filter", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeEmail());
    await expect(
      service.listEmails({ entityType: "JOB" as never })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── getEmail ─────────────────────────────────────────────────────────────────

describe("EmailLogService.getEmail", () => {
  it("returns a row when it exists", async () => {
    const prisma = makePrisma();
    prisma.emailLog.findUnique.mockResolvedValue(LOG_STUB);

    const service = makeService(prisma, makeEmail());
    const result = await service.getEmail("log-1");
    expect(result.id).toBe("log-1");
  });

  it("throws NotFoundException when missing", async () => {
    const prisma = makePrisma();
    prisma.emailLog.findUnique.mockResolvedValue(null);

    const service = makeService(prisma, makeEmail());
    await expect(service.getEmail("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── verifyProvider (pass-through to EmailService seam) ───────────────────────

describe("EmailLogService.verifyProvider", () => {
  it("delegates to EmailService.verifyConnection without re-implementing it", async () => {
    const prisma = makePrisma();
    const email = makeEmail();
    const service = makeService(prisma, email);
    const result = await service.verifyProvider();
    expect(email.verifyConnection).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });
});
