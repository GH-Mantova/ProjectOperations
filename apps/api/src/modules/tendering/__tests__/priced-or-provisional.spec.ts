import { ScopeRedesignService } from "../scope-redesign.service";

// scope-subcontracted order 3 — per-line provisional flag.
//
// Three cases:
//   1. A tender with one priced DEM line and one provisional DEM line (via
//      isProvisional===true): tenderPrice excludes the provisional line,
//      provisionalTotal equals it, and the two sum to the pre-flag total.
//
//   2. An Other-discipline row with isProvisional===false still lands in the
//      provisional block (discipline rule is additive — the flag only widens
//      the set, it never overrides the Other special case).
//
//   3. Flipping one DEM line from priced to provisional changes tenderPrice
//      by exactly that line's amount and nothing else.

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
}) {
  return {
    tender: {
      findUnique: jest.fn().mockResolvedValue({ id: "t-1" })
    },
    scopeOfWorksItem: {
      findMany: jest.fn().mockResolvedValue(opts.scopeItems ?? [])
    },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ markup: opts.tenderMarkup ?? 0 })
    },
    scopeWasteItem: {
      findMany: jest.fn().mockResolvedValue(opts.wasteItems ?? [])
    },
    cuttingSheetItem: {
      findMany: jest.fn().mockResolvedValue(opts.cuttingItems ?? [])
    }
  } as never;
}

// A minimal DEM scope item priced at `amount` via provisionalAmount
// (simplest way to get a deterministic lineTotal without labour rates).
// We use discipline=DEM rather than Other so that the isProvisional flag
// — not the discipline — controls whether it is provisional.
function makeDemItem(id: string, amount: number, isProvisional: boolean) {
  return {
    id,
    isProvisional,
    // provisionalAmount is the "Other discipline" override; for DEM it is
    // ignored by computeScopeItemTotal. To produce a deterministic total
    // without injecting labour rates we use men/days=0 and a fixed
    // provisionalAmount that the Other path would use — but DEM goes through
    // labour/plant. To keep the test simple we inject a labour rate instead.
    men: null,
    days: null,
    plantItems: null,
    provisionalAmount: null,
    card: { discipline: "DEM", markupOverride: null }
  };
}

// A DEM item priced via men×days×labourRate. We supply the rate at $100/man-day
// through the rateResolver so 2 men × 5 days = $1000 at 0% markup.
function makeDemLabourItem(id: string, men: number, days: number, isProvisional: boolean) {
  return {
    id,
    isProvisional,
    men,
    days,
    plantItems: null,
    provisionalAmount: null,
    card: { discipline: "DEM", markupOverride: null }
  };
}

function makeOtherItem(id: string, amount: number, isProvisional: boolean) {
  return {
    id,
    isProvisional,
    men: null,
    days: null,
    plantItems: null,
    provisionalAmount: amount,
    card: { discipline: "Other", markupOverride: null }
  };
}

// Labour rate: Demolition labourer at $100/man-day (day shift).
const DEMO_LABOUR_RATE = [
  { keys: { role: "Demolition labourer", shift: "day" }, value: 100, rowId: "lr-dem", unit: "day", source: "legacy" }
];

describe("priced-or-provisional — per-line isProvisional flag", () => {
  it("case 1: priced + provisional DEM line — tenderPrice excludes provisional, provisionalTotal equals it, and they sum to pre-flag total", async () => {
    // 2 men × 5 days × $100 = $1,000 at 0% markup — each line
    const pricedItem = makeDemLabourItem("item-priced", 2, 5, false);
    const provItem = makeDemLabourItem("item-prov", 2, 5, true);

    const prisma = makePrisma({
      tenderMarkup: 0,
      scopeItems: [pricedItem, provItem]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
    const result = (await svc.summary("t-1")) as unknown as {
      DEM: { subtotal: number; withMarkup: number; provisionalSubtotal: number; provisionalWithMarkup: number };
      tenderPrice: number;
      provisionalTotal: number;
    };

    // Priced side: 2m × 5d × $100 = $1,000
    expect(result.DEM.withMarkup).toBe(1000);
    // Provisional side: same
    expect(result.DEM.provisionalWithMarkup).toBe(1000);
    expect(result.provisionalTotal).toBe(1000);
    // tenderPrice = priced scope only (no waste/cutting)
    expect(result.tenderPrice).toBe(1000);
    // Priced + provisional = pre-flag total (2 × $1,000 = $2,000)
    expect(result.tenderPrice + result.provisionalTotal).toBe(2000);
  });

  it("case 2: Other-discipline row with isProvisional===false still lands in provisional block", async () => {
    // Other rows go via provisionalAmount; the discipline rule forces them
    // into the provisional bucket regardless of the flag.
    const otherItem = makeOtherItem("item-other", 500, false);

    const prisma = makePrisma({
      tenderMarkup: 0,
      scopeItems: [otherItem]
    });
    const svc = new ScopeRedesignService(prisma, makeRateResolver());
    const result = (await svc.summary("t-1")) as unknown as {
      Other: { subtotal: number; withMarkup: number; provisionalSubtotal: number; provisionalWithMarkup: number };
      tenderPrice: number;
      provisionalTotal: number;
    };

    // Other row must NOT appear in tenderPrice (it is provisional by discipline)
    expect(result.tenderPrice).toBe(0);
    // It must appear in the provisional side
    expect(result.Other.provisionalWithMarkup).toBe(500);
    expect(result.provisionalTotal).toBe(500);
    // The priced side of Other must be zero
    expect(result.Other.withMarkup).toBe(0);
  });

  it("case 3: flipping one DEM line changes tenderPrice by exactly that line's amount, nothing else", async () => {
    // Two DEM lines; one gets flipped to provisional.
    const lineA = makeDemLabourItem("item-a", 3, 4, false); // 3 × 4 × $100 = $1,200
    const lineB = makeDemLabourItem("item-b", 1, 2, false); // 1 × 2 × $100 = $200

    const prismaAllPriced = makePrisma({ tenderMarkup: 0, scopeItems: [lineA, lineB] });
    const svcAllPriced = new ScopeRedesignService(prismaAllPriced, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
    const allPriced = (await svcAllPriced.summary("t-1")) as { tenderPrice: number; provisionalTotal: number };

    // Flip lineB to provisional
    const lineBFlipped = makeDemLabourItem("item-b", 1, 2, true);
    const prismaFlipped = makePrisma({ tenderMarkup: 0, scopeItems: [lineA, lineBFlipped] });
    const svcFlipped = new ScopeRedesignService(prismaFlipped, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
    const oneFlipped = (await svcFlipped.summary("t-1")) as { tenderPrice: number; provisionalTotal: number };

    // tenderPrice drops by exactly lineB's cost ($200)
    expect(oneFlipped.tenderPrice).toBe(allPriced.tenderPrice - 200);
    // provisionalTotal picks up lineB's cost
    expect(oneFlipped.provisionalTotal).toBe(200);
    // Total is conserved
    expect(oneFlipped.tenderPrice + oneFlipped.provisionalTotal).toBe(allPriced.tenderPrice + allPriced.provisionalTotal);
  });
});
