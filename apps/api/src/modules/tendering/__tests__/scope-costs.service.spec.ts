// scope-costs.service.spec.ts
//
// SCOPE_OPERATIONAL_COSTS_V1 — create / list / patch / delete against a card,
// plus the lump-sum rule. All Prisma calls are mocked; no DB required.
//
// What these tests pin down:
//   1. create() writes the card FK, the raw inputs and NO total column.
//   2. create() rejects days !== 1 on a unit that carries no duration.
//   3. create() accepts days on a duration-bearing unit, case-insensitively.
//   4. list() is scoped to the card and ordered sortOrder, createdAt.
//   5. update() only writes the keys the PATCH carried.
//   6. update() checks the lump-sum rule against the EFFECTIVE unit/days —
//      a unit-only PATCH onto a row already carrying days=3 is rejected.
//   7. remove() refuses a line belonging to another card.
//   8. Every method refuses a card that is not on the tender in the path.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ScopeCostsService } from "../scope-costs.service";
import {
  assertDaysAllowedForUnit,
  isDurationBearingUnit
} from "../dto/scope-costs.dto";

const TENDER_ID = "tender-1";
const CARD_ID = "card-1";
const LINE_ID = "line-1";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LINE_ID,
    cardId: CARD_ID,
    description: "Traffic control",
    qty: new Prisma.Decimal("3"),
    unit: "day",
    days: new Prisma.Decimal("3"),
    rate: new Prisma.Decimal("450.00"),
    rateOverride: null,
    plantRateId: null,
    sortOrder: 0,
    createdById: "user-1",
    createdAt: new Date("2026-09-05T00:00:00Z"),
    updatedAt: new Date("2026-09-05T00:00:00Z"),
    ...overrides
  };
}

function buildPrisma(opts: { card?: unknown; existing?: unknown } = {}) {
  const cardFindFirst = jest
    .fn()
    .mockResolvedValue(opts.card === undefined ? { id: CARD_ID } : opts.card);
  const findMany = jest.fn().mockResolvedValue([makeRow()]);
  const findUnique = jest
    .fn()
    .mockResolvedValue(opts.existing === undefined ? makeRow() : opts.existing);
  const create = jest.fn().mockImplementation(async (args: { data: unknown }) => args.data);
  const update = jest.fn().mockResolvedValue(makeRow());
  const del = jest.fn().mockResolvedValue(makeRow());

  const prisma = {
    scopeCard: { findFirst: cardFindFirst },
    scopeOperationalCostLine: { findMany, findUnique, create, update, delete: del }
  };
  return { prisma, mocks: { cardFindFirst, findMany, findUnique, create, update, del } };
}

function makeService(prisma: unknown) {
  return new ScopeCostsService(prisma as never);
}

// ---------------------------------------------------------------------------
// The duration-bearing unit list itself
// ---------------------------------------------------------------------------
describe("isDurationBearingUnit", () => {
  it("recognises the duration-bearing units case- and whitespace-insensitively", () => {
    expect(isDurationBearingUnit("day")).toBe(true);
    expect(isDurationBearingUnit(" Day ")).toBe(true);
    expect(isDurationBearingUnit("HOURS")).toBe(true);
    expect(isDurationBearingUnit("wk")).toBe(true);
  });

  it("default-denies everything else, including null and unknown units", () => {
    expect(isDurationBearingUnit("Ea")).toBe(false);
    expect(isDurationBearingUnit("Lump sum")).toBe(false);
    expect(isDurationBearingUnit("m2")).toBe(false);
    expect(isDurationBearingUnit("each way")).toBe(false);
    expect(isDurationBearingUnit(null)).toBe(false);
    expect(isDurationBearingUnit(undefined)).toBe(false);
    expect(isDurationBearingUnit("fortnight")).toBe(false);
  });
});

describe("assertDaysAllowedForUnit", () => {
  it("allows null, undefined and exactly 1 on any unit", () => {
    expect(() => assertDaysAllowedForUnit("Lump sum", null)).not.toThrow();
    expect(() => assertDaysAllowedForUnit("Lump sum", undefined)).not.toThrow();
    expect(() => assertDaysAllowedForUnit("Lump sum", 1)).not.toThrow();
    expect(() => assertDaysAllowedForUnit("Ea", 1)).not.toThrow();
  });

  it("rejects days other than 1 on a unit carrying no duration", () => {
    expect(() => assertDaysAllowedForUnit("Ea", 3)).toThrow(BadRequestException);
    expect(() => assertDaysAllowedForUnit("Lump sum", 0)).toThrow(BadRequestException);
    expect(() => assertDaysAllowedForUnit(null, 2)).toThrow(BadRequestException);
  });

  it("allows days on a duration-bearing unit", () => {
    expect(() => assertDaysAllowedForUnit("day", 3)).not.toThrow();
    expect(() => assertDaysAllowedForUnit("Hours", 7.5)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe("ScopeCostsService.create", () => {
  it("writes the card FK and the raw inputs, and stores NO total", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).create(TENDER_ID, CARD_ID, "user-1", {
      description: "  Traffic control, 3 days  ",
      qty: 3,
      unit: "day",
      days: 3,
      rate: 450,
      sortOrder: 2
    });

    const data = mocks.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.cardId).toBe(CARD_ID);
    expect(data.description).toBe("Traffic control, 3 days");
    expect(Number(data.qty)).toBe(3);
    expect(data.unit).toBe("day");
    expect(Number(data.days)).toBe(3);
    expect(Number(data.rate)).toBe(450);
    expect(data.rateOverride).toBeNull();
    expect(data.plantRateId).toBeNull();
    expect(data.sortOrder).toBe(2);
    expect(data.createdById).toBe("user-1");
    // The whole point of the model: no stored total.
    expect(data).not.toHaveProperty("total");
    expect(data).not.toHaveProperty("lineTotal");
  });

  it("keeps a rateOverride of 0 as a real value, not an absence", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).create(TENDER_ID, CARD_ID, "user-1", {
      description: "Free permit",
      rate: 100,
      rateOverride: 0
    });
    const data = mocks.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(Number(data.rateOverride)).toBe(0);
  });

  it("rejects a blank description", async () => {
    const { prisma } = buildPrisma();
    await expect(
      makeService(prisma).create(TENDER_ID, CARD_ID, "user-1", { description: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects days on a lump-sum line", async () => {
    const { prisma, mocks } = buildPrisma();
    await expect(
      makeService(prisma).create(TENDER_ID, CARD_ID, "user-1", {
        description: "Site establishment",
        unit: "Lump sum",
        days: 5,
        rate: 2000
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("accepts days on a duration-bearing unit", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).create(TENDER_ID, CARD_ID, "user-1", {
      description: "Traffic control",
      unit: "Days",
      days: 3
    });
    expect(mocks.create).toHaveBeenCalled();
  });

  it("refuses a card that is not on the tender in the path", async () => {
    const { prisma, mocks } = buildPrisma({ card: null });
    await expect(
      makeService(prisma).create(TENDER_ID, CARD_ID, "user-1", { description: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------
describe("ScopeCostsService.list", () => {
  it("scopes to the card and orders by sortOrder then createdAt", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).list(TENDER_ID, CARD_ID);
    expect(mocks.cardFindFirst).toHaveBeenCalledWith({
      where: { id: CARD_ID, tenderId: TENDER_ID },
      select: { id: true }
    });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { cardId: CARD_ID },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  });

  it("refuses a card that is not on the tender in the path", async () => {
    const { prisma, mocks } = buildPrisma({ card: null });
    await expect(makeService(prisma).list(TENDER_ID, CARD_ID)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------
describe("ScopeCostsService.update", () => {
  it("writes only the keys the PATCH carried", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).update(TENDER_ID, CARD_ID, LINE_ID, { description: "Permits" });
    const call = mocks.update.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> };
    expect(call.where).toEqual({ id: LINE_ID });
    expect(Object.keys(call.data)).toEqual(["description"]);
    expect(call.data.description).toBe("Permits");
  });

  it("patches qty and rateOverride as Decimals", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).update(TENDER_ID, CARD_ID, LINE_ID, { qty: 4.5, rateOverride: 500 });
    const data = mocks.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(Number(data.qty)).toBe(4.5);
    expect(Number(data.rateOverride)).toBe(500);
    expect(data).not.toHaveProperty("days");
    expect(data).not.toHaveProperty("unit");
  });

  it("clears rateOverride back to inherit when null is sent", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).update(TENDER_ID, CARD_ID, LINE_ID, { rateOverride: null });
    const data = mocks.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.rateOverride).toBeNull();
  });

  it("rejects a unit-only PATCH that would leave an existing days=3 row on a lump sum", async () => {
    // Existing row is unit "day", days 3. The PATCH carries only the unit.
    // The rule must be checked against the EFFECTIVE pair, not the body.
    const { prisma, mocks } = buildPrisma();
    await expect(
      makeService(prisma).update(TENDER_ID, CARD_ID, LINE_ID, { unit: "Lump sum" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows the unit-only PATCH once days is pinned to 1 in the same body", async () => {
    const { prisma, mocks } = buildPrisma();
    await makeService(prisma).update(TENDER_ID, CARD_ID, LINE_ID, { unit: "Lump sum", days: 1 });
    const data = mocks.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.unit).toBe("Lump sum");
    expect(Number(data.days)).toBe(1);
  });

  it("refuses a line belonging to another card", async () => {
    const { prisma, mocks } = buildPrisma({ existing: makeRow({ cardId: "other-card" }) });
    await expect(
      makeService(prisma).update(TENDER_ID, CARD_ID, LINE_ID, { description: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------
describe("ScopeCostsService.remove", () => {
  it("deletes the line and reports it", async () => {
    const { prisma, mocks } = buildPrisma();
    await expect(makeService(prisma).remove(TENDER_ID, CARD_ID, LINE_ID)).resolves.toEqual({
      deleted: true
    });
    expect(mocks.del).toHaveBeenCalledWith({ where: { id: LINE_ID } });
  });

  it("refuses a line belonging to another card", async () => {
    const { prisma, mocks } = buildPrisma({ existing: makeRow({ cardId: "other-card" }) });
    await expect(
      makeService(prisma).remove(TENDER_ID, CARD_ID, LINE_ID)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("refuses a card that is not on the tender in the path", async () => {
    const { prisma, mocks } = buildPrisma({ card: null });
    await expect(
      makeService(prisma).remove(TENDER_ID, CARD_ID, LINE_ID)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
