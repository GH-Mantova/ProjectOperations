// SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — per-line markup on waste and
// cutting lines.
//
// Tests:
//   1. waste 1,000 + card override 10% → 1,100 (line inherits card)
//   2. waste 1,000 + card override 10% + line override 25% → 1,250
//   3. waste 1,000 + stored 0 line override → 1,000 (0 is a real override, not absence)
//   4. cutting resolves via cuttingMarkupOverride (NOT card.markupOverride)
//   5. equivalence: no line overrides → summary() totals are byte-identical to
//      old per-card approach (because constant factor per card means line-by-line
//      gives the same sum)
//   6. S2a destination buckets still split when a marked-up line is OPTION

import { Prisma } from "@prisma/client";
import { resolveEffectiveMarkup } from "../scope-item-pricing";
import { ScopeRedesignService } from "../scope-redesign.service";
import { SCOPE_LINE_MARKUP_ALL_TYPES_V1 } from "../scope-redesign.service";

// ── Factories ────────────────────────────────────────────────────────────

function dec(v: number | null): Prisma.Decimal | null {
  if (v === null) return null;
  return new Prisma.Decimal(v);
}

function makeRateResolver(opts: { labour?: unknown[]; plant?: unknown[] } = {}) {
  return {
    listRates: jest.fn(async (slug: string) => {
      if (slug === "labour") return opts.labour ?? [];
      if (slug === "plant") return opts.plant ?? [];
      return [];
    })
  } as never;
}

function makePrisma(opts: {
  scopeItems?: unknown[];
  tenderMarkup?: number;
  wasteItems?: unknown[];
  cuttingItems?: unknown[];
  operationalCostLines?: unknown[];
}) {
  return {
    tender: {
      findUnique: jest.fn().mockResolvedValue({ id: "t-1" })
    },
    scopeOfWorksItem: {
      findMany: jest.fn().mockResolvedValue(opts.scopeItems ?? [])
    },
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
      findMany: jest.fn().mockResolvedValue(opts.operationalCostLines ?? [])
    }
  } as never;
}

// ── 1. Pure resolveEffectiveMarkup helper ────────────────────────────────

describe("resolveEffectiveMarkup", () => {
  it("waste 1,000 + card override 10% → effective 10% → 1,100", () => {
    // line has no override, card has 10%, tender has 30%
    const effective = resolveEffectiveMarkup(null, 10, 30);
    expect(effective).toBe(10);
    expect(1000 * (1 + effective / 100)).toBe(1100);
  });

  it("waste 1,000 + card 10% + line override 25% → effective 25% → 1,250", () => {
    const effective = resolveEffectiveMarkup(25, 10, 30);
    expect(effective).toBe(25);
    expect(1000 * (1 + effective / 100)).toBe(1250);
  });

  it("stored 0 line override → effective 0% → 1,000 (not inheriting)", () => {
    // 0 is a real override via ??. A stored 0 is NOT treated as absence.
    const effective = resolveEffectiveMarkup(0, 10, 30);
    expect(effective).toBe(0);
    expect(1000 * (1 + effective / 100)).toBe(1000);
  });

  it("cutting uses its own chain (cuttingMarkupOverride)", () => {
    // line override null → falls to cuttingMarkupOverride 15 → NOT card.markupOverride
    const effectiveCutting = resolveEffectiveMarkup(null, 15, 30);
    expect(effectiveCutting).toBe(15);
    // If we had erroneously used card.markupOverride (20) instead of cuttingMarkupOverride:
    const wrongAnswer = resolveEffectiveMarkup(null, 20, 30);
    expect(wrongAnswer).not.toBe(effectiveCutting);
  });
});

// ── 2. SCOPE_LINE_MARKUP_ALL_TYPES_V1 marker exists ─────────────────────

describe("SCOPE_LINE_MARKUP_ALL_TYPES_V1 marker", () => {
  it("is exported from scope-redesign.service", () => {
    expect(SCOPE_LINE_MARKUP_ALL_TYPES_V1).toBe("scopecards-s3");
  });
});

// ── 3. summary() with per-line markup overrides ──────────────────────────

describe("summary() — per-line markup overrides (waste)", () => {
  it("line with card override 10% only (no line override) → 1,100", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: dec(1000),
          markupOverride: null,
          quoteDestination: "PRICE",
          card: { wasteMarkupOverride: dec(10) }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as { waste: { withMarkup: number } };
    expect(result.waste.withMarkup).toBe(1100);
  });

  it("line with line override 25% (card 10%) → 1,250", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: dec(1000),
          markupOverride: dec(25),
          quoteDestination: "PRICE",
          card: { wasteMarkupOverride: dec(10) }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as { waste: { withMarkup: number } };
    expect(result.waste.withMarkup).toBe(1250);
  });

  it("stored 0 line override → 1,000 (0% is a real override)", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: dec(1000),
          markupOverride: dec(0),
          quoteDestination: "PRICE",
          card: { wasteMarkupOverride: dec(10) }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as { waste: { withMarkup: number } };
    expect(result.waste.withMarkup).toBe(1000);
  });
});

describe("summary() — per-line markup overrides (cutting)", () => {
  it("cutting uses cuttingMarkupOverride chain, not card.markupOverride", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      cuttingItems: [
        {
          cardId: "c1",
          lineTotal: dec(1000),
          markupOverride: null,
          quoteDestination: "PRICE",
          card: { cuttingMarkupOverride: dec(10) }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as { cutting: { withMarkup: number } };
    expect(result.cutting.withMarkup).toBe(1100);
  });

  it("cutting line override 25% (cuttingMarkupOverride 10%) → 1,250", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      cuttingItems: [
        {
          cardId: "c1",
          lineTotal: dec(1000),
          markupOverride: dec(25),
          quoteDestination: "PRICE",
          card: { cuttingMarkupOverride: dec(10) }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as { cutting: { withMarkup: number } };
    expect(result.cutting.withMarkup).toBe(1250);
  });
});

// ── 4. Equivalence: no line overrides ≡ old per-card approach ───────────

describe("equivalence — no line overrides gives same total as old per-card approach", () => {
  it("two waste lines, same card, same card override — line-by-line === bucket approach", async () => {
    // Old approach: accumulate subtotal per card, then multiply by factor once.
    // New approach: multiply each line individually.
    // With no line overrides, both give the same result.
    const cardOverride = 15;
    const tenderMarkup = 30;
    const line1 = 400;
    const line2 = 600;

    // New (line-by-line):
    const factor = 1 + cardOverride / 100;
    const newResult = line1 * factor + line2 * factor;

    // Old (per-card bucket):
    const bucketSubtotal = line1 + line2;
    const oldResult = bucketSubtotal * factor;

    expect(newResult).toBe(oldResult); // 1150

    // Confirm via service
    const prisma = makePrisma({
      tenderMarkup,
      wasteItems: [
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: dec(line1),
          markupOverride: null,
          quoteDestination: "PRICE",
          card: { wasteMarkupOverride: dec(cardOverride) }
        },
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: dec(line2),
          markupOverride: null,
          quoteDestination: "PRICE",
          card: { wasteMarkupOverride: dec(cardOverride) }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as { waste: { withMarkup: number } };
    expect(result.waste.withMarkup).toBeCloseTo(newResult, 5);
    expect(result.waste.withMarkup).toBeCloseTo(oldResult, 5);
  });
});

// ── 5. S2a destination buckets still split when a marked-up line is OPTION ──

describe("summary() — destination buckets preserved with per-line markup", () => {
  it("OPTION waste line with markup override stays in option bucket, not PRICE", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: dec(1000),
          markupOverride: dec(25),
          quoteDestination: "OPTION",
          card: { wasteMarkupOverride: null }
        },
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: dec(500),
          markupOverride: null,
          quoteDestination: "PRICE",
          card: { wasteMarkupOverride: null }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as {
      waste: {
        subtotal: number;
        withMarkup: number;
        option: { subtotal: number; withMarkup: number };
      };
    };
    // PRICE line: 500 * 1.30 = 650
    expect(result.waste.withMarkup).toBeCloseTo(650, 5);
    // OPTION line: 1,000 * 1.25 = 1,250
    expect(result.waste.option.subtotal).toBeCloseTo(1000, 5);
    expect(result.waste.option.withMarkup).toBeCloseTo(1250, 5);
  });
});
