// CARD-API SLICE 1 — SCOPE_ITEM_LABOUR_STORE_V1
//
// Pins the pricing and persistence behaviour of the two new nullable
// columns on ScopeOfWorksItem (labour_items JSONB, markup_override
// DECIMAL(5,2)) added by migration 20260905000000_scope_item_labour_store.
//
// The load-bearing claim this file exists to PROVE rather than assert:
// every row that existed before the migration reads both columns NULL,
// takes the fallback path, and prices to exactly the number it priced
// before. There is no backfill, and this is what makes one unnecessary.
//
// No Prisma, no DB — the pricing helpers are pure and the service tests
// drive a hand-rolled prisma mock (same pattern as
// scope-update-item-preserve.spec.ts).

import { Prisma } from "@prisma/client";
import {
  buildRateMaps,
  computeScopeItemTotal,
  DEFAULT_ROLE_BY_DISCIPLINE,
  hasLabourRows,
  labourCrewAndDaysForItem,
  labourRateForRow,
  labourRateForShift,
  resolveEffectiveMarkup,
  type RateMaps,
  type ScopeItemPricingInput
} from "../scope-item-pricing";
import { ScopeOfWorksService } from "../scope-of-works.service";

// ── Rate fixture ─────────────────────────────────────────────────────
//
// Deliberately the REAL seeded rates from prisma/seed-initial-services.ts
// (seedEstimateRates), so the numbers below are numbers a human can go
// and check against the seed rather than invented ones:
//   Demolition labourer   day 600  night 1000  weekend 900
//   Demolition supervisor day 600  night 1000  weekend 900
//   Machine operator      day 600  night 1000  weekend 900
//   Project manager       day 850  night 1400  weekend 1200
// "Demolition labourer" is DEFAULT_ROLE_BY_DISCIPLINE.DEM, i.e. the role
// the legacy scalar path uses for a DEM row.
const SEED_LABOUR_ROWS = [
  { role: "Demolition labourer", shift: "day", rate: new Prisma.Decimal("600") },
  { role: "Demolition labourer", shift: "night", rate: new Prisma.Decimal("1000") },
  { role: "Demolition labourer", shift: "weekend", rate: new Prisma.Decimal("900") },
  { role: "Demolition supervisor", shift: "day", rate: new Prisma.Decimal("600") },
  { role: "Demolition supervisor", shift: "night", rate: new Prisma.Decimal("1000") },
  { role: "Demolition supervisor", shift: "weekend", rate: new Prisma.Decimal("900") },
  { role: "Machine operator", shift: "day", rate: new Prisma.Decimal("600") },
  { role: "Machine operator", shift: "night", rate: new Prisma.Decimal("1000") },
  { role: "Project manager", shift: "day", rate: new Prisma.Decimal("850") },
  { role: "Project manager", shift: "night", rate: new Prisma.Decimal("1400") }
];

const SEED_PLANT_ROWS = [
  { id: "plant-excavator", rate: new Prisma.Decimal("650") },
  { id: "plant-bobcat", rate: new Prisma.Decimal("450") }
];

const rates = (): RateMaps => buildRateMaps(SEED_LABOUR_ROWS, SEED_PLANT_ROWS);

const item = (overrides: Partial<ScopeItemPricingInput> = {}): ScopeItemPricingInput => ({
  discipline: "DEM",
  men: null,
  days: null,
  shift: null,
  plantItems: null,
  labourItems: null,
  provisionalAmount: null,
  ...overrides
});

// ─────────────────────────────────────────────────────────────────────
// 1. THE NO-CHANGE PROOF
// ─────────────────────────────────────────────────────────────────────

describe("SCOPE_ITEM_LABOUR_STORE_V1 — existing rows price identically (no backfill needed)", () => {
  // A REAL existing item, copied field-for-field out of prisma/seed.ts:
  // BGS tender, card DEM, wbsCode "DEM1.1",
  // "Strip-out internal partitions, ceilings, and joinery to Level 1",
  // men = 4, days = 5, shift = "DAY".
  // After the migration this row reads labourItems = NULL and
  // markupOverride = NULL, exactly like every other pre-existing row.
  const DEM1_1 = () =>
    item({
      discipline: "DEM",
      men: 4,
      days: 5,
      shift: "DAY",
      labourItems: null,
      markupOverride: null
    });

  it("DEM1.1 prices to the same labour total before and after the change", () => {
    // "Before": the legacy formula, written out literally —
    //   men × days × labourRateForShift(discipline-default role, shift)
    // labourRateForShift is untouched by this slice, so this expression
    // is the pre-change behaviour reproduced in the test itself.
    const before = 4 * 5 * labourRateForShift("DEM", "DAY", rates());

    // "After": the shipped function, with the new columns NULL.
    const after = computeScopeItemTotal(DEM1_1(), rates(), 30);

    // 4 men × 5 days × $600/day (Demolition labourer, day) = $12,000.
    expect(before).toBe(12000);
    expect(after.labour).toBe(12000);
    expect(after.lineTotal).toBe(12000);
    expect(after.lineTotal).toBe(before);
    // 30% tender markup → $15,600.
    expect(after.lineTotalWithMarkup).toBeCloseTo(15600, 6);
  });

  it("an EMPTY labourItems array is still a fallback, not a zero", () => {
    // [] means "no labour rows", not "labour is zero". A row saved by a
    // client that shipped an empty array must not silently lose its
    // men/days money.
    const withEmpty = computeScopeItemTotal(
      item({ men: 4, days: 5, shift: "DAY", labourItems: [] }),
      rates(),
      30
    );
    expect(withEmpty.labour).toBe(12000);
    expect(hasLabourRows([])).toBe(false);
    expect(hasLabourRows(null)).toBe(false);
    expect(hasLabourRows(undefined)).toBe(false);
  });

  it("a non-array labourItems value (corrupt/legacy JSON) falls back rather than throwing", () => {
    const weird = computeScopeItemTotal(
      item({ men: 4, days: 5, shift: "DAY", labourItems: "not-an-array" as never }),
      rates(),
      30
    );
    expect(weird.labour).toBe(12000);
  });

  it("the scalar path still honours Night and Weekend exactly as before", () => {
    // Regression guard: the labour leg was rewritten, so re-prove the
    // shift-aware scalar behaviour survived it.
    expect(computeScopeItemTotal(item({ men: 4, days: 5, shift: "Night" }), rates(), 0).labour)
      .toBe(20000); // 4 × 5 × 1000
    expect(computeScopeItemTotal(item({ men: 4, days: 5, shift: "Weekend" }), rates(), 0).labour)
      .toBe(18000); // 4 × 5 × 900
  });

  it("DEFAULT_ROLE_BY_DISCIPLINE is unchanged — old items still resolve through it", () => {
    expect(DEFAULT_ROLE_BY_DISCIPLINE.DEM).toBe("Demolition labourer");
    expect(DEFAULT_ROLE_BY_DISCIPLINE.CIV).toBe("Machine operator");
    expect(DEFAULT_ROLE_BY_DISCIPLINE.ASB).toBe("Asbestos labourer");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. THE LABOUR LEG — per-row role, shift and rate override
// ─────────────────────────────────────────────────────────────────────

describe("SCOPE_ITEM_LABOUR_STORE_V1 — labourItems pricing", () => {
  it("a two-row item prices to the SUM of its rows, not men × days × default rate", () => {
    // Row 1: 1 × Demolition labourer, Day,   5 days → 1 × 5 × 600  = $3,000
    // Row 2: 1 × Demolition supervisor, Night, 5 days → 1 × 5 × 1000 = $5,000
    // Sum                                                            = $8,000
    // The legacy scalar reading of the same row (men=2, days=5, the
    // item's own shift "Day") would be 2 × 5 × 600 = $6,000 — a
    // DIFFERENT number, which is the whole point of the store.
    const rowsItem = item({
      men: 2,
      days: 5,
      shift: "Day",
      labourItems: [
        { rowIdx: 0, labourTypeId: "lt-1", role: "Demolition labourer", shift: "Day", qty: 1, days: 5 },
        { rowIdx: 1, labourTypeId: "lt-2", role: "Demolition supervisor", shift: "Night", qty: 1, days: 5 }
      ]
    });

    const result = computeScopeItemTotal(rowsItem, rates(), 0);
    const legacyReadingOfTheSameRow = 2 * 5 * labourRateForShift("DEM", "Day", rates());

    expect(result.labour).toBe(8000);
    expect(legacyReadingOfTheSameRow).toBe(6000);
    expect(result.labour).not.toBe(legacyReadingOfTheSameRow);
  });

  it("each row uses its OWN shift, not the item's shift scalar", () => {
    // The item scalar says Day; the row says Night. Night must win.
    const result = computeScopeItemTotal(
      item({
        shift: "Day",
        labourItems: [{ role: "Demolition labourer", shift: "Night", qty: 2, days: 3 }]
      }),
      rates(),
      0
    );
    expect(result.labour).toBe(6000); // 2 × 3 × 1000
  });

  it("a row's dayRateOverride beats the rate card", () => {
    const result = computeScopeItemTotal(
      item({
        labourItems: [
          { role: "Demolition labourer", shift: "Day", qty: 2, days: 3, dayRateOverride: 725 }
        ]
      }),
      rates(),
      0
    );
    expect(result.labour).toBe(4350); // 2 × 3 × 725, NOT 2 × 3 × 600
  });

  it("a dayRateOverride of ZERO is a real override, not an absence", () => {
    // The stored-zero rule: 0 means "this row is free", and must NOT
    // fall through to the $600 catalogue rate.
    const result = computeScopeItemTotal(
      item({
        labourItems: [
          { role: "Demolition labourer", shift: "Day", qty: 4, days: 5, dayRateOverride: 0 }
        ]
      }),
      rates(),
      0
    );
    expect(result.labour).toBe(0);
    expect(labourRateForRow({ role: "Demolition labourer", dayRateOverride: 0 }, "DEM", rates()))
      .toBe(0);
  });

  it("a row with qty 0 or days 0 contributes 0 (stored zero, not a default)", () => {
    const zeroQty = computeScopeItemTotal(
      item({ labourItems: [{ role: "Demolition labourer", shift: "Day", qty: 0, days: 5 }] }),
      rates(),
      0
    );
    const zeroDays = computeScopeItemTotal(
      item({ labourItems: [{ role: "Demolition labourer", shift: "Day", qty: 3, days: 0 }] }),
      rates(),
      0
    );
    expect(zeroQty.labour).toBe(0);
    expect(zeroDays.labour).toBe(0);
  });

  it("qty defaults to 1 only when ABSENT (mirrors the plant qty rule)", () => {
    const result = computeScopeItemTotal(
      item({ labourItems: [{ role: "Demolition labourer", shift: "Day", days: 5 }] }),
      rates(),
      0
    );
    expect(result.labour).toBe(3000); // 1 × 5 × 600
  });

  it("a row with null qty/days/role/shift prices at 0 without throwing", () => {
    const result = computeScopeItemTotal(
      item({
        labourItems: [
          { rowIdx: 0, labourTypeId: null, role: null, shift: null, qty: null, days: null, dayRateOverride: null }
        ]
      }),
      rates(),
      0
    );
    // qty null → 1, days null → 0, so 1 × 0 × rate = 0.
    expect(result.labour).toBe(0);
    expect(result.lineTotal).toBe(0);
  });

  it("a row with no role falls back to the discipline's default role", () => {
    // Half-filled rows still price rather than silently costing nothing.
    const result = computeScopeItemTotal(
      item({ discipline: "CIV", labourItems: [{ shift: "Day", qty: 2, days: 2 }] }),
      rates(),
      0
    );
    expect(result.labour).toBe(2400); // Machine operator day = 600 → 2 × 2 × 600
  });

  it("a row naming an UNKNOWN role falls back to the discipline default rather than to $0", () => {
    const result = computeScopeItemTotal(
      item({ labourItems: [{ role: "Underwater basket weaver", shift: "Day", qty: 1, days: 1 }] }),
      rates(),
      0
    );
    expect(result.labour).toBe(600);
  });

  it("a role that exists on the rate card but is NOT any discipline default resolves by role", () => {
    // "Project manager" is not in DEFAULT_ROLE_BY_DISCIPLINE, so this is
    // only reachable through the new role-keyed map.
    const result = computeScopeItemTotal(
      item({ labourItems: [{ role: "Project manager", shift: "Night", qty: 1, days: 2 }] }),
      rates(),
      0
    );
    expect(result.labour).toBe(2800); // 1 × 2 × 1400
  });

  it("buildRateMaps exposes the role-keyed map without disturbing the discipline maps", () => {
    const maps = rates();
    expect(maps.labourRateByRoleShift?.get("Project manager:day")).toBe(850);
    expect(maps.labourRateByRoleShift?.get("Demolition supervisor:night")).toBe(1000);
    // Pre-existing maps unchanged.
    expect(maps.labourRateByDiscipline.get("DEM")).toBe(600);
    expect(maps.labourRateByDisciplineShift.get("DEM:night")).toBe(1000);
  });

  it("labourRateForRow tolerates a RateMaps with no role map at all (older literal fixtures)", () => {
    const noRoleMap: RateMaps = {
      labourRateByDiscipline: new Map([["DEM", 600]]),
      labourRateByDisciplineShift: new Map([["DEM:day", 600]]),
      plantRateById: new Map()
    };
    expect(labourRateForRow({ role: "Demolition supervisor", shift: "Day" }, "DEM", noRoleMap))
      .toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. PLANT — free-typed custom plant and dayRateOverride
// ─────────────────────────────────────────────────────────────────────

describe("SCOPE_ITEM_LABOUR_STORE_V1 — plant pricing fix", () => {
  it("free-typed custom plant with a dayRateOverride prices at the override, not $0", () => {
    // No plantRateId at all — this is the free-typed row that used to be
    // skipped outright and therefore priced at $0.
    const result = computeScopeItemTotal(
      item({
        plantItems: [
          { columnIndex: 1, description: "Hired 30t excavator", qty: 1, days: 4, dayRateOverride: 1200 }
        ]
      }),
      rates(),
      0
    );
    expect(result.plant).toBe(4800); // 1 × 4 × 1200 (was 0 before this slice)
  });

  it("a dayRateOverride beats the catalogue rate on a catalogue row", () => {
    const result = computeScopeItemTotal(
      item({
        plantItems: [
          { columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 2, dayRateOverride: 900 }
        ]
      }),
      rates(),
      0
    );
    expect(result.plant).toBe(1800); // 1 × 2 × 900, NOT 1 × 2 × 650
  });

  it("a plant dayRateOverride of ZERO is a real override (supplied free)", () => {
    const result = computeScopeItemTotal(
      item({
        plantItems: [
          { columnIndex: 1, plantRateId: "plant-excavator", qty: 2, days: 5, dayRateOverride: 0 }
        ]
      }),
      rates(),
      0
    );
    expect(result.plant).toBe(0);
  });

  it("REGRESSION: a row with neither a known catalogue rate nor an override still contributes 0", () => {
    const result = computeScopeItemTotal(
      item({
        plantItems: [
          { columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 1 }, // 650
          { columnIndex: 2, plantRateId: "plant-doesnt-exist", qty: 99, days: 99 }, // 0
          { columnIndex: 3, description: "Free-typed, no rate typed either", qty: 99, days: 99 } // 0
        ]
      }),
      rates(),
      0
    );
    expect(result.plant).toBe(650);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. MARKUP — one shared resolution expression
// ─────────────────────────────────────────────────────────────────────

describe("SCOPE_ITEM_LABOUR_STORE_V1 — markup resolution", () => {
  it("resolveEffectiveMarkup: item ?? card ?? tender", () => {
    expect(resolveEffectiveMarkup(12, 20, 30)).toBe(12); // item wins
    expect(resolveEffectiveMarkup(null, 20, 30)).toBe(20); // card wins
    expect(resolveEffectiveMarkup(null, null, 30)).toBe(30); // tender
    expect(resolveEffectiveMarkup(undefined, undefined, 30)).toBe(30);
  });

  it("a stored ZERO markup override is a real 0%, not an absence", () => {
    // The reason the chain is `??` and not `||`.
    expect(resolveEffectiveMarkup(0, 20, 30)).toBe(0);
    expect(resolveEffectiveMarkup(null, 0, 30)).toBe(0);
  });

  it("with markupOverride set the item total changes by exactly the markup delta", () => {
    const base = item({ men: 4, days: 5, shift: "DAY" });

    // Card markup 30% (item override NULL) — today's behaviour.
    const inherited = computeScopeItemTotal(base, rates(), resolveEffectiveMarkup(null, 30, 25));
    // Item override 50%.
    const overridden = computeScopeItemTotal(base, rates(), resolveEffectiveMarkup(50, 30, 25));

    expect(inherited.lineTotal).toBe(12000);
    expect(inherited.lineTotalWithMarkup).toBeCloseTo(15600, 6); // 12000 × 1.30
    expect(overridden.lineTotal).toBe(12000); // pre-markup subtotal unmoved
    expect(overridden.lineTotalWithMarkup).toBeCloseTo(18000, 6); // 12000 × 1.50

    // The card/discipline subtotal is Σ lineTotalWithMarkup, so it moves
    // by exactly this item's delta and by nothing else.
    const delta = overridden.lineTotalWithMarkup - inherited.lineTotalWithMarkup;
    expect(delta).toBeCloseTo(2400, 6);
  });

  it("with markupOverride NULL the card's markup applies exactly as today", () => {
    const base = item({ men: 4, days: 5, shift: "DAY", markupOverride: null });
    const withCardOnly = computeScopeItemTotal(base, rates(), resolveEffectiveMarkup(null, 30, 25));
    expect(withCardOnly.lineTotalWithMarkup).toBeCloseTo(15600, 6);
  });

  it("markup applies to the labourItems path identically to the scalar path", () => {
    const rowsItem = item({
      labourItems: [
        { role: "Demolition labourer", shift: "Day", qty: 4, days: 5 }
      ]
    });
    const result = computeScopeItemTotal(rowsItem, rates(), 30);
    expect(result.lineTotal).toBe(12000);
    expect(result.lineTotalWithMarkup).toBeCloseTo(15600, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5. CARD SUMMARY — peakCrew / labourDays from the labour rows
// ─────────────────────────────────────────────────────────────────────

describe("SCOPE_ITEM_LABOUR_STORE_V1 — labourCrewAndDaysForItem", () => {
  it("falls back to men / men × days when there are no labour rows", () => {
    expect(labourCrewAndDaysForItem({ men: 4, days: 5, labourItems: null }))
      .toEqual({ crew: 4, personDays: 20 });
    expect(labourCrewAndDaysForItem({ men: 4, days: 5, labourItems: [] }))
      .toEqual({ crew: 4, personDays: 20 });
    expect(labourCrewAndDaysForItem({ men: null, days: null }))
      .toEqual({ crew: 0, personDays: 0 });
  });

  it("sums qty across rows for crew and qty × days for person-days", () => {
    // 1 labourer for 5 days + 1 supervisor for 5 days = a crew of 2 on
    // site at once, 10 person-days of work.
    expect(
      labourCrewAndDaysForItem({
        men: 2,
        days: 5,
        labourItems: [
          { role: "Demolition labourer", shift: "Day", qty: 1, days: 5 },
          { role: "Demolition supervisor", shift: "Night", qty: 1, days: 5 }
        ]
      })
    ).toEqual({ crew: 2, personDays: 10 });
  });

  it("crew counts the people even when a row has 0 days", () => {
    expect(
      labourCrewAndDaysForItem({
        men: 0,
        days: 0,
        labourItems: [
          { qty: 3, days: 2 },
          { qty: 2, days: 0 }
        ]
      })
    ).toEqual({ crew: 5, personDays: 6 });
  });
});

describe("SCOPE_ITEM_LABOUR_STORE_V1 — getCardSummary reads the labour store", () => {
  const minimalRateResolver = {
    listRates: jest.fn().mockResolvedValue([]),
    resolveRate: jest.fn().mockRejectedValue(new Error("not found"))
  } as never;

  function serviceForCard(scopeItems: Array<Record<string, unknown>>) {
    const prisma = {
      tender: { findUnique: jest.fn(async () => ({ id: "tender-1" })) },
      scopeCard: {
        findFirst: jest.fn(async () => ({
          id: "card-1",
          tenderId: "tender-1",
          scopeItems,
          peakCrewOverride: null,
          labourDaysOverride: null,
          plantSummaryOverride: null,
          durationOverride: null
        }))
      }
    };
    return new ScopeOfWorksService(prisma as never, minimalRateResolver);
  }

  it("a two-row item reports peakCrew 2 — the people on site at once, not max(men)", () => {
    // The item's men scalar still says 1 (stale, and deliberately left
    // stale — nothing backfills it). The labour rows say 1 labourer +
    // 1 supervisor, so the crew is 2.
    const svc = serviceForCard([
      {
        men: new Prisma.Decimal("1"),
        days: new Prisma.Decimal("5"),
        labourItems: [
          { rowIdx: 0, role: "Demolition labourer", shift: "Day", qty: 1, days: 5 },
          { rowIdx: 1, role: "Demolition supervisor", shift: "Night", qty: 1, days: 5 }
        ],
        plantItems: null
      }
    ]);

    return svc.getCardSummary("tender-1", "card-1").then((summary) => {
      expect(summary.computed.peakCrew).toBe(2);
      // 10 person-days / crew of 2 = 5 days on site.
      expect(summary.computed.labourDays).toBe(5);
      expect(summary.computed.duration).toBe(5);
    });
  });

  it("an item with NULL labourItems reports exactly what it reported before", () => {
    // Seed row DEM1.1: men 4, days 5 → peakCrew 4, labourDays 5.
    const svc = serviceForCard([
      { men: new Prisma.Decimal("4"), days: new Prisma.Decimal("5"), labourItems: null, plantItems: null }
    ]);
    return svc.getCardSummary("tender-1", "card-1").then((summary) => {
      expect(summary.computed.peakCrew).toBe(4);
      expect(summary.computed.labourDays).toBe(5);
    });
  });

  it("mixed card: peakCrew is the max across old-style and new-style items", () => {
    const svc = serviceForCard([
      { men: new Prisma.Decimal("4"), days: new Prisma.Decimal("5"), labourItems: null, plantItems: null },
      {
        men: new Prisma.Decimal("1"),
        days: new Prisma.Decimal("2"),
        labourItems: [{ qty: 6, days: 2 }],
        plantItems: null
      }
    ]);
    return svc.getCardSummary("tender-1", "card-1").then((summary) => {
      // crews are 4 and 6 → peak 6; person-days 20 + 12 = 32 → 32/6 = 5.3
      expect(summary.computed.peakCrew).toBe(6);
      expect(summary.computed.labourDays).toBe(5.3);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 6. PERSISTENCE — DTO → service → Prisma round trip
// ─────────────────────────────────────────────────────────────────────

describe("SCOPE_ITEM_LABOUR_STORE_V1 — updateItem persistence", () => {
  const minimalRateResolver = {
    listRates: jest.fn().mockResolvedValue([]),
    resolveRate: jest.fn().mockRejectedValue(new Error("not found"))
  } as never;

  const existingItem = {
    id: "item-1",
    tenderId: "tender-1",
    cardId: "card-1",
    status: "confirmed",
    rowType: "general-labour",
    men: new Prisma.Decimal("4"),
    days: new Prisma.Decimal("5"),
    shift: "Day",
    labourItems: [{ rowIdx: 0, role: "Demolition labourer", shift: "Day", qty: 4, days: 5 }],
    markupOverride: new Prisma.Decimal("12.50"),
    card: { discipline: "DEM", markupOverride: null }
  };

  function build(existing: Record<string, unknown> = existingItem) {
    const update = jest.fn(async (args: unknown) => {
      const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
      // Model Prisma's real semantics: an `undefined` field is not
      // written, so the stored value survives.
      const merged: Record<string, unknown> = { ...existing };
      for (const [k, v] of Object.entries(data)) if (v !== undefined) merged[k] = v;
      return { ...merged, card: existing.card };
    });
    const prisma = {
      tender: { findUnique: jest.fn(async () => ({ id: "tender-1" })) },
      scopeOfWorksItem: { findUnique: jest.fn(async () => existing), update }
    };
    return {
      svc: new ScopeOfWorksService(prisma as never, minimalRateResolver),
      update
    };
  }

  const dataOf = (update: jest.Mock) =>
    (update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

  it("writes labourItems through verbatim (identity pass-through, like plantItems)", async () => {
    const { svc, update } = build();
    const rows = [
      { rowIdx: 0, labourTypeId: "lt-1", role: "Demolition labourer", shift: "Day", qty: 2, days: 3, dayRateOverride: null },
      { rowIdx: 1, labourTypeId: "lt-2", role: "Demolition supervisor", shift: "Night", qty: 1, days: 3, dayRateOverride: 725 }
    ];
    await svc.updateItem("tender-1", "item-1", { labourItems: rows } as never, "user-1");
    expect(dataOf(update).labourItems).toEqual(rows);
  });

  it("an EMPTY labourItems array is persisted as [] — clearing rows is a real write", async () => {
    const { svc, update } = build();
    await svc.updateItem("tender-1", "item-1", { labourItems: [] } as never, "user-1");
    expect(dataOf(update).labourItems).toEqual([]);
  });

  it("PARTIAL update: a PATCH that omits labourItems leaves the stored array alone", async () => {
    // The preserve-on-partial-update contract (see
    // scope-update-item-preserve.spec.ts): an absent key is `undefined`
    // in the Prisma payload, so the stored array is untouched. This is
    // what stops a notes-only save from erasing the labour rows.
    const { svc, update } = build();
    const result = await svc.updateItem("tender-1", "item-1", { notes: "just a note" } as never, "user-1");

    expect(dataOf(update).labourItems).toBeUndefined();
    expect(dataOf(update).markupOverride).toBeUndefined();
    expect((result.scopeItem as { labourItems: unknown }).labourItems)
      .toEqual(existingItem.labourItems);
    expect(Number((result.scopeItem as { markupOverride: unknown }).markupOverride)).toBe(12.5);
  });

  it("writes markupOverride as a Decimal", async () => {
    const { svc, update } = build();
    await svc.updateItem("tender-1", "item-1", { markupOverride: 42.5 } as never, "user-1");
    const written = dataOf(update).markupOverride;
    expect(written).toBeInstanceOf(Prisma.Decimal);
    expect(Number(written)).toBe(42.5);
  });

  it("markupOverride: 0 persists as 0, not as null (a stored zero is a real value)", async () => {
    const { svc, update } = build();
    await svc.updateItem("tender-1", "item-1", { markupOverride: 0 } as never, "user-1");
    const written = dataOf(update).markupOverride;
    expect(written).not.toBeNull();
    expect(Number(written)).toBe(0);
  });

  it("markupOverride: null clears the override (item falls back to the card)", async () => {
    const { svc, update } = build();
    await svc.updateItem("tender-1", "item-1", { markupOverride: null } as never, "user-1");
    expect(dataOf(update).markupOverride).toBeNull();
  });

  it("ROUND TRIP: what updateItem writes is what the pricing read prices from", async () => {
    const { svc, update } = build();
    const rows = [
      { rowIdx: 0, role: "Demolition labourer", shift: "Day", qty: 1, days: 5 },
      { rowIdx: 1, role: "Demolition supervisor", shift: "Night", qty: 1, days: 5 }
    ];
    const result = await svc.updateItem(
      "tender-1",
      "item-1",
      { labourItems: rows, markupOverride: 50 } as never,
      "user-1"
    );

    // Read the row back the way listItems does: project the persisted
    // record through toPricingInput's shape and price it.
    const stored = result.scopeItem as unknown as {
      labourItems: unknown;
      markupOverride: unknown;
    };
    const priced = computeScopeItemTotal(
      item({
        men: 4,
        days: 5,
        shift: "Day",
        labourItems: stored.labourItems as never
      }),
      rates(),
      resolveEffectiveMarkup(Number(stored.markupOverride), null, 30)
    );

    // 1 × 5 × 600 + 1 × 5 × 1000 = 8000, at the item's own 50% markup.
    expect(priced.labour).toBe(8000);
    expect(priced.lineTotal).toBe(8000);
    expect(priced.lineTotalWithMarkup).toBeCloseTo(12000, 6);
  });

  it("createItem carries both new fields through as well", async () => {
    const create = jest.fn(async (args: unknown) => ({
      id: "new-1",
      ...((args as { data?: Record<string, unknown> })?.data ?? {})
    }));
    const prisma = {
      tender: { findUnique: jest.fn(async () => ({ id: "tender-1" })) },
      scopeOfWorksItem: {
        count: jest.fn(async () => 0),
        aggregate: jest.fn(async () => ({ _max: { itemNumber: 0 } })),
        findFirst: jest.fn(async () => null),
        create
      },
      scopeCard: {
        findFirst: jest.fn(async () => ({ id: "card-1" })),
        aggregate: jest.fn(async () => ({ _max: { cardNumber: 0, sortOrder: 0 } })),
        create: jest.fn(async () => ({ id: "card-1" }))
      }
    };
    const svc = new ScopeOfWorksService(prisma as never, minimalRateResolver);
    const rows = [{ rowIdx: 0, role: "Demolition labourer", shift: "Day", qty: 2, days: 3 }];
    await svc.createItem(
      "tender-1",
      {
        discipline: "DEM",
        rowType: "demolition",
        description: "New row",
        labourItems: rows,
        markupOverride: 15
      } as never,
      "user-1"
    );
    const data = (create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.labourItems).toEqual(rows);
    expect(Number(data.markupOverride)).toBe(15);
  });
});
