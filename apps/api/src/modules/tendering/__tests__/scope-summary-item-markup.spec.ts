// CARD-PERSIST SLICE 4 — the tender summary must resolve markup over the
// SAME three links the scope screen does.
//
// Before this slice, summary() inlined a two-link chain
// (`card.markupOverride ?? tenderMarkup`) and never looked at
// item.markupOverride, while listItems() in scope-of-works.service.ts went
// through resolveEffectiveMarkup() — three links. Once SLICE 3
// (SCOPE_ITEM_MARKUP_PERSIST_V1) let an estimator save a per-item override,
// the two screens showed different money for the same work.
//
// These specs pin all four resolution cases on the summary side, and then
// pin the thing that is actually the point of the slice: for one seeded item
// carrying an override, the discipline bucket's `withMarkup` and the item's
// own `lineTotalWithMarkup` are COMPUTED by the two real services and
// asserted to agree — not compared against a literal, which would still pass
// if both were wrong in the same direction.

import { ScopeRedesignService } from "../scope-redesign.service";
import { ScopeOfWorksService } from "../scope-of-works.service";

// ── Rates ─────────────────────────────────────────────────────────────
// One labour role at a known day rate, so every seeded item below has a
// base of men x days x rate = 2 x 3 x 400 = 2400 before markup. Nothing
// here varies between tests: only the markup chain does.
const DEM_DAY_RATE = 400;
const BASE_LINE_TOTAL = 2400;

const LABOUR_LISTED = [
  {
    rowId: "lr-1",
    keys: { role: "Demolition labourer", shift: "day" },
    value: DEM_DAY_RATE,
    unit: "day",
    source: "legacy"
  }
];

// rates-consumers SLICE 2 — both services read rates through
// RateResolverService.listRates, not Prisma. Same stub for both.
function makeRateResolver() {
  return {
    listRates: jest.fn(async (slug: string) => {
      if (slug === "labour") return LABOUR_LISTED;
      if (slug === "plant") return [];
      return [];
    }),
    resolveRate: jest.fn()
  } as never;
}

// ── The seeded row ────────────────────────────────────────────────────
// One DEM item, priced from the men/days scalars (labourItems null, so the
// scalar fallback applies). Deliberately NOT provisional, NOT SUB, and NOT
// covered by a SUB line, so it takes the plain computeScopeItemTotal branch
// and the double-count guard is untouched.
//
// markupOverride / cardMarkupOverride are passed as strings, the way a
// Prisma Decimal arrives on the row — including "0", which is the case that
// separates `??` from `||`.
function makeItem(opts: {
  markupOverride?: string | null;
  cardMarkupOverride?: string | null;
}) {
  return {
    id: "si-1",
    tenderId: "t-1",
    itemNumber: 1,
    sortOrder: 0,
    status: "confirmed",
    description: "Strip out ground floor",
    men: "2",
    days: "3",
    shift: "Day",
    plantItems: null,
    labourItems: null,
    provisionalAmount: null,
    isProvisional: false,
    pricedBySubItemId: null,
    markupOverride: opts.markupOverride ?? null,
    card: {
      id: "card-1",
      discipline: "DEM",
      markupOverride: opts.cardMarkupOverride ?? null
    },
    // scope-subcontracted order 4 — summary() includes selected sub-line
    // quotes. Empty for a non-SUB row.
    subLineQuotes: []
  };
}

// ── Prisma stubs ──────────────────────────────────────────────────────
// summary() reads: tender, scopeOfWorksItem, tenderEstimate, cuttingSheetItem,
// scopeWasteItem. Cutting and waste are left empty on purpose — this slice
// has no opinion about those streams.
function makeSummaryPrisma(opts: { items: unknown[]; tenderMarkup: number }) {
  return {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
    scopeOfWorksItem: { findMany: jest.fn().mockResolvedValue(opts.items) },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ markup: opts.tenderMarkup })
    },
    cuttingSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    scopeWasteItem: { findMany: jest.fn().mockResolvedValue([]) }
  } as never;
}

// listItems() reads: tender, scopeOfWorksItem, tenderEstimate.
function makeListPrisma(opts: { items: unknown[]; tenderMarkup: number }) {
  return {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
    scopeOfWorksItem: { findMany: jest.fn().mockResolvedValue(opts.items) },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ markup: opts.tenderMarkup })
    }
  } as never;
}

type Bucket = { itemCount: number; subtotal: number; withMarkup: number };

/** Run summary() over one seeded item and hand back its DEM bucket. */
async function demBucket(opts: {
  markupOverride?: string | null;
  cardMarkupOverride?: string | null;
  tenderMarkup: number;
}): Promise<Bucket> {
  const prisma = makeSummaryPrisma({
    items: [makeItem(opts)],
    tenderMarkup: opts.tenderMarkup
  });
  const svc = new ScopeRedesignService(prisma, makeRateResolver());
  const result = (await svc.summary("t-1")) as unknown as Record<string, Bucket>;
  return result["DEM"];
}

/** Run listItems() over the SAME seeded item and hand back its row totals. */
async function listedItem(opts: {
  markupOverride?: string | null;
  cardMarkupOverride?: string | null;
  tenderMarkup: number;
}): Promise<{ lineTotal: number; lineTotalWithMarkup: number }> {
  const prisma = makeListPrisma({
    items: [makeItem(opts)],
    tenderMarkup: opts.tenderMarkup
  });
  const svc = new ScopeOfWorksService(prisma, makeRateResolver());
  const result = (await svc.listItems("t-1")) as unknown as {
    items: Array<{ lineTotal: number; lineTotalWithMarkup: number }>;
  };
  return result.items[0];
}

describe("scope-redesign summary() — item markup override (CARD-PERSIST SLICE 4)", () => {
  it("uses the ITEM override when it is set, over both the card and the tender", async () => {
    // item 50 / card 30 / tender 8 -> 50.
    // Before this slice the two-link chain read the card and returned 30,
    // which would have been 2400 * 1.30 = 3120.
    const bucket = await demBucket({
      markupOverride: "50",
      cardMarkupOverride: "30",
      tenderMarkup: 8
    });
    expect(bucket.subtotal).toBe(BASE_LINE_TOTAL);
    expect(bucket.withMarkup).toBe(3600);
    expect(bucket.withMarkup).not.toBe(3120); // the pre-slice, card-only answer
  });

  it("treats a stored 0 as a real 0% override, not as an absence", async () => {
    // item 0 / card 30 / tender 8 -> 0. This is the case `||` gets wrong
    // (it would fall through to the card's 30) and `??` gets right, and it
    // is the reason resolveEffectiveMarkup exists at all.
    const bucket = await demBucket({
      markupOverride: "0",
      cardMarkupOverride: "30",
      tenderMarkup: 8
    });
    expect(bucket.subtotal).toBe(BASE_LINE_TOTAL);
    expect(bucket.withMarkup).toBe(2400); // 2400 * 1.00 — no markup at all
    expect(bucket.withMarkup).not.toBe(3120); // what `||` would have produced
  });

  it("falls back to the CARD override when the item has none", async () => {
    // item null / card 30 / tender 8 -> 30. Unchanged behaviour: the
    // regression guard for every row written before the column existed.
    const bucket = await demBucket({
      markupOverride: null,
      cardMarkupOverride: "30",
      tenderMarkup: 8
    });
    expect(bucket.withMarkup).toBe(3120); // 2400 * 1.30
  });

  it("falls back to the TENDER markup when neither item nor card overrides", async () => {
    // item null / card null / tender 8 -> 8.
    const bucket = await demBucket({
      markupOverride: null,
      cardMarkupOverride: null,
      tenderMarkup: 8
    });
    expect(bucket.withMarkup).toBe(2592); // 2400 * 1.08
  });
});

describe("summary() and listItems() agree on the same item (the point of the slice)", () => {
  it("bucket withMarkup equals the item's lineTotalWithMarkup for an item-level override", async () => {
    // ONE seeded row, read by BOTH services. Both figures are computed here;
    // neither is compared to a number typed into the test, so the assertion
    // is "these two agree" rather than "both happen to equal 3600".
    const seed = {
      markupOverride: "50",
      cardMarkupOverride: "30",
      tenderMarkup: 8
    };

    const [bucket, item] = await Promise.all([demBucket(seed), listedItem(seed)]);

    expect(bucket.itemCount).toBe(1);
    expect(bucket.subtotal).toBeCloseTo(item.lineTotal, 6);
    expect(bucket.withMarkup).toBeCloseTo(item.lineTotalWithMarkup, 6);
    // And neither side quietly resolved to the card's 30 or the tender's 8.
    expect(bucket.withMarkup).toBeGreaterThan(item.lineTotal);
  });

  it("agrees on every link of the chain, including the stored zero", async () => {
    const seeds = [
      { markupOverride: "50", cardMarkupOverride: "30", tenderMarkup: 8 },
      { markupOverride: "0", cardMarkupOverride: "30", tenderMarkup: 8 },
      { markupOverride: null, cardMarkupOverride: "30", tenderMarkup: 8 },
      { markupOverride: null, cardMarkupOverride: null, tenderMarkup: 8 }
    ];

    for (const seed of seeds) {
      const bucket = await demBucket(seed);
      const item = await listedItem(seed);
      expect(bucket.subtotal).toBeCloseTo(item.lineTotal, 6);
      expect(bucket.withMarkup).toBeCloseTo(item.lineTotalWithMarkup, 6);
    }
  });
});
