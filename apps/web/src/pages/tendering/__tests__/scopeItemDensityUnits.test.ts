import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  densityDivisorForUnit,
  isSheetUnit,
  storedDensityForMaterial
} from "../scope-cards/WbsMeasurementBlock";
import { computeDerivedDimensions } from "../scopeItemDimensions";

/**
 * SCOPE_WBS_TABLE_V1 regression guard.
 *
 * The scope card decides whether to divide a material density by 1000 by
 * comparing the rate-card `unit` against the unit string the API seeds. Those
 * strings carry superscripts:
 *
 *   apps/api/prisma/seed-initial-services.ts  ->  unit: "kg/m³"
 *   migrations .../material_density_kind      ->  WHERE "unit" = 'kg/m²'
 *
 * and there is no ASCII variant anywhere in apps/api/prisma. During the WBS
 * table rewrite every non-ASCII character in the component was flattened, so
 * the comparison became `=== "kg/m3"`. It compiled, every unit test passed and
 * the acceptance suite stayed green — because nothing in the suite changes a
 * material — while the ÷1000 silently stopped happening and a 10 m³ concrete
 * item reported 24,000 t instead of 24.
 *
 * SCOPE_WBS_ACTIONS_V1 — THIS GUARD IS NOW BEHAVIOURAL, as its previous
 * version said it should become:
 *
 *   "the comparison lives inline in a TooltipSelect onChange and is not
 *    exported, so there is nothing importable to exercise. If that logic is
 *    ever lifted into a helper, replace this with a behavioural test of the
 *    helper."
 *
 * Slice 5 lifted it. The rule now lives in ONE place —
 * `densityDivisorForUnit` / `isSheetUnit` / `storedDensityForMaterial`,
 * exported from `scope-cards/WbsMeasurementBlock.tsx` — and both material
 * dropdowns (the item's own measurement and each extra one) call it. So this
 * file asserts the BEHAVIOUR instead of grepping a file for a string.
 *
 * That matters beyond tidiness. The old check was pinned to a path
 * (`../ScopeQuantitiesTable.tsx`) and broke the moment the logic moved, which
 * is a stop scheduled for whoever relocates it next. An imported helper cannot
 * go stale that way: if it moves, this file fails to RESOLVE rather than
 * silently guarding nothing, and if it changes meaning, these assertions fail.
 *
 * One source-text check is kept, and only one: a NEGATIVE control that no
 * ASCII-flattened literal exists in the implementation file. It is belt and
 * braces against the one rewrite the behavioural tests could not catch — one
 * that flattens the superscripts in the implementation and in this file's own
 * expectations together, leaving both sides agreeing on a value the API never
 * sends.
 */

const IMPLEMENTATION_PATH = "../scope-cards/WbsMeasurementBlock.tsx";
const IMPLEMENTATION = readFileSync(
  fileURLToPath(new URL(IMPLEMENTATION_PATH, import.meta.url)),
  "utf8"
);

describe("scope item density units (SCOPE_WBS_TABLE_V1 regression guard)", () => {
  it("divides the seeded kg/m³ density by 1000, superscript included", () => {
    expect(densityDivisorForUnit("kg/m³")).toBe(1000);
    expect(storedDensityForMaterial({ density: "2400", unit: "kg/m³" })).toBe(2.4);
  });

  it("recognises the seeded kg/m² sheet unit, superscript included", () => {
    expect(isSheetUnit("kg/m²")).toBe(true);
    // Stored AS IS: computeDerivedDimensions' sqm fallback is
    // `(sqm × density) / 1000`, so the ÷1000 for sheets happens downstream.
    // Dividing here as well would divide twice.
    expect(densityDivisorForUnit("kg/m²")).toBe(1);
    expect(storedDensityForMaterial({ density: "14.5", unit: "kg/m²" })).toBe(14.5);
  });

  it("does not match an ASCII-flattened unit that could never match a seeded value", () => {
    // The bug itself, as behaviour. A flattened comparison stops matching what
    // the API sends, the ÷1000 stops happening, and tonnage is overstated
    // 1000x with a green suite.
    expect(densityDivisorForUnit("kg/m3")).toBe(1);
    expect(densityDivisorForUnit("kg/m2")).toBe(1);
    expect(isSheetUnit("kg/m2")).toBe(false);
  });

  it("prices the original incident correctly: 10 m³ of concrete is 24 t, not 24,000", () => {
    const seeded = storedDensityForMaterial({ density: "2400", unit: "kg/m³" });
    expect(computeDerivedDimensions({ m3: 10, density: seeded }).tonnes).toBe(24);
    // What the flattened comparison produced, kept as the contrast.
    expect(computeDerivedDimensions({ m3: 10, density: 2400 }).tonnes).toBe(24000);
  });

  it("leaves any other unit, and no material at all, alone", () => {
    expect(densityDivisorForUnit("t/m³")).toBe(1);
    expect(densityDivisorForUnit(null)).toBe(1);
    expect(storedDensityForMaterial(null)).toBeNull();
  });

  it("guards both material dropdowns from one helper, so they cannot drift", () => {
    // The rule used to be inlined twice — the item's own measurement and the
    // per-material rows — which is what made the old count-both-call-sites
    // check necessary. Both now route through storedDensityForMaterial, so
    // there is one call site for the rule and nothing to count.
    const calls = IMPLEMENTATION.split("storedDensityForMaterial(lookup)").length - 1;
    expect(calls).toBe(2);
  });

  it("contains no ASCII-flattened unit literal in the implementation", () => {
    // The one source-text check kept, and a NEGATIVE one: it can only fail by
    // a flattening rewrite, never by a relocation of correct code.
    expect(IMPLEMENTATION).not.toContain('"kg/m3"');
    expect(IMPLEMENTATION).not.toContain('"kg/m2"');
  });
});
