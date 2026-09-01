import { describe, expect, it } from "vitest";
import { DISCIPLINE_CODES, DISCIPLINE_LABELS } from "../utils/card-display";

// PR 5A — NewCardModal logic tests.
// The web workspace has no @testing-library / jsdom set up, so we
// exercise the discipline data contract and creation name-derivation
// logic that the modal relies on. Rendered-output verification is
// covered by the visual smoke test and E2E.

describe("NewCardModal data contract (PR 5A)", () => {
  it("DISCIPLINE_CODES lists exactly 5 entries in expected order", () => {
    expect(DISCIPLINE_CODES).toEqual(["DEM", "CIV", "ASB", "Other", "SUB"]);
    expect(DISCIPLINE_CODES.length).toBe(5);
  });

  it("every DISCIPLINE_CODE has a human label", () => {
    for (const code of DISCIPLINE_CODES) {
      expect(DISCIPLINE_LABELS[code]).toBeDefined();
      expect(typeof DISCIPLINE_LABELS[code]).toBe("string");
      expect(DISCIPLINE_LABELS[code].length).toBeGreaterThan(0);
    }
  });

  it("labels match expected values for the picker display", () => {
    expect(DISCIPLINE_LABELS["DEM"]).toBe("Demolition");
    expect(DISCIPLINE_LABELS["CIV"]).toBe("Civil works");
    expect(DISCIPLINE_LABELS["ASB"]).toBe("Asbestos removal");
    expect(DISCIPLINE_LABELS["Other"]).toBe("Other");
    expect(DISCIPLINE_LABELS["SUB"]).toBe("Subcontracted");
  });

  it("default card name derives from discipline label (creation contract)", () => {
    // The modal sends DISCIPLINE_LABELS[code] as the card name.
    // Verify the mapping produces user-friendly names.
    const expected: Record<string, string> = {
      DEM: "Demolition",
      CIV: "Civil works",
      ASB: "Asbestos removal",
      Other: "Other",
      SUB: "Subcontracted"
    };
    for (const code of DISCIPLINE_CODES) {
      const name = DISCIPLINE_LABELS[code] ?? code;
      expect(name).toBe(expected[code]);
    }
  });

  it("no discipline code is empty or whitespace-only", () => {
    for (const code of DISCIPLINE_CODES) {
      expect(code.trim().length).toBeGreaterThan(0);
    }
  });
});
