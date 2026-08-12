import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { LeadIntakeService } from "../lead-intake.service";

// ── Mock types ────────────────────────────────────────────────────────────────

type MockPrisma = {
  client: { findUnique: jest.Mock };
  account: { findFirst: jest.Mock; create: jest.Mock };
  opportunity: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  dropReason: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    client: { findUnique: jest.fn() },
    account: { findFirst: jest.fn(), create: jest.fn() },
    opportunity: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    dropReason: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    })
  };
  return prisma;
}

type MockAccountsService = {
  createAccount: jest.Mock;
};

type MockCrmService = {
  createLead: jest.Mock;
  generateDraftTender: jest.Mock;
};

function makeService(
  prisma: MockPrisma,
  accounts: MockAccountsService,
  crm: MockCrmService
): LeadIntakeService {
  return new LeadIntakeService(prisma as never, accounts as never, crm as never);
}

// ── captureLead ───────────────────────────────────────────────────────────────

describe("LeadIntakeService.captureLead", () => {
  it("throws BadRequestException when title is missing", async () => {
    const svc = makeService(makePrisma(), { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.captureLead({ title: "", clientId: "client-1" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws BadRequestException when clientId is missing", async () => {
    const svc = makeService(makePrisma(), { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.captureLead({ title: "New lead", clientId: "" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when client does not exist", async () => {
    const prisma = makePrisma();
    prisma.client.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma, { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.captureLead({ title: "Lead", clientId: "missing-client" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reuses an existing Account and creates the lead", async () => {
    const prisma = makePrisma();
    prisma.client.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.account.findFirst.mockResolvedValue({ id: "account-1" });

    const crmCreateLead = jest.fn().mockResolvedValue({ id: "opp-1" });
    prisma.opportunity.update.mockResolvedValue({
      id: "opp-1",
      captureChannel: "email",
      captureDetail: "Roof job enquiry",
      accountId: "account-1"
    });

    const svc = makeService(
      prisma,
      { createAccount: jest.fn() },
      { createLead: crmCreateLead, generateDraftTender: jest.fn() }
    );

    const result = await svc.captureLead({
      title: "Roof job",
      clientId: "client-1",
      captureChannel: "email",
      captureDetail: "Roof job enquiry"
    });

    expect(crmCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Roof job", clientId: "client-1" })
    );
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "opp-1" },
        data: expect.objectContaining({
          captureChannel: "email",
          captureDetail: "Roof job enquiry",
          accountId: "account-1"
        })
      })
    );
    expect(result.accountId).toBe("account-1");
  });

  it("auto-creates a PROSPECT Account when none exists for the client", async () => {
    const prisma = makePrisma();
    prisma.client.findUnique.mockResolvedValue({ id: "client-2" });
    prisma.account.findFirst.mockResolvedValue(null);

    const accounts = { createAccount: jest.fn().mockResolvedValue({ id: "account-new" }) };
    const crmCreateLead = jest.fn().mockResolvedValue({ id: "opp-2" });
    prisma.opportunity.update.mockResolvedValue({
      id: "opp-2",
      captureChannel: "phone",
      accountId: "account-new"
    });

    const svc = makeService(
      prisma,
      accounts,
      { createLead: crmCreateLead, generateDraftTender: jest.fn() }
    );

    await svc.captureLead({ title: "Phone lead", clientId: "client-2", captureChannel: "phone" });

    expect(accounts.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client-2", lifecycleStatus: "PROSPECT" })
    );
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "account-new" })
      })
    );
  });
});

// ── triageLead ────────────────────────────────────────────────────────────────

describe("LeadIntakeService.triageLead", () => {
  it("throws NotFoundException when lead does not exist", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma, { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.triageLead("missing-lead", { action: "tender", siteId: "site-1" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws ConflictException when lead is already in a terminal stage", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      stage: "not_pursued",
      isLead: true,
      convertedTenderId: null,
      dropReasonId: "dr-1"
    });
    const svc = makeService(prisma, { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.triageLead("opp-1", { action: "dont_pursue", dropReasonId: "dr-2" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('action="tender" requires siteId', async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      stage: "open",
      isLead: true,
      convertedTenderId: null,
      dropReasonId: null
    });
    const svc = makeService(prisma, { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.triageLead("opp-1", { action: "tender" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('action="tender" delegates to crm.generateDraftTender', async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      stage: "open",
      isLead: true,
      convertedTenderId: null,
      dropReasonId: null
    });
    const generateDraftTender = jest.fn().mockResolvedValue({
      id: "opp-1",
      stage: "won",
      convertedTenderId: "tender-1"
    });
    const svc = makeService(
      prisma,
      { createAccount: jest.fn() },
      { createLead: jest.fn(), generateDraftTender }
    );

    const result = await svc.triageLead("opp-1", { action: "tender", siteId: "site-1" }, "actor-1");

    expect(generateDraftTender).toHaveBeenCalledWith(
      "opp-1",
      { siteId: "site-1", title: undefined },
      "actor-1"
    );
    expect(result.convertedTenderId).toBe("tender-1");
  });

  it('action="dont_pursue" requires dropReasonId', async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      stage: "open",
      isLead: true,
      convertedTenderId: null,
      dropReasonId: null
    });
    const svc = makeService(prisma, { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.triageLead("opp-1", { action: "dont_pursue" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('action="dont_pursue" rejects inactive drop reason', async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      stage: "open",
      isLead: true,
      convertedTenderId: null,
      dropReasonId: null
    });
    prisma.dropReason.findUnique.mockResolvedValue({ id: "dr-inactive", isActive: false });
    const svc = makeService(prisma, { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    await expect(
      svc.triageLead("opp-1", { action: "dont_pursue", dropReasonId: "dr-inactive" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('action="dont_pursue" updates stage to not_pursued with reason', async () => {
    const prisma = makePrisma();
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      stage: "open",
      isLead: true,
      convertedTenderId: null,
      dropReasonId: null
    });
    prisma.dropReason.findUnique.mockResolvedValue({ id: "dr-1", isActive: true });
    prisma.opportunity.update.mockResolvedValue({
      id: "opp-1",
      stage: "not_pursued",
      dropReasonId: "dr-1",
      dropReasonDetail: "Out of area"
    });

    const svc = makeService(prisma, { createAccount: jest.fn() }, { createLead: jest.fn(), generateDraftTender: jest.fn() });
    const result = await svc.triageLead("opp-1", {
      action: "dont_pursue",
      dropReasonId: "dr-1",
      dropReasonDetail: "Out of area"
    });

    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "opp-1" },
        data: expect.objectContaining({
          stage: "not_pursued",
          dropReason: { connect: { id: "dr-1" } },
          dropReasonDetail: "Out of area"
        })
      })
    );
    expect(result.stage).toBe("not_pursued");
  });
});
