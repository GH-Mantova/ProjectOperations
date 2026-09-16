// SCOPE_QUOTE_DESTINATION_V1 (scopecards-s2a) -- quote-destination spec.
//
// Tests that quoteDestination drives where money lands in summary().
// Style: mocked Prisma, no DB (same as priced-or-provisional.spec.ts).
//
// Key acceptance cases:
//   A. A card with a $48,000 SUB line (selected quote) and $41,000 of
//      in-house lines shows tenderPrice 89,000 when all lines are PRICE,
//      and 48,000 when the in-house lines are INTERNAL.
//      internalTotal is 41,000 in the second case.
//   B. A covered item (pricedBySubItemId set) with destination PRICE prices
//      normally -- Rule A is gone.
//   C. Flipping one line PRICE -> OPTION moves tenderPrice by exactly that
//      line's amount and optionsTotal by the same.
//   D. A PROVISIONAL waste line lands in provisionalTotal and NOT in
//      waste.withMarkup (the PRICE-side subtotal).
//   E. An OPTION cutting line lands in optionsTotal only.
//   F. An INTERNAL operational-cost line lands in internalTotal only.
//   G. All four streams' PRICE sides are byte-identical to S1's figures
//      when every line is PRICE.

import { Prisma } from "@prisma/client";
import { ScopeRedesignService } from "../scope-redesign.service";

// Labour rate: Demolition labourer $100/man-day (day shift).
const DEMO_LABOUR_RATE = [
  { keys: { role: "Demolition labourer", shift: "day" }, value: 100, rowId: "lr-dem", unit: "day", source: "legacy" }
];

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
  operationalLines?: unknown[];
}) {
  return {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
    scopeOfWorksItem: { findMany: jest.fn().mockResolvedValue(opts.scopeItems ?? []) },
    tenderEstimate: { findUnique: jest.fn().mockResolvedValue({ markup: opts.tenderMarkup ?? 0 }) },
    scopeOperationalCostLine: { findMany: jest.fn().mockResolvedValue(opts.operationalLines ?? []) },
    scopeWasteItem: { findMany: jest.fn().mockResolvedValue(opts.wasteItems ?? []) },
    cuttingSheetItem: { findMany: jest.fn().mockResolvedValue(opts.cuttingItems ?? []) }
  } as never;
}

// A DEM item priced at men x days x $100 with the given destination.
function makeDemLabourItem(id: string, men: number, days: number, quoteDestination = "PRICE") {
  return {
    id,
    quoteDestination,
    isProvisional: false,
    men,
    days,
    plantItems: null,
    provisionalAmount: null,
    subLineQuotes: [],
    card: { discipline: "DEM", markupOverride: null }
  };
}

// A SUB item priced at the given quote amount.
function makeSubItem(id: string, quoteAmount: number, quoteDestination = "PRICE") {
  return {
    id,
    quoteDestination,
    isProvisional: false,
    men: null,
    days: null,
    plantItems: null,
    provisionalAmount: null,
    subLineQuotes: [{ amount: new Prisma.Decimal(quoteAmount) }],
    card: { discipline: "SUB", markupOverride: null }
  };
}

describe("SCOPE_QUOTE_DESTINATION_V1 -- quote destination routing in summary()", () => {
  describe("Case A: $48,000 SUB + $41,000 in-house", () => {
    // SUB quote at $48,000 (0% markup), in-house DEM 2men x 5days x $100 x 41 = not quite.
    // Let's use: SUB=$48,000 (single quote), in-house items total $41,000.
    // 41 men x 1 day x $100 = $41,000.
    const subItem = makeSubItem("sub-1", 48_000);
    const inHouseItem = makeDemLabourItem("dem-1", 41, 10, "PRICE"); // 41 men x 10 days x $100 = $41,000

    it("tenderPrice is 89,000 when all lines are PRICE", async () => {
      const prisma = makePrisma({
        tenderMarkup: 0,
        scopeItems: [inHouseItem, subItem]
      });
      const svc = new ScopeRedesignService(prisma, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
      const result = await svc.summary("t-1") as unknown as {
        tenderPrice: number; optionsTotal: number; internalTotal: number; provisionalTotal: number;
      };
      expect(result.tenderPrice).toBe(89_000);
      expect(result.optionsTotal).toBe(0);
      expect(result.internalTotal).toBe(0);
    });

    it("tenderPrice is 48,000 when in-house lines are INTERNAL; internalTotal is 41,000", async () => {
      const internalItem = makeDemLabourItem("dem-1", 41, 10, "INTERNAL");
      const prisma = makePrisma({
        tenderMarkup: 0,
        scopeItems: [internalItem, subItem]
      });
      const svc = new ScopeRedesignService(prisma, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
      const result = await svc.summary("t-1") as unknown as {
        tenderPrice: number; internalTotal: number;
      };
      expect(result.tenderPrice).toBe(48_000);
      expect(result.internalTotal).toBe(41_000);
    });
  });

  describe("Case B: covered item (pricedBySubItemId set) with PRICE destination prices normally -- Rule A gone", () => {
    it("covered item contributes its full labour to tenderPrice", async () => {
      const coveredItem = {
        id: "covered-1",
        quoteDestination: "PRICE",
        isProvisional: false,
        pricedBySubItemId: "sub-1",
        men: 2,
        days: 5,
        plantItems: null,
        provisionalAmount: null,
        subLineQuotes: [],
        card: { discipline: "DEM", markupOverride: null }
      };
      const prisma = makePrisma({
        tenderMarkup: 0,
        scopeItems: [coveredItem]
      });
      const svc = new ScopeRedesignService(prisma, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
      const result = await svc.summary("t-1") as unknown as { tenderPrice: number };
      // 2 men x 5 days x $100 = $1,000
      expect(result.tenderPrice).toBe(1_000);
    });
  });

  describe("Case C: PRICE -> OPTION flip", () => {
    it("flipping one DEM line to OPTION moves tenderPrice and optionsTotal by exactly that amount", async () => {
      const lineA = makeDemLabourItem("item-a", 3, 4, "PRICE"); // 3x4x$100 = $1,200
      const lineB = makeDemLabourItem("item-b", 1, 2, "PRICE"); // 1x2x$100 = $200

      const prismaAllPrice = makePrisma({ tenderMarkup: 0, scopeItems: [lineA, lineB] });
      const svcAllPrice = new ScopeRedesignService(prismaAllPrice, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
      const allPrice = await svcAllPrice.summary("t-1") as unknown as { tenderPrice: number; optionsTotal: number };

      const lineBOption = makeDemLabourItem("item-b", 1, 2, "OPTION");
      const prismaOption = makePrisma({ tenderMarkup: 0, scopeItems: [lineA, lineBOption] });
      const svcOption = new ScopeRedesignService(prismaOption, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
      const withOption = await svcOption.summary("t-1") as unknown as { tenderPrice: number; optionsTotal: number };

      expect(withOption.tenderPrice).toBe(allPrice.tenderPrice - 200);
      expect(withOption.optionsTotal).toBe(200);
    });
  });

  describe("Case D: PROVISIONAL waste line", () => {
    it("a PROVISIONAL waste line lands in provisionalTotal and not in waste.withMarkup", async () => {
      const wasteItem = {
        cardId: "card-1",
        discipline: "DEM",
        lineTotal: new Prisma.Decimal(500),
        quoteDestination: "PROVISIONAL",
        card: { wasteMarkupOverride: null }
      };
      const prisma = makePrisma({ tenderMarkup: 0, wasteItems: [wasteItem] });
      const svc = new ScopeRedesignService(prisma, makeRateResolver());
      const result = await svc.summary("t-1") as unknown as {
        tenderPrice: number;
        provisionalTotal: number;
        waste: { withMarkup: number; provisional: { withMarkup: number } };
      };
      expect(result.tenderPrice).toBe(0);
      expect(result.provisionalTotal).toBe(500);
      expect(result.waste.withMarkup).toBe(0);
      expect(result.waste.provisional.withMarkup).toBe(500);
    });
  });

  describe("Case E: OPTION cutting line", () => {
    it("an OPTION cutting line lands in optionsTotal only", async () => {
      const cuttingItem = {
        cardId: "card-1",
        lineTotal: new Prisma.Decimal(300),
        quoteDestination: "OPTION",
        card: { cuttingMarkupOverride: null }
      };
      const prisma = makePrisma({ tenderMarkup: 0, cuttingItems: [cuttingItem] });
      const svc = new ScopeRedesignService(prisma, makeRateResolver());
      const result = await svc.summary("t-1") as unknown as {
        tenderPrice: number;
        optionsTotal: number;
        cutting: { withMarkup: number; option: { withMarkup: number } };
      };
      expect(result.tenderPrice).toBe(0);
      expect(result.optionsTotal).toBe(300);
      expect(result.cutting.withMarkup).toBe(0);
      expect(result.cutting.option.withMarkup).toBe(300);
    });
  });

  describe("Case F: INTERNAL operational-cost line", () => {
    it("an INTERNAL operational-cost line lands in internalTotal only", async () => {
      const opLine = {
        cardId: "card-1",
        qty: new Prisma.Decimal(1),
        unit: "day",
        days: new Prisma.Decimal(1),
        rate: new Prisma.Decimal(700),
        rateOverride: null,
        markupOverride: null,
        quoteDestination: "INTERNAL",
        card: { markupOverride: null }
      };
      const prisma = makePrisma({ tenderMarkup: 0, operationalLines: [opLine] });
      const svc = new ScopeRedesignService(prisma, makeRateResolver());
      const result = await svc.summary("t-1") as unknown as {
        tenderPrice: number;
        internalTotal: number;
        operationalCosts: { withMarkup: number; internal: { withMarkup: number } };
      };
      expect(result.tenderPrice).toBe(0);
      expect(result.internalTotal).toBe(700);
      expect(result.operationalCosts.withMarkup).toBe(0);
      expect(result.operationalCosts.internal.withMarkup).toBe(700);
    });
  });

  describe("Case G: all PRICE -- byte-identical to S1 figures", () => {
    it("with all lines PRICE the four PRICE-side streams match what S1 produced", async () => {
      const demItem = makeDemLabourItem("item-1", 2, 5, "PRICE"); // 2x5x$100 = $1,000
      const wasteItem = {
        cardId: "card-1",
        discipline: "DEM",
        lineTotal: new Prisma.Decimal(200),
        quoteDestination: "PRICE",
        card: { wasteMarkupOverride: null }
      };
      const cuttingItem = {
        cardId: "card-1",
        lineTotal: new Prisma.Decimal(100),
        quoteDestination: "PRICE",
        card: { cuttingMarkupOverride: null }
      };
      const opLine = {
        cardId: "card-1",
        qty: new Prisma.Decimal(1),
        unit: "day",
        days: new Prisma.Decimal(1),
        rate: new Prisma.Decimal(50),
        rateOverride: null,
        markupOverride: null,
        quoteDestination: "PRICE",
        card: { markupOverride: null }
      };
      const prisma = makePrisma({
        tenderMarkup: 0,
        scopeItems: [demItem],
        wasteItems: [wasteItem],
        cuttingItems: [cuttingItem],
        operationalLines: [opLine]
      });
      const svc = new ScopeRedesignService(prisma, makeRateResolver({ labour: DEMO_LABOUR_RATE }));
      const result = await svc.summary("t-1") as unknown as {
        tenderPrice: number;
        provisionalTotal: number;
        optionsTotal: number;
        internalTotal: number;
      };
      // $1,000 scope + $200 waste + $100 cutting + $50 op = $1,350
      expect(result.tenderPrice).toBe(1_350);
      expect(result.provisionalTotal).toBe(0);
      expect(result.optionsTotal).toBe(0);
      expect(result.internalTotal).toBe(0);
    });
  });
});
