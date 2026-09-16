// SCOPE_OPERATIONAL_COSTS_PRICED_V1 — tests for the fourth independently
// marked-up cost stream.
//
// These tests exercise:
//   1. computeOperationalLineTotal: qty x days x (rateOverride ?? rate)
//   2. computeOperationalLineMarkup: line -> card -> tender inheritance
//   3. The fourth stream in ScopeRedesignService.summary()
//   4. Independence from waste and cutting streams
//
// All Prisma calls are mocked; no DB required.

import { Prisma } from "@prisma/client";
import {
  computeOperationalLineMarkup,
  computeOperationalLineTotal
} from "../scope-item-pricing";
import { ScopeRedesignService } from "../scope-redesign.service";

// ── Pure helpers ─────────────────────────────────────────────────────────

function dec(v: number | null): Prisma.Decimal | null {
  if (v === null) return null;
  return new Prisma.Decimal(v);
}

function makeLine(overrides: {
  qty?: number | null;
  unit?: string | null;
  days?: number | null;
  rate?: number | null;
  rateOverride?: number | null;
  markupOverride?: number | null;
} = {}) {
  return {
    qty: dec(overrides.qty ?? null),
    unit: overrides.unit ?? "day",
    days: dec(overrides.days ?? null),
    rate: dec(overrides.rate ?? null),
    rateOverride: dec(overrides.rateOverride ?? null),
    markupOverride: dec(overrides.markupOverride ?? null)
  };
}

// ── computeOperationalLineTotal ─────────────────────────────────────────

describe("computeOperationalLineTotal", () => {
  it("totals qty x days x rate for a duration-bearing unit", () => {
    // 2 traffic controllers x 10 days x $850 = $17,000
    const line = makeLine({ qty: 2, unit: "day", days: 10, rate: 850 });
    expect(computeOperationalLineTotal(line)).toBe(17000);
  });

  it("pins days to 1 for a non-duration-bearing unit (Lump sum)", () => {
    // qty 2 x days 7 (stored) x rate 850 => qty 2 x 1 x 850 = $1,700
    const line = makeLine({ qty: 2, unit: "Lump sum", days: 7, rate: 850 });
    expect(computeOperationalLineTotal(line)).toBe(1700);
  });

  it("uses rateOverride instead of rate when present", () => {
    const line = makeLine({ qty: 3, unit: "day", days: 5, rate: 800, rateOverride: 900 });
    // 3 x 5 x 900 = 13,500
    expect(computeOperationalLineTotal(line)).toBe(13500);
  });

  it("treats rateOverride of 0 as a real override (not absent)", () => {
    const line = makeLine({ qty: 3, unit: "day", days: 5, rate: 800, rateOverride: 0 });
    // 3 x 5 x 0 = 0
    expect(computeOperationalLineTotal(line)).toBe(0);
  });

  it("returns 0 when qty is null", () => {
    const line = makeLine({ qty: null, unit: "day", days: 5, rate: 850 });
    expect(computeOperationalLineTotal(line)).toBe(0);
  });

  it("returns 0 when rate and rateOverride are both null", () => {
    const line = makeLine({ qty: 2, unit: "day", days: 5, rate: null, rateOverride: null });
    expect(computeOperationalLineTotal(line)).toBe(0);
  });

  it("pins days to 1 for an Ea unit", () => {
    // Ea: qty x 1 x rate
    const line = makeLine({ qty: 4, unit: "Ea", days: 3, rate: 500 });
    expect(computeOperationalLineTotal(line)).toBe(2000);
  });
});

// ── computeOperationalLineMarkup ─────────────────────────────────────────

describe("computeOperationalLineMarkup", () => {
  it("uses line.markupOverride when present", () => {
    expect(computeOperationalLineMarkup(15, 20, 30)).toBe(15);
  });

  it("falls back to card.markupOverride when line override is null", () => {
    expect(computeOperationalLineMarkup(null, 20, 30)).toBe(20);
  });

  it("falls back to tenderMarkup when both overrides are null", () => {
    expect(computeOperationalLineMarkup(null, null, 30)).toBe(30);
  });

  it("treats a stored 0 line override as a real override (0% markup)", () => {
    expect(computeOperationalLineMarkup(0, 20, 30)).toBe(0);
  });

  it("treats a stored 0 card override as a real override", () => {
    expect(computeOperationalLineMarkup(null, 0, 30)).toBe(0);
  });
});

// ── ScopeRedesignService.summary() — fourth stream ───────────────────────

function makeRateResolver() {
  return {
    listRates: jest.fn(async (slug: string) => {
      if (slug === "labour") return [];
      if (slug === "plant") return [];
      return [];
    })
  } as never;
}

function makePrisma(opts: {
  tenderMarkup?: number;
  operationalLines?: unknown[];
  wasteItems?: unknown[];
  cuttingItems?: unknown[];
}) {
  return {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
    scopeOfWorksItem: { findMany: jest.fn().mockResolvedValue([]) },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ markup: opts.tenderMarkup ?? 30 })
    },
    scopeWasteItem: {
      findMany: jest.fn().mockResolvedValue(opts.wasteItems ?? [])
    },
    cuttingSheetItem: {
      findMany: jest.fn().mockResolvedValue(opts.cuttingItems ?? [])
    },
    scopeOperationalCostLine: {
      findMany: jest.fn().mockResolvedValue(opts.operationalLines ?? [])
    }
  } as never;
}

function makeOpLine(overrides: {
  cardId?: string;
  qty?: number;
  unit?: string;
  days?: number;
  rate?: number;
  rateOverride?: number | null;
  lineMarkupOverride?: number | null;
  cardMarkupOverride?: number | null;
} = {}) {
  return {
    cardId: overrides.cardId ?? "c-1",
    qty: new Prisma.Decimal(overrides.qty ?? 2),
    unit: overrides.unit ?? "day",
    days: new Prisma.Decimal(overrides.days ?? 10),
    rate: new Prisma.Decimal(overrides.rate ?? 850),
    rateOverride: overrides.rateOverride !== undefined ? (overrides.rateOverride === null ? null : new Prisma.Decimal(overrides.rateOverride)) : null,
    markupOverride: overrides.lineMarkupOverride !== undefined ? (overrides.lineMarkupOverride === null ? null : new Prisma.Decimal(overrides.lineMarkupOverride)) : null,
    card: {
      markupOverride: overrides.cardMarkupOverride !== undefined
        ? (overrides.cardMarkupOverride === null ? null : new Prisma.Decimal(overrides.cardMarkupOverride))
        : null
    }
  };
}

describe("scope-redesign summary() — operational costs (fourth stream)", () => {
  it("2 traffic controllers x 10 days x $850 totals $17,000.00, not $1,700", async () => {
    const line = makeOpLine({ qty: 2, unit: "day", days: 10, rate: 850 });
    const prisma = makePrisma({ tenderMarkup: 0, operationalLines: [line] });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      operationalCosts: { subtotal: number; withMarkup: number };
    };
    expect(result.operationalCosts.subtotal).toBe(17000);
  });

  it("a Lump sum line with stored days=7 totals qty x rate (days pinned to 1)", async () => {
    const line = makeOpLine({ qty: 2, unit: "Lump sum", days: 7, rate: 850 });
    const prisma = makePrisma({ tenderMarkup: 0, operationalLines: [line] });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      operationalCosts: { subtotal: number };
    };
    // 2 x 1 x 850 = 1,700 (days pinned)
    expect(result.operationalCosts.subtotal).toBe(1700);
  });

  it("rateOverride 0 prices to 0 and is not treated as absent", async () => {
    const line = makeOpLine({ qty: 2, unit: "day", days: 5, rate: 850, rateOverride: 0 });
    const prisma = makePrisma({ tenderMarkup: 0, operationalLines: [line] });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      operationalCosts: { subtotal: number };
    };
    expect(result.operationalCosts.subtotal).toBe(0);
  });

  it("markup resolves line -> card -> tender", async () => {
    // Tender 30%, card 20%, line 10% — line wins.
    const lineWithLineOverride = makeOpLine({ qty: 1, unit: "day", days: 1, rate: 1000, lineMarkupOverride: 10, cardMarkupOverride: 20 });
    const prisma = makePrisma({ tenderMarkup: 30, operationalLines: [lineWithLineOverride] });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      operationalCosts: { subtotal: number; withMarkup: number };
    };
    expect(result.operationalCosts.subtotal).toBe(1000);
    // 1000 * 1.10 = 1100
    expect(result.operationalCosts.withMarkup).toBe(1100);
  });

  it("a stored 0 line markup override means 0% markup (not inherit)", async () => {
    const line = makeOpLine({ qty: 1, unit: "day", days: 1, rate: 1000, lineMarkupOverride: 0, cardMarkupOverride: 20 });
    const prisma = makePrisma({ tenderMarkup: 30, operationalLines: [line] });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      operationalCosts: { subtotal: number; withMarkup: number };
    };
    // 0% markup: 1000 * 1.00 = 1000
    expect(result.operationalCosts.withMarkup).toBe(1000);
  });

  it("a null qty contributes 0", async () => {
    const line = { ...makeOpLine({ rate: 850 }), qty: null };
    const prisma = makePrisma({ tenderMarkup: 30, operationalLines: [line] });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      operationalCosts: { subtotal: number };
    };
    expect(result.operationalCosts.subtotal).toBe(0);
  });

  it("tenderPrice = the four streams (scope + cutting + waste + operational)", async () => {
    const opLine = makeOpLine({ qty: 1, unit: "day", days: 1, rate: 500 });
    const wasteItem = {
      cardId: "c-1",
      discipline: "DEM",
      lineTotal: "1000",
      card: { wasteMarkupOverride: null }
    };
    const cuttingItem = {
      cardId: "c-1",
      lineTotal: "200",
      card: { cuttingMarkupOverride: null }
    };
    const prisma = makePrisma({
      tenderMarkup: 0,
      operationalLines: [opLine],
      wasteItems: [wasteItem],
      cuttingItems: [cuttingItem]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      tenderPrice: number;
      operationalCosts: { withMarkup: number };
    };
    // 0 (scope) + 1000 (waste) + 200 (cutting) + 500 (operational) = 1700
    expect(result.tenderPrice).toBe(1700);
    expect(result.operationalCosts.withMarkup).toBe(500);
  });

  it("tenderPrice moves by exactly operationalWithMarkup when a line is added", async () => {
    const prisma0 = makePrisma({ tenderMarkup: 25, operationalLines: [] });
    const svc0 = new ScopeRedesignService(prisma0, makeRateResolver());
    const before = (await svc0.summary("t-1")) as { tenderPrice: number };

    const opLine = makeOpLine({ qty: 2, unit: "day", days: 5, rate: 400 });
    // 2 x 5 x 400 = 4000, markup 25% => 5000
    const prisma1 = makePrisma({ tenderMarkup: 25, operationalLines: [opLine] });
    const svc1 = new ScopeRedesignService(prisma1, makeRateResolver());
    const after = (await svc1.summary("t-1")) as {
      tenderPrice: number;
      operationalCosts: { withMarkup: number };
    };

    expect(after.operationalCosts.withMarkup).toBe(5000);
    expect(after.tenderPrice - before.tenderPrice).toBe(5000);
  });

  it("waste and cutting figures are byte-identical before and after adding an operational line", async () => {
    const wasteItem = {
      cardId: "c-1",
      discipline: "DEM",
      lineTotal: "1000",
      card: { wasteMarkupOverride: "10" }
    };
    const cuttingItem = {
      cardId: "c-1",
      lineTotal: "500",
      card: { cuttingMarkupOverride: "20" }
    };

    const prismaNoOp = makePrisma({
      tenderMarkup: 30,
      operationalLines: [],
      wasteItems: [wasteItem],
      cuttingItems: [cuttingItem]
    });
    const svcNoOp = new ScopeRedesignService(prismaNoOp, makeRateResolver());
    const before = (await svcNoOp.summary("t-1")) as {
      waste: { subtotal: number; withMarkup: number };
      cutting: { subtotal: number; withMarkup: number };
    };

    const opLine = makeOpLine({ qty: 3, unit: "day", days: 7, rate: 600 });
    const prismaWithOp = makePrisma({
      tenderMarkup: 30,
      operationalLines: [opLine],
      wasteItems: [wasteItem],
      cuttingItems: [cuttingItem]
    });
    const svcWithOp = new ScopeRedesignService(prismaWithOp, makeRateResolver());
    const after = (await svcWithOp.summary("t-1")) as {
      waste: { subtotal: number; withMarkup: number };
      cutting: { subtotal: number; withMarkup: number };
    };

    expect(after.waste.subtotal).toBe(before.waste.subtotal);
    expect(after.waste.withMarkup).toBe(before.waste.withMarkup);
    expect(after.cutting.subtotal).toBe(before.cutting.subtotal);
    expect(after.cutting.withMarkup).toBe(before.cutting.withMarkup);
  });
});
