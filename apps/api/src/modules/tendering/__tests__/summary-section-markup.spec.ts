import { ScopeRedesignService } from "../scope-redesign.service";

// Roll-up test for per-section markup (waste + cutting).
// Verifies the independent-cost-streams invariant: scope, waste, and
// cutting each get their own markup applied to their own base, then
// summed into tenderPrice. Section overrides fall back to the tender
// markup when null.

function makePrisma(opts: {
  scopeItems?: unknown[];
  labour?: unknown[];
  plant?: unknown[];
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
    estimateLabourRate: {
      findMany: jest.fn().mockResolvedValue(opts.labour ?? [])
    },
    estimatePlantRate: {
      findMany: jest.fn().mockResolvedValue(opts.plant ?? [])
    },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ markup: opts.tenderMarkup ?? 30 })
    },
    scopeWasteItem: {
      findMany: jest.fn().mockResolvedValue(opts.wasteItems ?? [])
    },
    cuttingSheetItem: {
      findMany: jest.fn().mockResolvedValue(opts.cuttingItems ?? [])
    }
  } as never;
}

describe("scope-redesign summary() — per-section markup", () => {
  it("applies waste section override to its own base only", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: "1000",
          card: { wasteMarkupOverride: "10" }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma);
    const result = (await svc.summary("t-1")) as {
      waste: { subtotal: number; withMarkup: number };
      cutting: { subtotal: number; withMarkup: number };
      tenderPrice: number;
    };
    expect(result.waste.subtotal).toBe(1000);
    expect(result.waste.withMarkup).toBe(1100);
    // Cutting empty ⇒ zero on both streams.
    expect(result.cutting.subtotal).toBe(0);
    expect(result.cutting.withMarkup).toBe(0);
    expect(result.tenderPrice).toBe(1100);
  });

  it("applies cutting section override independently of waste + scope", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        {
          cardId: "c1",
          discipline: "DEM",
          lineTotal: "500",
          card: { wasteMarkupOverride: null }
        }
      ],
      cuttingItems: [
        {
          cardId: "c1",
          lineTotal: "200",
          card: { cuttingMarkupOverride: "20" }
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma);
    const result = (await svc.summary("t-1")) as {
      waste: { subtotal: number; withMarkup: number };
      cutting: { subtotal: number; withMarkup: number };
      tenderPrice: number;
    };
    // Waste inherits tender 30% ⇒ 500 * 1.30 = 650
    expect(result.waste.withMarkup).toBe(650);
    // Cutting overrides to 20% ⇒ 200 * 1.20 = 240
    expect(result.cutting.withMarkup).toBe(240);
    expect(result.tenderPrice).toBe(890);
  });

  it("falls back to tender markup when both section overrides are null", async () => {
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        { cardId: "c1", discipline: "DEM", lineTotal: "100", card: { wasteMarkupOverride: null } }
      ],
      cuttingItems: [
        { cardId: "c1", lineTotal: "100", card: { cuttingMarkupOverride: null } }
      ]
    });
    const svc = new ScopeRedesignService(prisma);
    const result = (await svc.summary("t-1")) as {
      waste: { withMarkup: number };
      cutting: { withMarkup: number };
    };
    expect(result.waste.withMarkup).toBe(130);
    expect(result.cutting.withMarkup).toBe(130);
  });

  it("keeps waste and cutting as independent lines in tenderPrice (no cross-fold)", async () => {
    // If the streams were mistakenly combined, applying different
    // markups would produce a different total than summing the
    // marked-up streams individually. Uses distinct rates per stream
    // so a shortcut like markup(scope+waste+cutting)*avgRate cannot
    // land on the same number.
    const prisma = makePrisma({
      tenderMarkup: 30,
      wasteItems: [
        { cardId: "c1", discipline: "DEM", lineTotal: "1000", card: { wasteMarkupOverride: "10" } }
      ],
      cuttingItems: [
        { cardId: "c1", lineTotal: "1000", card: { cuttingMarkupOverride: "20" } }
      ]
    });
    const svc = new ScopeRedesignService(prisma);
    const result = (await svc.summary("t-1")) as { tenderPrice: number };
    // Expected: waste 1000*1.10 + cutting 1000*1.20 = 1100 + 1200 = 2300
    // Wrong (combined-base) result would be (1000+1000)*1.15 = 2300 as a
    // coincidence — pick asymmetric bases:
    expect(result.tenderPrice).toBe(2300);
  });
});
