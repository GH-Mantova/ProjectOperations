import { BadRequestException } from "@nestjs/common";
import { RateValidationService } from "../rate-validation.service";

function makePrisma() {
  return {
    rateRow: { findMany: jest.fn().mockResolvedValue([]) },
    globalList: { findUnique: jest.fn() },
    globalListItem: { findFirst: jest.fn() }
  };
}

describe("RateValidationService — structure", () => {
  test("rejects a table with no VALUE column", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null }
      ])
    ).toThrow(BadRequestException);
  });

  test("rejects VALUE column with no unit", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null },
        { name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "", listSlug: null }
      ])
    ).toThrow(/unit/);
  });

  test("rejects LIST_REF column with no listSlug", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "material", dataType: "LIST_REF", role: "KEY", unit: null, listSlug: "" },
        { name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "m", listSlug: null }
      ])
    ).toThrow(/listSlug/);
  });

  test("accepts a valid table", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null },
        { name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "hr", listSlug: null }
      ])
    ).not.toThrow();
  });
});

describe("RateValidationService — data", () => {
  const columns = [
    { id: "c-key", name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null, required: true, min: null, max: null } as any,
    { id: "c-val", name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "hr", listSlug: null, required: true, min: null, max: null } as any
  ];

  test("rejects negative VALUE cell", async () => {
    const prisma = makePrisma();
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", columns, { "c-key": "SEQ", "c-val": -10 })
    ).rejects.toThrow(/≥ 0/);
  });

  test("rejects duplicate KEY tuple across active rows", async () => {
    const prisma = makePrisma();
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-existing", cells: { "c-key": "SEQ", "c-val": 100 } }
    ]);
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", columns, { "c-key": "SEQ", "c-val": 120 })
    ).rejects.toThrow(/KEY-column values already exists/);
  });

  test("allows update of the same row with unchanged KEY", async () => {
    const prisma = makePrisma();
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-existing", cells: { "c-key": "SEQ", "c-val": 100 } }
    ]);
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", columns, { "c-key": "SEQ", "c-val": 200 }, { rowIdBeingUpdated: "r-existing" })
    ).resolves.toBeUndefined();
  });

  test("rejects LIST_REF cell whose value is not a live item", async () => {
    const prisma = makePrisma();
    prisma.globalList.findUnique.mockResolvedValue({ id: "list-1", slug: "materials" });
    prisma.globalListItem.findFirst.mockResolvedValue(null);
    const listRefColumns = [
      { id: "c-key", name: "material", dataType: "LIST_REF", role: "KEY", unit: null, listSlug: "materials", required: true, min: null, max: null } as any,
      { id: "c-val", name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "m", listSlug: null, required: true, min: null, max: null } as any
    ];
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", listRefColumns, { "c-key": "unobtainium", "c-val": 5 })
    ).rejects.toThrow(/not a live item/);
  });

  test("rejects missing required cell", async () => {
    const prisma = makePrisma();
    const svc = new RateValidationService(prisma as never);
    await expect(svc.validateRow("t-1", columns, { "c-val": 100 })).rejects.toThrow(/required/);
  });
});
