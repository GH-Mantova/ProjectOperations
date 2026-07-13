import { ConflictException, NotFoundException } from "@nestjs/common";
import { RateTablesService } from "../rate-tables.service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    rateTable: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({})
    },
    rateColumn: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({})
    },
    rateRow: { count: jest.fn().mockResolvedValue(0) },
    tenderRateEntry: { count: jest.fn().mockResolvedValue(0) },
    subcontractorSupplier: { findUnique: jest.fn() },
    ...overrides
  };
  return prisma;
}

function makeAudit() {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

const VALIDATION_STUB = { assertStructure: jest.fn(), validateRow: jest.fn() };

function build(prisma: ReturnType<typeof makePrisma>, audit = makeAudit()) {
  return {
    service: new RateTablesService(prisma as never, VALIDATION_STUB as never, audit as never),
    prisma,
    audit
  };
}

const RATE_TABLE = {
  id: "rt-1",
  name: "Excavator production",
  slug: "excavator-production",
  description: null,
  category: "SUBCONTRACTOR",
  subcontractorType: null,
  supplierId: null,
  isSystem: false,
  isReference: false,
  columns: [{ id: "c-1" }],
  rows: []
};

describe("RateTablesService.deleteTable", () => {
  test("throws NotFound when the table does not exist", async () => {
    const prisma = makePrisma();
    const { service } = build(prisma);
    await expect(service.deleteTable("missing", "actor-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  test("refuses with 409 when any RateRow references the table and writes no audit", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE);
    prisma.rateRow.count.mockResolvedValue(2);
    const { service, audit } = build(prisma);
    await expect(service.deleteTable("rt-1", "actor-1")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.rateTable.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  test("refuses with 409 when a TenderRateSet snapshot still references the table", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE);
    prisma.rateRow.count.mockResolvedValue(0);
    prisma.tenderRateEntry.count.mockResolvedValue(1);
    const { service, audit } = build(prisma);
    await expect(service.deleteTable("rt-1", "actor-1")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.rateTable.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  test("hard-deletes when unused and writes an audit row with the payload", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE);
    const { service, audit } = build(prisma);
    await expect(service.deleteTable("rt-1", "actor-1")).resolves.toEqual({ deleted: true });
    expect(prisma.rateTable.delete).toHaveBeenCalledWith({ where: { id: "rt-1" } });
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        action: "rateTable.delete",
        entityType: "RateTable",
        entityId: "rt-1",
        metadata: expect.objectContaining({
          slug: "excavator-production",
          category: "SUBCONTRACTOR",
          columnCount: 1
        })
      })
    );
  });
});

describe("RateTablesService.deleteColumn", () => {
  const COLUMN = {
    id: "col-1",
    rateTableId: "rt-1",
    name: "region",
    dataType: "TEXT",
    role: "KEY",
    unit: null,
    listSlug: null,
    required: false,
    min: null,
    max: null,
    sortOrder: 0
  };

  test("throws NotFound when the column is not on the table", async () => {
    const prisma = makePrisma();
    prisma.rateColumn.findUnique.mockResolvedValue({ ...COLUMN, rateTableId: "rt-other" });
    const { service } = build(prisma);
    await expect(service.deleteColumn("rt-1", "col-1", "actor-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  test("refuses with 409 when the parent table still has rows (cells would orphan)", async () => {
    const prisma = makePrisma();
    prisma.rateColumn.findUnique.mockResolvedValue(COLUMN);
    prisma.rateRow.count.mockResolvedValue(3);
    const { service, audit } = build(prisma);
    await expect(service.deleteColumn("rt-1", "col-1", "actor-1")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.rateColumn.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  test("hard-deletes when the table has no rows and writes an audit row", async () => {
    const prisma = makePrisma();
    prisma.rateColumn.findUnique.mockResolvedValue(COLUMN);
    const { service, audit } = build(prisma);
    await expect(service.deleteColumn("rt-1", "col-1", "actor-1")).resolves.toEqual({
      deleted: true
    });
    expect(prisma.rateColumn.delete).toHaveBeenCalledWith({ where: { id: "col-1" } });
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        action: "rateColumn.delete",
        entityType: "RateColumn",
        entityId: "col-1",
        metadata: expect.objectContaining({ rateTableId: "rt-1", name: "region", role: "KEY" })
      })
    );
  });
});
