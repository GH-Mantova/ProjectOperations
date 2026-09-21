import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ClientQuotesService } from "../client-quotes.service";

function mockPrisma() {
  return {
    tender: {
      findUnique: jest.fn()
    },
    clientQuote: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn()
    },
    quoteCostLine: {
      create: jest.fn()
    }
  };
}

function mockScope() {
  return { summary: jest.fn().mockResolvedValue({}) };
}

function mockAudit() {
  return { write: jest.fn().mockResolvedValue({}) };
}

function makeService(
  prisma: ReturnType<typeof mockPrisma>,
  scope: ReturnType<typeof mockScope>,
  audit: ReturnType<typeof mockAudit>
) {
  return new ClientQuotesService(
    prisma as never,
    scope as never,
    audit as never,
    { apply: async () => undefined } as never
  );
}

function primeCreatePreconditions(prisma: ReturnType<typeof mockPrisma>) {
  prisma.tender.findUnique.mockResolvedValue({ id: "t-1", tenderNumber: "T260913" });
  // No prior revision -> nextRevision = 1 -> quoteRef = tenderNumber.
  prisma.clientQuote.findMany.mockResolvedValue([]);
}

function makeP2002(target: string | string[]) {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    { code: "P2002", clientVersion: "test", meta: { target } }
  );
}

describe("ClientQuotesService.create - QPDF-3 quote_ref collision handling", () => {
  it("translates a P2002 on quote_ref (string target) into a ConflictException", async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma, mockScope(), mockAudit());
    primeCreatePreconditions(prisma);
    prisma.clientQuote.create.mockRejectedValue(makeP2002("quote_ref"));

    await expect(
      service.create("t-1", "user-1", { clientId: "client-B" })
    ).rejects.toThrow(ConflictException);

    await expect(
      service.create("t-1", "user-1", { clientId: "client-B" })
    ).rejects.toMatchObject({
      message: expect.stringContaining("T260913")
    });
  });

  it("recognises P2002 whose meta.target is a string array (Postgres shape)", async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma, mockScope(), mockAudit());
    primeCreatePreconditions(prisma);
    prisma.clientQuote.create.mockRejectedValue(makeP2002(["quote_ref"]));

    await expect(
      service.create("t-1", "user-1", { clientId: "client-B" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not swallow a P2002 that fires on a different column", async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma, mockScope(), mockAudit());
    primeCreatePreconditions(prisma);
    const err = makeP2002(["some_other_column"]);
    prisma.clientQuote.create.mockRejectedValue(err);

    await expect(
      service.create("t-1", "user-1", { clientId: "client-B" })
    ).rejects.toBe(err);
  });

  it("re-throws non-Prisma errors untouched", async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma, mockScope(), mockAudit());
    primeCreatePreconditions(prisma);
    const boom = new Error("network down");
    prisma.clientQuote.create.mockRejectedValue(boom);

    await expect(
      service.create("t-1", "user-1", { clientId: "client-B" })
    ).rejects.toBe(boom);
  });
});
