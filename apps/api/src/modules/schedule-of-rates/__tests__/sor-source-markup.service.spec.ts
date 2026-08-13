import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SorCategory, SorRateSourceType } from "@prisma/client";
import { SorSourceMarkupService } from "../sor-source-markup.service";

type MockPrisma = {
  sorRate: { findUnique: jest.Mock; update: jest.Mock };
  rateRow: { findUnique: jest.Mock; create: jest.Mock };
  subcontractorRate: { findUnique: jest.Mock };
  rateTable: { findUnique: jest.Mock };
};

type MockAudit = { write: jest.Mock };

function makePrisma(): MockPrisma {
  return {
    sorRate: { findUnique: jest.fn(), update: jest.fn() },
    rateRow: { findUnique: jest.fn(), create: jest.fn() },
    subcontractorRate: { findUnique: jest.fn() },
    rateTable: { findUnique: jest.fn() },
  };
}

function makeAudit(): MockAudit {
  return { write: jest.fn().mockResolvedValue({}) };
}

function make(prisma = makePrisma(), audit = makeAudit()) {
  const svc = new SorSourceMarkupService(
    prisma as never,
    audit as never,
  );
  return { svc, prisma, audit };
}

describe("SorSourceMarkupService.resolveEffectiveRate", () => {
  it("returns 0 for a rate with no base", () => {
    const { svc } = make();
    expect(
      svc.resolveEffectiveRate(
        { category: SorCategory.LABOUR, ordinary: null, markupPct: null },
        {},
      ),
    ).toBe(0);
  });

  it("uses the per-line markup override when set", () => {
    const { svc } = make();
    const result = svc.resolveEffectiveRate(
      {
        category: SorCategory.PLANT,
        ordinary: 100 as never,
        markupPct: 20 as never,
      },
      { PLANT: 10 },
    );
    // Per-line 20% wins over category 10%.
    expect(result).toBe(120);
  });

  it("falls back to the category-default markup when no override", () => {
    const { svc } = make();
    const result = svc.resolveEffectiveRate(
      { category: SorCategory.LABOUR, ordinary: 200 as never, markupPct: null },
      { LABOUR: 15 },
    );
    expect(result).toBe(230);
  });

  it("applies 0% when neither override nor category default present", () => {
    const { svc } = make();
    const result = svc.resolveEffectiveRate(
      { category: SorCategory.WASTE, ordinary: 50 as never, markupPct: null },
      {},
    );
    expect(result).toBe(50);
  });
});

describe("SorSourceMarkupService.parsePeriodMarkups", () => {
  it("returns {} for null / malformed input", () => {
    const { svc } = make();
    expect(svc.parsePeriodMarkups(null)).toEqual({});
    expect(svc.parsePeriodMarkups(undefined)).toEqual({});
    expect(svc.parsePeriodMarkups("nope" as never)).toEqual({});
    expect(svc.parsePeriodMarkups([1, 2] as never)).toEqual({});
  });

  it("keeps only known SorCategory keys with numeric values", () => {
    const { svc } = make();
    const out = svc.parsePeriodMarkups({
      LABOUR: 10,
      PLANT: "20",
      MYSTERY: 5,
      WASTE: "not-a-number",
    } as never);
    expect(out).toEqual({ LABOUR: 10, PLANT: 20 });
  });
});

describe("SorSourceMarkupService.linkInternalRate", () => {
  it("throws when the SoR rate is missing", async () => {
    const { svc, prisma } = make();
    prisma.sorRate.findUnique.mockResolvedValue(null);
    prisma.rateRow.findUnique.mockResolvedValue({ id: "rr-1" });
    await expect(svc.linkInternalRate("sr-x", "rr-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("switches sourceType to INTERNAL, clears vendor FK, and audits", async () => {
    const { svc, prisma, audit } = make();
    prisma.sorRate.findUnique.mockResolvedValue({
      id: "sr-1",
      sourceType: SorRateSourceType.MANUAL,
      sourceRateRowId: null,
      sourceSubRateId: null,
    });
    prisma.rateRow.findUnique.mockResolvedValue({ id: "rr-1" });
    prisma.sorRate.update.mockResolvedValue({ id: "sr-1" });

    await svc.linkInternalRate("sr-1", "rr-1", "user-42");

    expect(prisma.sorRate.update).toHaveBeenCalledWith({
      where: { id: "sr-1" },
      data: {
        sourceType: SorRateSourceType.INTERNAL,
        sourceRateRowId: "rr-1",
        sourceSubRateId: null,
      },
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-42",
        action: "sor.rate.link-internal",
        entityType: "SorRate",
        entityId: "sr-1",
      }),
    );
  });
});

describe("SorSourceMarkupService.linkVendorRate", () => {
  it("rejects source types other than SUBBIE/SUPPLIER", async () => {
    const { svc } = make();
    await expect(
      svc.linkVendorRate("sr-1", "sub-1", SorRateSourceType.INTERNAL as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("links to the vendor rate and clears the internal FK", async () => {
    const { svc, prisma } = make();
    prisma.sorRate.findUnique.mockResolvedValue({
      id: "sr-1",
      sourceType: SorRateSourceType.INTERNAL,
      sourceRateRowId: "rr-old",
      sourceSubRateId: null,
    });
    prisma.subcontractorRate.findUnique.mockResolvedValue({ id: "sub-1" });
    prisma.sorRate.update.mockResolvedValue({ id: "sr-1" });

    await svc.linkVendorRate("sr-1", "sub-1", "SUBBIE");

    expect(prisma.sorRate.update).toHaveBeenCalledWith({
      where: { id: "sr-1" },
      data: {
        sourceType: SorRateSourceType.SUBBIE,
        sourceSubRateId: "sub-1",
        sourceRateRowId: null,
      },
    });
  });
});

describe("SorSourceMarkupService.promoteToHub", () => {
  it("refuses to promote a non-MANUAL rate", async () => {
    const { svc, prisma } = make();
    prisma.sorRate.findUnique.mockResolvedValue({
      id: "sr-1",
      sourceType: SorRateSourceType.INTERNAL,
      category: SorCategory.LABOUR,
    });
    await expect(svc.promoteToHub("sr-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("refuses to promote SUBCONTRACTOR-category lines (belongs on vendor hub)", async () => {
    const { svc, prisma } = make();
    prisma.sorRate.findUnique.mockResolvedValue({
      id: "sr-1",
      sourceType: SorRateSourceType.MANUAL,
      category: SorCategory.SUBCONTRACTOR,
    });
    await expect(svc.promoteToHub("sr-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates a RateRow and re-links the SoR line as INTERNAL", async () => {
    const { svc, prisma, audit } = make();
    prisma.sorRate.findUnique
      // First call from promoteToHub
      .mockResolvedValueOnce({
        id: "sr-1",
        sourceType: SorRateSourceType.MANUAL,
        category: SorCategory.LABOUR,
        name: "Foreman",
        class: null,
        unit: "day",
        ordinary: 100,
        oneAndHalf: 150,
        double: 200,
      })
      // Second call from linkInternalRate
      .mockResolvedValueOnce({
        id: "sr-1",
        sourceType: SorRateSourceType.MANUAL,
        sourceRateRowId: null,
        sourceSubRateId: null,
      });
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "rt-lbr",
      slug: "labour",
      columns: [
        { id: "c-role", name: "Role", sortOrder: 1 },
        { id: "c-day", name: "Day rate", sortOrder: 2 },
        { id: "c-night", name: "Night rate", sortOrder: 3 },
        { id: "c-weekend", name: "Weekend rate", sortOrder: 4 },
      ],
    });
    prisma.rateRow.create.mockResolvedValue({ id: "rr-new" });
    prisma.rateRow.findUnique.mockResolvedValue({ id: "rr-new" });
    prisma.sorRate.update.mockResolvedValue({ id: "sr-1" });

    await svc.promoteToHub("sr-1", "user-42");

    expect(prisma.rateRow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rateTableId: "rt-lbr",
        cells: {
          "c-role": "Foreman",
          "c-day": 100,
          "c-night": 150,
          "c-weekend": 200,
        },
      }),
    });
    // Both the promote-to-hub audit and the link-internal audit fire.
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "sor.rate.promote-to-hub" }),
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "sor.rate.link-internal" }),
    );
  });
});
