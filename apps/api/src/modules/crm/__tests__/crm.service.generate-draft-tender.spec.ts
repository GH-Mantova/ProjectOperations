import { BadRequestException, ConflictException } from "@nestjs/common";
import { CrmService } from "../crm.service";

// CRM S1: Lead model is removed; all lead rows are now Opportunity rows with
// isLead=true. The MockPrisma type no longer includes a `lead` table — all
// mocks go through `opportunity`.

type MockPrisma = {
  opportunity: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };
  client: { findUnique: jest.Mock };
  contact: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  site: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    opportunity: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
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

  it("returns 409 when the lead opportunity already has a converted tender", async () => {
    const prisma = makePrisma();
    // In the unified model: findUnique on opportunity returns isLead=true,
    // convertedTenderId already set → 409 before any conversion attempt.
    prisma.opportunity.findUnique.mockResolvedValue({
      id: "lead-1",
      isLead: true,
      clientId: "client-1",
      convertedTenderId: "tender-9"
    });
    const service = makeService(prisma, jest.fn());
    await expect(
      service.generateDraftTender("lead-1", { siteId: "site-1" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("promotes an isLead opportunity then creates a draft tender", async () => {
    const prisma = makePrisma();

    // generateDraftTender: first findUnique to check convertedTenderId
    // convertLeadToOpportunity: second findUnique to load the lead row
    // convertOpportunityToTender: third findUnique to load the opp with client
    prisma.opportunity.findUnique
      .mockResolvedValueOnce({
        id: "lead-1",
        isLead: true,
        clientId: "client-1",
        convertedTenderId: null
      })
      .mockResolvedValueOnce({
        id: "lead-1",
        isLead: true,
        clientId: "client-1",
        contactId: null,
        ownerId: null
      })
      .mockResolvedValueOnce({
        id: "lead-1",
        title: "Warehouse fit-out",
        clientId: "client-1",
        contactId: null,
        ownerId: null,
        description: null,
        probability: 40,
        estimatedValue: null,
        stage: "open",
        convertedTenderId: null,
        wonAt: null,
        client: { id: "client-1", name: "Acme" }
      });

    prisma.client.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.site.findUnique.mockResolvedValue({ id: "site-1" });

    // convertLeadToOpportunity update (promote lead → opp)
    prisma.opportunity.update
      .mockResolvedValueOnce({
        id: "lead-1",
        isLead: false,
        stage: "open",
        clientId: "client-1",
        probability: 40,
        estimatedValue: null
      })
      // convertOpportunityToTender update (mark won + link tender)
      .mockResolvedValueOnce({
        id: "lead-1",
        stage: "won",
        convertedTenderId: "tender-1",
        convertedTender: { id: "tender-1", tenderNumber: "T-001", title: "Warehouse fit-out", status: "DRAFT" }
      });

    const tenderCreate = jest
      .fn()
      .mockResolvedValue({ id: "tender-1", tenderNumber: "T-001", title: "Warehouse fit-out", status: "DRAFT" });

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
        where: { id: "lead-1" },
        data: expect.objectContaining({ stage: "won", convertedTenderId: "tender-1" })
      })
    );
    expect(result.convertedTenderId).toBe("tender-1");
  });

  it("skips lead promotion if isLead=false and converts to tender directly", async () => {
    const prisma = makePrisma();

    // generateDraftTender: findUnique — already isLead=false, no convertedTenderId
    prisma.opportunity.findUnique
      .mockResolvedValueOnce({
        id: "opp-existing",
        isLead: false,
        clientId: "client-1",
        convertedTenderId: null
      })
      // convertOpportunityToTender: findUnique with client include
      .mockResolvedValueOnce({
        id: "opp-existing",
        title: "From lead",
        clientId: "client-1",
        contactId: null,
        ownerId: null,
        description: null,
        probability: 50,
        estimatedValue: null,
        stage: "open",
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
    const result = await service.generateDraftTender("opp-existing", { siteId: "site-1" });

    // No isLead=true update — only the won update
    expect(prisma.opportunity.update).toHaveBeenCalledTimes(1);
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "opp-existing" },
        data: expect.objectContaining({ stage: "won", convertedTenderId: "tender-2" })
      })
    );
    expect(tenderCreate).toHaveBeenCalledTimes(1);
    expect(result.convertedTenderId).toBe("tender-2");
  });
});
