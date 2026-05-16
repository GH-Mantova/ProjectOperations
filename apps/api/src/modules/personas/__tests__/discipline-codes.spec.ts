import {
  IS_DISCIPLINE_CODES,
  IS_DISCIPLINE_LABELS,
  IS_DISCIPLINE_DESCRIPTIONS,
  LEGACY_DISCIPLINE_MIGRATION_MAP,
  LEGACY_LOWERCASE_DISCIPLINE_MAP
} from "../definitions/disciplines";
import { tenderingPersona } from "../definitions/tendering.persona";

// PR A1 (2026-05-16) — discipline migration from 5-code (SO/Str/Asb/Civ/Prv)
// to 4-code (DEM/CIV/ASB/Other). These tests are the regression guard for
// the migration: they assert the constants exist with the expected shape,
// AND that the persona prompt no longer contains legacy codes as
// standalone tokens (word-boundary checks).

describe("discipline codes constants (PR A1)", () => {
  it("has exactly 4 codes in canonical order", () => {
    expect([...IS_DISCIPLINE_CODES]).toEqual(["DEM", "CIV", "ASB", "Other"]);
  });

  it("maps every legacy code to a valid new code", () => {
    expect(LEGACY_DISCIPLINE_MIGRATION_MAP.SO).toBe("DEM");
    expect(LEGACY_DISCIPLINE_MIGRATION_MAP.Str).toBe("DEM");
    expect(LEGACY_DISCIPLINE_MIGRATION_MAP.Asb).toBe("ASB");
    expect(LEGACY_DISCIPLINE_MIGRATION_MAP.Civ).toBe("CIV");
    expect(LEGACY_DISCIPLINE_MIGRATION_MAP.Prv).toBe("Other");
    for (const target of Object.values(LEGACY_DISCIPLINE_MIGRATION_MAP)) {
      expect(IS_DISCIPLINE_CODES).toContain(target);
    }
  });

  it("maps the legacy lowercase propose_scope_items vocabulary to new codes", () => {
    expect(LEGACY_LOWERCASE_DISCIPLINE_MAP.demolition).toBe("DEM");
    expect(LEGACY_LOWERCASE_DISCIPLINE_MAP.asbestos).toBe("ASB");
    expect(LEGACY_LOWERCASE_DISCIPLINE_MAP.civil).toBe("CIV");
    for (const target of Object.values(LEGACY_LOWERCASE_DISCIPLINE_MAP)) {
      expect(IS_DISCIPLINE_CODES).toContain(target);
    }
  });

  it("has a non-empty label for every code", () => {
    for (const code of IS_DISCIPLINE_CODES) {
      expect(IS_DISCIPLINE_LABELS[code]).toBeTruthy();
      expect(IS_DISCIPLINE_LABELS[code].length).toBeGreaterThan(0);
    }
  });

  it("has a substantive description for every code", () => {
    for (const code of IS_DISCIPLINE_CODES) {
      expect(IS_DISCIPLINE_DESCRIPTIONS[code]).toBeTruthy();
      expect(IS_DISCIPLINE_DESCRIPTIONS[code].length).toBeGreaterThan(40);
    }
  });
});

describe("persona prompt vocabulary (PR A1)", () => {
  // Reach the assembled persona description directly (no sub-mode prefix).
  // tenderingPersona.description is the canonical content that goes into
  // every persona system prompt.
  const prompt = tenderingPersona.description;

  it("mentions all 4 new codes", () => {
    expect(prompt).toMatch(/\bDEM\b/);
    expect(prompt).toMatch(/\bCIV\b/);
    expect(prompt).toMatch(/\bASB\b/);
    expect(prompt).toMatch(/\bOther\b/);
  });

  it("does not contain legacy standalone codes (word-boundary)", () => {
    // Note: \bSO\b would match "SO" but not "Strip-out" (different word).
    // \bStr\b would match "Str" but not "Structural" (Str is a prefix of
    // Structural but not bounded — actually \b matches at "Str" inside
    // "Structural" because the boundary is at the start). To avoid that
    // false match, exclude "Structural" and similar substrings explicitly
    // via the matcher: we check that no occurrence of "Str" is followed
    // by a non-letter.
    expect(prompt).not.toMatch(/\bSO\b/);
    expect(prompt).not.toMatch(/\bStr\b(?![a-z])/);
    expect(prompt).not.toMatch(/\bPrv\b/);
    expect(prompt).not.toMatch(/\bAsb\b/);
    expect(prompt).not.toMatch(/\bCiv\b/);
  });

  it("preserves strip-out vs fit-out scope clarity (PR #142 regression guard)", () => {
    // The strip-out vs fit-out disambiguation was the headline behaviour of
    // PR #142 and is regression-tested via tendering-assistant.system-prompt
    // .regression.spec.ts. After PR A1 collapsed SO + Str into DEM, the
    // unified DEM description must still preserve the disambiguation:
    //   - "strip-out" (removing existing fit-out) is IS scope
    //   - "fit-out installation" (installing new fit-out) is NOT IS scope
    expect(prompt).toMatch(/strip-out/i);
    expect(prompt).toMatch(/fit-out/i);
    // Spelled out to catch any wording drift that would weaken the rule.
    expect(prompt).toMatch(/strip out the existing tenancy|strip-out is core IS work|remove existing fit-out/i);
  });
});
