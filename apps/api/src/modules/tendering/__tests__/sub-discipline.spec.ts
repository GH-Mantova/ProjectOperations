/**
 * SUB discipline -- failing-first spec.
 *
 * Written BEFORE the code changes (scope-subcontracted order 2).
 * Two silent failures the implementation must prevent:
 *
 *   1. DEFAULT_ROLE_BY_DISCIPLINE["SUB"] is undefined -> buildRateMaps
 *      silently produces no entry in labourRateByDiscipline for SUB, so
 *      every SUB line prices labour at $0 with no error.
 *
 *   2. DISCIPLINE_ORDER missing "SUB" -> estimate-excel.builder.ts
 *      grandTotal loop skips SUB rows; they appear in Scope Detail but
 *      are absent from the printed total.
 *      Note: the builder skips `if (disc === "Other") continue` -- this
 *      skips by NAME, not by position. SUB at any position in the tuple
 *      still reaches grandTotal as long as it is not named "Other".
 *
 * Plus round-trip assertions that SUB card pricing is computed correctly.
 */

import { Prisma } from "@prisma/client";
import type { Discipline } from "../dto/scope-of-works.dto";
import {
  DEFAULT_ROLE_BY_DISCIPLINE,
  DISCIPLINE_ORDER,
  buildRateMaps,
  computeScopeItemTotal
} from "../scope-item-pricing";

const SUB: Discipline = "SUB";

// ── Silent failure 1: DEFAULT_ROLE_BY_DISCIPLINE must have an explicit SUB entry ─

describe("DEFAULT_ROLE_BY_DISCIPLINE -- SUB entry", () => {
  it("SUB has an explicit entry (not undefined)", () => {
    // Before the fix, SUB is absent from the Record, so this returns undefined
    // and labourRateByDiscipline gets no SUB entry -- silent $0 labour.
    expect(DEFAULT_ROLE_BY_DISCIPLINE[SUB]).toBeDefined();
  });

  it("buildRateMaps includes SUB in labourRateByDiscipline when a matching role exists", () => {
    const subRole = DEFAULT_ROLE_BY_DISCIPLINE[SUB];
    // subRole may be any string; what matters is it is defined and non-empty
    expect(typeof subRole).toBe("string");
    expect(subRole.length).toBeGreaterThan(0);

    const labourRates = [{ role: subRole, dayRate: new Prisma.Decimal(500) }];
    const maps = buildRateMaps(labourRates, []);
    // If SUB were absent from DEFAULT_ROLE_BY_DISCIPLINE the loop in buildRateMaps
    // would never call labourByRole.get(undefined) and the map would have no SUB entry.
    expect(maps.labourRateByDiscipline.has(SUB)).toBe(true);
  });
});

// ── Silent failure 2: DISCIPLINE_ORDER must include SUB ─

describe("DISCIPLINE_ORDER -- SUB present", () => {
  it("DISCIPLINE_ORDER contains SUB", () => {
    // Before the fix, DISCIPLINE_ORDER mirrors IS_DISCIPLINE_CODES which lacks SUB.
    // The Excel builder iterates DISCIPLINE_ORDER to accumulate grandTotal --
    // absent SUB means its money is printed as a line but excluded from the total.
    expect(DISCIPLINE_ORDER).toContain(SUB);
  });

  it("SUB is not excluded by the Other-skip guard in the Excel grandTotal loop", () => {
    // The Excel builder's inner loop is:
    //   for (const disc of DISCIPLINE_ORDER) {
    //     if (disc === "Other") continue;
    //     grandTotal += bucket.withMarkup;
    //   }
    // Only "Other" is skipped by name. SUB at any position in DISCIPLINE_ORDER
    // will therefore reach grandTotal. Verify it is present and is not "Other".
    expect(DISCIPLINE_ORDER).toContain(SUB);
    expect(SUB).not.toBe("Other");
  });
});

// ── SUB card round-trip: pricing logic ─

describe("computeScopeItemTotal -- SUB discipline", () => {
  it("SUB item with a labour rate produces a non-zero lineTotal (not silently $0)", () => {
    const subRole = DEFAULT_ROLE_BY_DISCIPLINE[SUB];
    const labourRates = [
      { role: subRole, dayRate: new Prisma.Decimal(1000) }
    ];
    const maps = buildRateMaps(labourRates, []);
    const result = computeScopeItemTotal(
      { discipline: SUB, men: 2, days: 3, plantItems: null, provisionalAmount: null },
      maps,
      0
    );
    // 2 men * 3 days * $1000/day = $6000 labour
    expect(result.labour).toBe(6000);
    expect(result.lineTotal).toBe(6000);
  });

  it("SUB item with zero labour rates produces $0 labour (not an error)", () => {
    const maps = buildRateMaps([], []);
    const result = computeScopeItemTotal(
      { discipline: SUB, men: 2, days: 3, plantItems: null, provisionalAmount: null },
      maps,
      30
    );
    // No rate entry -> falls back to 0; should not throw
    expect(result.labour).toBe(0);
    expect(result.lineTotal).toBe(0);
  });

  it("SUB item with markup produces lineTotalWithMarkup correctly", () => {
    const subRole = DEFAULT_ROLE_BY_DISCIPLINE[SUB];
    const labourRates = [{ role: subRole, dayRate: new Prisma.Decimal(1000) }];
    const maps = buildRateMaps(labourRates, []);
    const result = computeScopeItemTotal(
      { discipline: SUB, men: 2, days: 3, plantItems: null, provisionalAmount: null },
      maps,
      30
    );
    // 2 men * 3 days * $1000/day = $6000; with 30% markup = $7800
    expect(result.labour).toBe(6000);
    expect(result.lineTotal).toBe(6000);
    expect(result.lineTotalWithMarkup).toBeCloseTo(7800, 2);
  });

  it("SUB item with plant reaches grandTotal (lineTotalWithMarkup non-zero)", () => {
    // Verify SUB is not treated like Other (provisional-only -- labour/plant don't apply).
    // The computeScopeItemTotal function has a special path for "Other" that
    // ignores men/days/plant and returns provisionalAmount instead.
    // SUB must NOT hit that path.
    const subRole = DEFAULT_ROLE_BY_DISCIPLINE[SUB];
    const labourRates = [{ role: subRole, dayRate: new Prisma.Decimal(500) }];
    const plantRates = [{ id: "plant-1", rate: new Prisma.Decimal(200) }];
    const maps = buildRateMaps(labourRates, plantRates);
    const result = computeScopeItemTotal(
      {
        discipline: SUB,
        men: 1,
        days: 2,
        plantItems: [{ plantRateId: "plant-1", qty: 1, days: 2 }],
        provisionalAmount: null
      },
      maps,
      0
    );
    // 1 men * 2 days * $500 = $1000 labour
    // 1 qty * 2 days * $200 = $400 plant
    // total = $1400
    expect(result.labour).toBe(1000);
    expect(result.plant).toBe(400);
    expect(result.lineTotal).toBe(1400);
  });
});
