/**
 * Guard spec: disciplines single-source invariant.
 *
 * The five IS discipline codes (DEM/CIV/ASB/SUB/Other) must only be declared
 * as a literal tuple in their respective canonical sources:
 *   API:  apps/api/src/modules/personas/definitions/disciplines.ts
 *   Web:  apps/web/src/constants/disciplines.ts
 *
 * Every other file must derive from the canonical source, not re-declare the
 * codes. This spec reads the previously-inlined files and asserts that none
 * of them now contains an independent literal declaration.
 *
 * Detection heuristic: a line that starts a tuple/array literal and contains
 * two or more discipline codes is evidence of an independent declaration.
 * The canonical source files themselves are excluded from the check.
 *
 * PARITY ASSERTION (added scope-subcontracted order 2, 2026-08-31):
 * The API and web tuples must contain EXACTLY THE SAME CODES IN THE SAME ORDER.
 * Web and API do not share a runtime package, so parity is enforced by this
 * spec. A code added to one and not the other silently breaks the UI tab
 * (the discipline never appears) with no compile error anywhere.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Repo root is two levels above apps/api (jest rootDir).
const REPO_ROOT = resolve(__dirname, "../../../../../../..");

function readFile(relPath: string): string {
  const abs = resolve(REPO_ROOT, relPath);
  return readFileSync(abs, "utf-8");
}

/**
 * Returns true if the content declares an independent literal discipline tuple
 * — i.e. three or more of the four code strings appearing as consecutive
 * comma-separated string literals, which is the shape of an array/tuple
 * declaration. Runtime dispatch like `f("DEM")` or object keys `DEM: ...` are
 * NOT tuples and must not trip the guard.
 */
function hasInlinedDisciplineTuple(src: string): boolean {
  // Strip line comments so a comment listing the codes doesn't trip the guard.
  const stripped = src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  // Match three consecutive quoted codes separated only by commas/whitespace —
  // the unambiguous shape of a tuple/array literal like ["DEM", "CIV", "ASB", ...].
  const tuplePattern =
    /"(?:DEM|CIV|ASB|SUB|Other)"\s*,\s*"(?:DEM|CIV|ASB|SUB|Other)"\s*,\s*"(?:DEM|CIV|ASB|SUB|Other)"/;
  return tuplePattern.test(stripped);
}

/**
 * Extract the IS_DISCIPLINE_CODES tuple from a source file as a string array.
 * Returns the codes in declaration order.
 */
function extractDisciplineCodes(src: string): string[] {
  // Match: IS_DISCIPLINE_CODES = ["DEM", "CIV", ...] as const
  const match = src.match(/IS_DISCIPLINE_CODES\s*=\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

const FILES_UNDER_TEST: Array<{ label: string; path: string }> = [
  {
    label: "scope-of-works.dto.ts",
    path: "apps/api/src/modules/tendering/dto/scope-of-works.dto.ts"
  },
  {
    label: "estimate-export.service.ts",
    path: "apps/api/src/modules/estimate-export/estimate-export.service.ts"
  },
  {
    label: "card-display.ts",
    path: "apps/web/src/pages/tendering/scope-cards/utils/card-display.ts"
  },
  {
    label: "TenderingPage.tsx",
    path: "apps/web/src/pages/tendering/TenderingPage.tsx"
  },
  {
    label: "SubcontractorRatesTab.tsx",
    path: "apps/web/src/pages/directory/SubcontractorRatesTab.tsx"
  }
];

describe("disciplines-single-source invariant", () => {
  it("canonical API source exports IS_DISCIPLINE_CODES with exactly the five codes", () => {
    const src = readFile("apps/api/src/modules/personas/definitions/disciplines.ts");
    expect(src).toContain('IS_DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other", "SUB"] as const');
  });

  it("canonical web source exports IS_DISCIPLINE_CODES with exactly the five codes", () => {
    const src = readFile("apps/web/src/constants/disciplines.ts");
    expect(src).toContain('IS_DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other", "SUB"] as const');
  });

  it("API and web IS_DISCIPLINE_CODES tuples contain EXACTLY THE SAME CODES IN THE SAME ORDER", () => {
    // Parity guard: the compiler cannot see across the package boundary.
    // A code added to one tuple and not the other silently breaks the UI
    // (the discipline tab never appears) with no compile error.
    const apiSrc = readFile("apps/api/src/modules/personas/definitions/disciplines.ts");
    const webSrc = readFile("apps/web/src/constants/disciplines.ts");
    const apiCodes = extractDisciplineCodes(apiSrc);
    const webCodes = extractDisciplineCodes(webSrc);
    expect(apiCodes.length).toBeGreaterThan(0);
    expect(webCodes).toEqual(apiCodes);
  });

  for (const { label, path } of FILES_UNDER_TEST) {
    it(`${label} does not contain an independent literal discipline tuple`, () => {
      const src = readFile(path);
      const hasLiteral = hasInlinedDisciplineTuple(src);
      expect(hasLiteral).toBe(false);
    });
  }

  it("scope-of-works.dto.ts imports IS_DISCIPLINE_CODES and assigns DISCIPLINES from it", () => {
    const src = readFile("apps/api/src/modules/tendering/dto/scope-of-works.dto.ts");
    expect(src).toMatch(/import[\s\S]*?IS_DISCIPLINE_CODES[\s\S]*?from/);
    expect(src).toMatch(/DISCIPLINES\s*=\s*IS_DISCIPLINE_CODES/);
  });

  it("estimate-export.service.ts imports IS_DISCIPLINE_CODES and assigns DISCIPLINE_ORDER from it", () => {
    const src = readFile("apps/api/src/modules/estimate-export/estimate-export.service.ts");
    expect(src).toMatch(/import[\s\S]*?IS_DISCIPLINE_CODES[\s\S]*?from/);
    expect(src).toMatch(/DISCIPLINE_ORDER\s*=\s*IS_DISCIPLINE_CODES/);
  });

  it("card-display.ts imports IS_DISCIPLINE_CODES from constants/disciplines", () => {
    const src = readFile("apps/web/src/pages/tendering/scope-cards/utils/card-display.ts");
    expect(src).toContain("IS_DISCIPLINE_CODES");
    expect(src).toContain("constants/disciplines");
  });

  it("TenderingPage.tsx imports IS_DISCIPLINE_CODES from constants/disciplines", () => {
    const src = readFile("apps/web/src/pages/tendering/TenderingPage.tsx");
    expect(src).toContain("IS_DISCIPLINE_CODES");
    expect(src).toContain("constants/disciplines");
  });

  it("SubcontractorRatesTab.tsx imports IS_DISCIPLINE_CODES from constants/disciplines", () => {
    const src = readFile("apps/web/src/pages/directory/SubcontractorRatesTab.tsx");
    expect(src).toContain("IS_DISCIPLINE_CODES");
    expect(src).toContain("constants/disciplines");
  });
});
