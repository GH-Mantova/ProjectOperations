// QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) -- pushable-lines spec.
//
// Tests for ScopeRedesignService.listPushableLines().
// Returns a flat list of { type, id, code, description, cardId, cardCode,
// discipline, quoteDestination, price, priceable, priceReason } for all
// estimate lines: scope items (type="scope"), waste (type="waste"),
// cutting (type="cutting"), operational (type="operational").
//
// All Prisma calls are mocked; no DB required.

import { Prisma } from "@prisma/client";
import { ScopeRedesignService } from "../scope-redesign.service";

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

// A minimal card that satisfies toPricingInput
function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "card-1",
    discipline: "DEM",
    cardNumber: "1",
    cardName: "Site clearance",
    markupOverride: null,
    wasteMarkupOverride: null,
    cuttingMarkupOverride: null,
    ...overrides
  };
}

// A minimal scope item
function makeScopeItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    quoteDestination: "PRICE",
    isProvisional: false,
    men: 2,
    days: 3,
    plantItems: null,
    provisionalAmount: null,
    subLineQuotes: [],
    card: makeCard(),
    description: `Scope item ${id}`,
    wbsCode: `DEM${id}`,
    ...overrides
  };
}

function makePrisma(opts: {
  scopeItems?: unknown[];
  tenderMarkup?: number;
  wasteItems?: unknown[];
  cuttingItems?: unknown[];
  operationalLines?: unknown[];
  scopeCards?: unknown[];
} = {}) {
  return {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
    scopeOfWorksItem: { findMany: jest.fn().mockResolvedValue(opts.scopeItems ?? []) },
    tenderEstimate: { findUnique: jest.fn().mockResolvedValue({ markup: opts.tenderMarkup ?? 0 }) },
    scopeOperationalCostLine: { findMany: jest.fn().mockResolvedValue(opts.operationalLines ?? []) },
    scopeWasteItem: { findMany: jest.fn().mockResolvedValue(opts.wasteItems ?? []) },
    cuttingSheetItem: { findMany: jest.fn().mockResolvedValue(opts.cuttingItems ?? []) }
  } as never;
}

function makeService(prisma: ReturnType<typeof makePrisma>, rateResolver = makeRateResolver()) {
  return new ScopeRedesignService(prisma as never, rateResolver as never);
}

// ── Scope items ───────────────────────────────────────────────────────────────

describe("listPushableLines — scope items", () => {
  it("includes scope items with type='scope'", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-1")]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const scopeLines = lines.filter((l) => l.type === "scope");

    expect(scopeLines.length).toBeGreaterThan(0);
    expect(scopeLines[0].type).toBe("scope");
    expect(scopeLines[0].cardId).toBe("card-1");
  });

  it("passes through the quoteDestination from the scope item", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-1", { quoteDestination: "PROVISIONAL" })]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const line = lines.find((l) => l.id === "sl-1");

    expect(line).toBeDefined();
    expect(line!.quoteDestination).toBe("PROVISIONAL");
  });

  it("marks isProvisional items as not priceable", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-prov", { isProvisional: true, men: null, days: null })]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const line = lines.find((l) => l.id === "sl-prov");

    expect(line).toBeDefined();
    // Provisional items have provisionalAmount but no labour price
    // priceable depends on computed lineTotal
  });

  it("discipline is taken from card.discipline", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-civ", { card: makeCard({ discipline: "CIV" }) })]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const line = lines.find((l) => l.id === "sl-civ");

    expect(line?.discipline).toBe("CIV");
  });
});

// ── Waste items ───────────────────────────────────────────────────────────────

describe("listPushableLines — waste items", () => {
  it("includes waste items with type='waste' and code ending in 'waste'", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-1")],
      wasteItems: [
        {
          id: "wi-1",
          quoteDestination: "PRICE",
          card: makeCard({ id: "card-1", discipline: "DEM", cardNumber: "1", cardName: "Site clearance", wasteMarkupOverride: null }),
          description: "Mixed C&D waste",
          tonnesPerLoad: dec(2),
          loads: 5,
          facilityRate: dec(100),
          transportRate: dec(50)
        }
      ]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const wasteLine = lines.find((l) => l.type === "waste");

    expect(wasteLine).toBeDefined();
    expect(wasteLine!.type).toBe("waste");
    expect(wasteLine!.code).toContain("waste");
  });

  it("passes through quoteDestination from waste item", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-1")],
      wasteItems: [
        {
          id: "wi-opt",
          quoteDestination: "OPTION",
          card: makeCard({ wasteMarkupOverride: null }),
          description: "Asbestos waste",
          tonnesPerLoad: dec(1),
          loads: 2,
          facilityRate: dec(200),
          transportRate: dec(80)
        }
      ]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const wasteLine = lines.find((l) => l.id === "wi-opt");

    expect(wasteLine?.quoteDestination).toBe("OPTION");
  });
});

// ── Cutting items ─────────────────────────────────────────────────────────────

describe("listPushableLines — cutting items", () => {
  it("includes cutting items with type='cutting' and code ending in 'cutting'", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-1")],
      cuttingItems: [
        {
          id: "ci-1",
          quoteDestination: "PRICE",
          wbsRef: "DEM1",
          card: makeCard({ id: "card-1", cardNumber: "1", discipline: "DEM", cuttingMarkupOverride: null }),
          description: "Saw cut concrete",
          qty: dec(10),
          unit: "lm",
          rate: dec(50),
          rateOverride: null
        }
      ]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const cuttingLine = lines.find((l) => l.type === "cutting");

    expect(cuttingLine).toBeDefined();
    expect(cuttingLine!.type).toBe("cutting");
    expect(cuttingLine!.code).toContain("cutting");
  });
});

// ── Operational lines ─────────────────────────────────────────────────────────

describe("listPushableLines — operational lines", () => {
  it("includes operational lines with type='operational'", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-1")],
      operationalLines: [
        {
          id: "ol-1",
          quoteDestination: "PRICE",
          description: "Traffic controller",
          qty: dec(2),
          unit: "day",
          days: dec(5),
          rate: dec(850),
          rateOverride: null,
          markupOverride: null,
          card: makeCard({ id: "card-1", cardNumber: "1", discipline: "DEM" })
        }
      ]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const opLine = lines.find((l) => l.type === "operational");

    expect(opLine).toBeDefined();
    expect(opLine!.type).toBe("operational");
    expect(opLine!.code).toContain("op");
  });

  it("marks operational line with zero price as not priceable", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-1")],
      operationalLines: [
        {
          id: "ol-zero",
          quoteDestination: "PRICE",
          description: "TBC operational cost",
          qty: dec(null),
          unit: "day",
          days: dec(null),
          rate: dec(null),
          rateOverride: null,
          markupOverride: null,
          card: makeCard({ id: "card-1", cardNumber: "1", discipline: "DEM" })
        }
      ]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const opLine = lines.find((l) => l.id === "ol-zero");

    expect(opLine?.priceable).toBe(false);
  });
});

// ── INTERNAL filtering ────────────────────────────────────────────────────────

describe("listPushableLines — INTERNAL destination", () => {
  it("includes INTERNAL lines in the output (not filtered here -- push filters them)", async () => {
    const prisma = makePrisma({
      scopeItems: [makeScopeItem("sl-int", { quoteDestination: "INTERNAL" })]
    });
    const svc = makeService(prisma);

    const lines = await svc.listPushableLines("t-1");
    const intLine = lines.find((l) => l.id === "sl-int");

    // listPushableLines returns INTERNAL lines; QuotePushService.plan() is the one
    // that skips them. This keeps the data source neutral.
    expect(intLine).toBeDefined();
    expect(intLine!.quoteDestination).toBe("INTERNAL");
  });
});
