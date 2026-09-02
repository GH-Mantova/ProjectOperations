import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SCOPE_WBS_TABLE_V1 regression guard.
 *
 * ScopeQuantitiesTable decides whether to divide a material density by 1000 by
 * comparing `lookup.unit` against the unit string the API seeds. Those strings
 * carry superscripts:
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
 * This asserts the literals directly. It is deliberately a source-level check:
 * the comparison lives inline in a TooltipSelect onChange and is not exported,
 * so there is nothing importable to exercise. If that logic is ever lifted into
 * a helper, replace this with a behavioural test of the helper.
 */
const COMPONENT = readFileSync(
  fileURLToPath(new URL("../ScopeQuantitiesTable.tsx", import.meta.url)),
  "utf8"
);

describe("scope item density units (SCOPE_WBS_TABLE_V1 regression guard)", () => {
  it("compares against the seeded kg/m³ string, superscript included", () => {
    expect(COMPONENT).toContain('lookup.unit === "kg/m³"');
  });

  it("compares against the seeded kg/m² string, superscript included", () => {
    expect(COMPONENT).toContain('lookup?.unit === "kg/m²"');
  });

  it("contains no ASCII-flattened unit literal that could never match", () => {
    // Negative control for the two assertions above: if a rewrite flattens the
    // superscripts, these are what it produces, and neither can ever equal a
    // value the API sends.
    expect(COMPONENT).not.toContain('"kg/m3"');
    expect(COMPONENT).not.toContain('"kg/m2"');
  });

  it("still guards both call sites, not just the first", () => {
    const m3 = COMPONENT.split('lookup.unit === "kg/m³"').length - 1;
    const m2 = COMPONENT.split('lookup?.unit === "kg/m²"').length - 1;
    // Row-1 material and the per-material rows each run the conversion.
    expect(m3).toBe(2);
    expect(m2).toBe(2);
  });
});
