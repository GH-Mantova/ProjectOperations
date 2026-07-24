import { BadRequestException, ConflictException } from "@nestjs/common";
import { CrmService } from "../crm.service";

type MockPrisma = {
  lead: { findUnique: jest.Mock; update: jest.Mock };
  opportunity: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  client: { findUnique: jest.Mock };
  contact: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  site: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    lead: { findUnique: jest.fn(), update: jest.fn() },
    opportunity: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    client: { findUnique: jest.fn() },
    contact: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    site: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    })
  };
  return prisma;
}

function makeService(prisma: MockPrisma, tenderCreate: jest.Mock) {
  const tendering = { create: tenderCreate };
  return new CrmService(prisma as never, tendering as never);
}

describe("CrmService.generateDraftTender", () => {
  it("rejects when siteId is missing", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, jest.fn());
    await expect(
      service.generateDraftTender("lead-1", { siteId: "" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns 409 when the lead's opportunity already has a converted tender", async () => {
    const prisma = makePrisma();
    prisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      convertedOpportunityId: "opp-1",
      convertedOpportunity: { id: "opp-1", convertedTenderId: "tender-9" }
    });
    const service = makeService(prisma, jest.fn());
    await expect(
      service.generateDraftTender("lead-1", { siteId: "site-1" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("converts an unconverted lead → opportunity → draft tender in one call", async () => {
    const prisma = makePrisma();
    prisma.lead.findUnique
      .mockResolvedValueOnce({
        id: "lead-1",
        convertedOpportunityId: null,
        convertedOpportunity: null
      })
      .mockResolvedValueOnce({
        id: "lead-1",
        title: "Warehouse fit-out",
        clientId: "client-1",
        contactId: null,
        ownerId: null,
        source: "referral",
        convertedOpportunityId: null,
        notes: null
      });
    prisma.client.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.opportunity.create.mockResolvedValue({
      id: "opp-1",
      title: "Warehouse fit-out",
      clientId: "client-1",
      contactId: null,
      ownerId: null,
      description: null,
      probability: 40,
      estimatedValue: null,
      stage: "qualified",
      convertedTenderId: null,
      wonAt: null
    });
    prisma.lead.update.mockResolvedValue({});
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-1",
      title: "Warehouse fit-out",
      clientId: "client-1",
      contactId: null,
      ownerId: null,
      description: null,
      probability: 40,
      estimatedValue: null,
      stage: "qualified",
      convertedTenderId: null,
      wonAt: null,
      client: { id: "client-1", name: "Acme" }
    });
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    const tenderCreate = jest
      .fn()
      .mockResolvedValue({ id: "tender-1", tenderNumber: "T-001", title: "Warehouse fit-out", status: "DRAFT" });
    prisma.opportunity.update.mockResolvedValue({
      id: "opp-1",
      stage: "won",
      convertedTenderId: "tender-1",
      convertedTender: { id: "tender-1", tenderNumber: "T-001", title: "Warehouse fit-out", status: "DRAFT" }
    });

    const service = makeService(prisma, tenderCreate);
    const result = await service.generateDraftTender(
      "lead-1",
      { siteId: "site-1" },
      "actor-1"
    );

    expect(tenderCreate).toHaveBeenCalledTimes(1);
    const [tenderInput, actorId] = tenderCreate.mock.calls[0];
    expect(actorId).toBe("actor-1");
    expect(tenderInput.status).toBe("DRAFT");
    expect(tenderInput.siteId).toBe("site-1");
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "opp-1" },
        data: expect.objectContaining({ stage: "won", convertedTenderId: "tender-1" })
      })
    );
    expect(result.convertedTenderId).toBe("tender-1");
  });

  it("reuses the existing opportunity if the lead was already qualified", async () => {
    const prisma = makePrisma();
    prisma.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      convertedOpportunityId: "opp-existing",
      convertedOpportunity: { id: "opp-existing", convertedTenderId: null }
    });
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "opp-existing",
      title: "From lead",
      clientId: "client-1",
      contactId: null,
      ownerId: null,
      description: null,
      probability: 50,
      estimatedValue: null,
      stage: "quoting",
      convertedTenderId: null,
      wonAt: null,
      client: { id: "client-1", name: "Acme" }
    });
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });
    const tenderCreate = jest
      .fn()
      .mockResolvedValue({ id: "tender-2", tenderNumber: "T-002", title: "From lead", status: "DRAFT" });
    prisma.opportunity.update.mockResolvedValue({
      id: "opp-existing",
      stage: "won",
      convertedTenderId: "tender-2",
      convertedTender: { id: "tender-2", tenderNumber: "T-002", title: "From lead", status: "DRAFT" }
    });

    const service = makeService(prisma, tenderCreate);
    const result = await service.generateDraftTender("lead-1", { siteId: "site-1" });

    expect(prisma.opportunity.create).not.toHaveBeenCalled();
    expect(tenderCreate).toHaveBeenCalledTimes(1);
    expect(result.convertedTenderId).toBe("tender-2");
  });
});
