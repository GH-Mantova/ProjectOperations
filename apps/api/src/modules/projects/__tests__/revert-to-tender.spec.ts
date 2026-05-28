import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProjectsService } from "../projects.service";

function makeTxPrisma() {
  return {
    project: { findUnique: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    contract: { count: jest.fn().mockResolvedValue(0) },
    tender: { update: jest.fn().mockResolvedValue({}) },
    safetyIncident: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    hazardObservation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    tenderDocumentLink: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) }
  };
}

type TxPrisma = ReturnType<typeof makeTxPrisma>;

function mockPrisma(tx: TxPrisma) {
  return {
    ...tx,
    $transaction: jest.fn(async (fn: (client: TxPrisma) => Promise<unknown>) => fn(tx))
  };
}

function mockAudit() {
  return { write: jest.fn().mockResolvedValue({}) };
}

function makeService(prisma: ReturnType<typeof mockPrisma>) {
  return new ProjectsService(
    prisma as never,
    mockAudit() as never,
    { create: jest.fn() } as never,
    { sendNotificationEmail: jest.fn() } as never
  );
}

const PROJECT_ROW = {
  id: "p-1",
  projectNumber: "IS-P001",
  name: "Test Project",
  status: "MOBILISING",
  sourceTenderId: "t-1",
  sourceTender: { id: "t-1", tenderNumber: "IS-T001", title: "Test Tender", status: "AWARDED" },
  _count: {
    scopeItems: 5,
    milestones: 2,
    activityLog: 3,
    allocations: 1,
    preStartChecklists: 0,
    timesheets: 0,
    ganttTasks: 4,
    safetyIncidents: 0,
    hazardObservations: 0,
    documents: 2
  }
};

describe("ProjectsService.revertToTenderPreflight", () => {
  it("returns project info with cascade counts", async () => {
    const tx = makeTxPrisma();
    const prisma = mockPrisma(tx);
    const service = makeService(prisma);
    tx.project.findUnique.mockResolvedValue(PROJECT_ROW);
    tx.contract.count.mockResolvedValue(1);

    const result = await service.revertToTenderPreflight("p-1");

    expect(result.projectNumber).toBe("IS-P001");
    expect(result.sourceTender?.tenderNumber).toBe("IS-T001");
    expect(result.cascadeCounts.scopeItems).toBe(5);
    expect(result.cascadeCounts.ganttTasks).toBe(4);
    expect(result.cascadeCounts.contracts).toBe(1);
  });

  it("throws NotFoundException for missing project", async () => {
    const tx = makeTxPrisma();
    const prisma = mockPrisma(tx);
    const service = makeService(prisma);
    tx.project.findUnique.mockResolvedValue(null);

    await expect(service.revertToTenderPreflight("nonexistent")).rejects.toThrow(NotFoundException);
  });

  it("throws BadRequestException for project without source tender", async () => {
    const tx = makeTxPrisma();
    const prisma = mockPrisma(tx);
    const service = makeService(prisma);
    tx.project.findUnique.mockResolvedValue({ ...PROJECT_ROW, sourceTenderId: null });

    await expect(service.revertToTenderPreflight("p-1")).rejects.toThrow(BadRequestException);
  });
});

describe("ProjectsService.revertToTender", () => {
  it("deletes project, resets tender to CONTRACT_ISSUED, writes audit", async () => {
    const tx = makeTxPrisma();
    const prisma = mockPrisma(tx);
    const service = makeService(prisma);
    tx.project.findUnique.mockResolvedValue(PROJECT_ROW);

    const result = await service.revertToTender("p-1", "user-1");

    expect(result.success).toBe(true);
    expect(result.tenderId).toBe("t-1");
    expect(result.cascadeCounts.scopeItems).toBe(5);
    expect(typeof result.revertedAt).toBe("string");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.safetyIncident.updateMany).toHaveBeenCalledWith({
      where: { projectId: "p-1" },
      data: { projectId: null }
    });
    expect(tx.hazardObservation.updateMany).toHaveBeenCalledWith({
      where: { projectId: "p-1" },
      data: { projectId: null }
    });
    expect(tx.tenderDocumentLink.updateMany).toHaveBeenCalledWith({
      where: { projectId: "p-1" },
      data: { projectId: null }
    });
    expect(tx.project.delete).toHaveBeenCalledWith({ where: { id: "p-1" } });
    expect(tx.tender.update).toHaveBeenCalledWith({
      where: { id: "t-1" },
      data: { status: "CONTRACT_ISSUED" }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: "project.reverted_to_tender",
        entityType: "Project",
        entityId: "p-1",
        metadata: expect.objectContaining({ tenderId: "t-1", projectNumber: "IS-P001" })
      })
    });
  });

  it("throws NotFoundException for missing project", async () => {
    const tx = makeTxPrisma();
    const prisma = mockPrisma(tx);
    const service = makeService(prisma);
    tx.project.findUnique.mockResolvedValue(null);

    await expect(service.revertToTender("nonexistent", "user-1")).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws BadRequestException for project without source tender", async () => {
    const tx = makeTxPrisma();
    const prisma = mockPrisma(tx);
    const service = makeService(prisma);
    tx.project.findUnique.mockResolvedValue({ ...PROJECT_ROW, sourceTenderId: null });

    await expect(service.revertToTender("p-1", "user-1")).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rolls back if project delete throws", async () => {
    const tx = makeTxPrisma();
    const prisma = mockPrisma(tx);
    const service = makeService(prisma);
    tx.project.findUnique.mockResolvedValue(PROJECT_ROW);
    tx.project.delete.mockRejectedValue(new Error("FK constraint"));

    await expect(service.revertToTender("p-1", "user-1")).rejects.toThrow("FK constraint");
    expect(tx.tender.update).not.toHaveBeenCalled();
  });
});
