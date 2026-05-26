import { NotFoundException } from "@nestjs/common";
import { ClientQuotesService } from "../client-quotes.service";

function mockPrisma() {
  return {
    clientQuote: {
      findUnique: jest.fn(),
      delete: jest.fn()
    },
    tender: {
      findUnique: jest.fn()
    }
  };
}

function mockAudit() {
  return { write: jest.fn().mockResolvedValue({}) };
}

function makeService(prisma: ReturnType<typeof mockPrisma>, audit: ReturnType<typeof mockAudit>) {
  return new ClientQuotesService(
    prisma as never,
    {} as never,
    audit as never
  );
}

describe("ClientQuotesService.delete", () => {
  it("deletes a DRAFT quote with audit log", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.clientQuote.findUnique.mockResolvedValue({
      id: "q-1",
      tenderId: "t-1",
      quoteRef: "IS-T001",
      status: "DRAFT"
    });
    prisma.clientQuote.delete.mockResolvedValue({});

    const result = await service.delete("t-1", "q-1", "user-1");

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "quotes.delete",
        entityType: "ClientQuote",
        entityId: "q-1"
      })
    );
    expect(prisma.clientQuote.delete).toHaveBeenCalledWith({ where: { id: "q-1" } });
    expect(result).toEqual({ id: "q-1" });
  });

  it("deletes a SENT quote (no longer restricted to DRAFT)", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.clientQuote.findUnique.mockResolvedValue({
      id: "q-2",
      tenderId: "t-1",
      quoteRef: "IS-T001-R2",
      status: "SENT"
    });
    prisma.clientQuote.delete.mockResolvedValue({});

    const result = await service.delete("t-1", "q-2", "user-1");
    expect(result).toEqual({ id: "q-2" });
    expect(audit.write).toHaveBeenCalled();
  });

  it("deletes a SUPERSEDED quote", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.clientQuote.findUnique.mockResolvedValue({
      id: "q-3",
      tenderId: "t-1",
      quoteRef: "IS-T001-R3",
      status: "SUPERSEDED"
    });
    prisma.clientQuote.delete.mockResolvedValue({});

    const result = await service.delete("t-1", "q-3", "user-1");
    expect(result).toEqual({ id: "q-3" });
  });

  it("throws NotFoundException for missing quote", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.clientQuote.findUnique.mockResolvedValue(null);

    await expect(service.delete("t-1", "nonexistent", "user-1")).rejects.toThrow(NotFoundException);
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("throws NotFoundException if quote belongs to different tender", async () => {
    const prisma = mockPrisma();
    const audit = mockAudit();
    const service = makeService(prisma, audit);

    prisma.clientQuote.findUnique.mockResolvedValue({
      id: "q-1",
      tenderId: "t-OTHER",
      quoteRef: "IS-T002",
      status: "DRAFT"
    });

    await expect(service.delete("t-1", "q-1", "user-1")).rejects.toThrow(NotFoundException);
  });
});
