import { NotFoundException } from "@nestjs/common";
import { TenderingService } from "../tendering.service";

function mockPrisma() {
  return {
    tender: {
      findUnique: jest.fn(),
      delete: jest.fn()
    },
    $transaction: jest.fn()
  };
}

function mockAudit() {
  return { write: jest.fn().mockResolvedValue({}) };
}

function mockEmail() {
  return { sendNotificationEmail: jest.fn() };
}

function mockSharePoint() {
  return {
    ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined),
    ensureTenderCategoryFolder: jest.fn().mockResolvedValue(undefined)
  };
}

function makeService(prisma: ReturnType<typeof mockPrisma>, audit: ReturnType<typeof mockAudit>) {
  return new TenderingService(
    prisma as never,
    audit as never,
    mockEmail() as never,
    mockSharePoint() as never
  );
}

describe("TenderingService.delete", () => {
  it("writes audit log before deleting", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    const callOrder: string[] = [];
    audit.write.mockImplementation(() => {
      callOrder.push("audit");
      return Promise.resolve({});
    });
    prisma.tender.findUnique.mockResolvedValue({
      id: "t-1",
      tenderNumber: "IS-T001",
      title: "Test",
      status: "DRAFT",
      _count: { clientQuotes: 2, scopeItems: 5, scopeCards: 1, tenderDocuments: 0, estimateExports: 0, tenderClients: 1, tenderNotes: 0, clarifications: 0 }
    });
    prisma.tender.delete.mockImplementation(() => {
      callOrder.push("delete");
      return Promise.resolve({});
    });

    const result = await service.delete("t-1", "user-1");

    expect(callOrder).toEqual(["audit", "delete"]);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "tenders.delete",
        entityType: "Tender",
        entityId: "t-1",
        metadata: expect.objectContaining({
          tenderNumber: "IS-T001",
          status: "DRAFT"
        })
      })
    );
    expect(prisma.tender.delete).toHaveBeenCalledWith({ where: { id: "t-1" } });
    expect(result).toEqual({
      id: "t-1",
      tenderNumber: "IS-T001",
      cascadedCounts: expect.objectContaining({ clientQuotes: 2 })
    });
  });

  it("throws NotFoundException for missing tender", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.tender.findUnique.mockResolvedValue(null);

    await expect(service.delete("nonexistent", "user-1")).rejects.toThrow(NotFoundException);
    expect(audit.write).not.toHaveBeenCalled();
    expect(prisma.tender.delete).not.toHaveBeenCalled();
  });
});

describe("TenderingService.deletePreflight", () => {
  it("returns tender with cascade counts", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.tender.findUnique.mockResolvedValue({
      id: "t-1",
      tenderNumber: "IS-T001",
      title: "Test",
      status: "AWARDED",
      _count: { clientQuotes: 3, scopeItems: 10, scopeCards: 2, tenderDocuments: 1, estimateExports: 2, tenderClients: 1 }
    });

    const result = await service.deletePreflight("t-1");
    expect(result.tenderNumber).toBe("IS-T001");
    expect(result.status).toBe("AWARDED");
    expect(result._count.clientQuotes).toBe(3);
  });

  it("throws NotFoundException for missing tender", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.tender.findUnique.mockResolvedValue(null);

    await expect(service.deletePreflight("nonexistent")).rejects.toThrow(NotFoundException);
  });
});
