// B-HW-9: Pure unit tests for deriveComplianceSuggestions.
//
// No I/O, no mocks — the function is pure.

import {
  deriveComplianceSuggestions,
  SUGGESTION_ORIGIN,
  MANUAL_ORIGIN
} from "../compliance-derivation";

describe("deriveComplianceSuggestions", () => {
  // ── Empty input ─────────────────────────────────────────────────────────────

  it("returns an empty array when scope is empty", () => {
    const result = deriveComplianceSuggestions([]);
    expect(result).toEqual([]);
  });

  // ── Baseline ────────────────────────────────────────────────────────────────

  it("always includes general SWMS when at least one scope item is present", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "general", discipline: "Other" }
    ]);
    expect(result.some((r) => r.type === "SWMS — General site works")).toBe(true);
    expect(result.every((r) => r.responsibleParty === "us")).toBe(true);
  });

  // ── Demolition ──────────────────────────────────────────────────────────────

  it("returns demolition obligations for a demolition row", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "demolition", discipline: "DEM" }
    ]);

    const types = result.map((r) => r.type);
    expect(types).toContain("SWMS — General site works");
    expect(types).toContain("Form 65 — Demolition");
    expect(types).toContain("SWMS — Demolition");
    expect(types).toContain("Demolition permit");
  });

  it("includes demolition obligations when discipline is DEM even if rowType differs", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "general", discipline: "DEM" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("Form 65 — Demolition");
    expect(types).toContain("SWMS — Demolition");
    expect(types).toContain("Demolition permit");
  });

  // ── Asbestos ────────────────────────────────────────────────────────────────

  it("returns asbestos obligations for asbestos rowType", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "asbestos", discipline: "ASB" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("Form 65 — Asbestos");
    expect(types).toContain("SWMS — Asbestos handling");
    expect(types).toContain("Asbestos removal licence");
  });

  it("returns asbestos obligations for asbestos-removal rowType", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "asbestos-removal", discipline: "Other" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("Form 65 — Asbestos");
    expect(types).toContain("SWMS — Asbestos handling");
    expect(types).toContain("Asbestos removal licence");
  });

  // ── Mixed asbestos + demolition ─────────────────────────────────────────────

  it("contains both Form 65 flavours when scope has asbestos and demolition items", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "asbestos", discipline: "ASB" },
      { rowType: "demolition", discipline: "DEM" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("Form 65 — Asbestos");
    expect(types).toContain("Form 65 — Demolition");
    expect(types).toContain("SWMS — Asbestos handling");
    expect(types).toContain("SWMS — Demolition");
    expect(types).toContain("Asbestos removal licence");
    expect(types).toContain("Demolition permit");
  });

  it("deduplicates when mixed items produce the same suggestion", () => {
    // Two demolition rows — SWMS — Demolition should appear only once.
    const result = deriveComplianceSuggestions([
      { rowType: "demolition", discipline: "DEM" },
      { rowType: "demolition", discipline: "DEM" }
    ]);
    const demSWMS = result.filter((r) => r.type === "SWMS — Demolition");
    expect(demSWMS).toHaveLength(1);
  });

  // ── Duplicate rowType inputs ─────────────────────────────────────────────────

  it("produces no duplicate outputs when given duplicate rowType inputs", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "asbestos", discipline: "ASB" },
      { rowType: "asbestos", discipline: "ASB" },
      { rowType: "asbestos", discipline: "ASB" }
    ]);
    const types = result.map((r) => r.type);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });

  // ── Excavation ──────────────────────────────────────────────────────────────

  it("includes excavation obligations for excavation rowType", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "excavation", discipline: "CIV" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("SWMS — Excavation");
    expect(types).toContain("Service disconnection certificate");
    expect(types).toContain("Dial Before You Dig");
  });

  it("includes excavation obligations for earthworks rowType", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "earthworks", discipline: "Other" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("SWMS — Excavation");
    expect(types).toContain("Service disconnection certificate");
    expect(types).toContain("Dial Before You Dig");
  });

  it("includes excavation obligations when discipline is CIV", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "general", discipline: "CIV" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("SWMS — Excavation");
    expect(types).toContain("Service disconnection certificate");
    expect(types).toContain("Dial Before You Dig");
  });

  // ── Cutting ─────────────────────────────────────────────────────────────────

  it("includes concrete cutting SWMS for cutting rowType", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "cutting", discipline: "Other" }
    ]);
    const types = result.map((r) => r.type);
    expect(types).toContain("SWMS — Concrete cutting");
  });

  // ── De-duplication is case-insensitive ───────────────────────────────────────

  it("deduplicates case-insensitively (baseline SWMS appears once regardless)", () => {
    const result = deriveComplianceSuggestions([
      { rowType: "general", discipline: "Other" },
      { rowType: "general", discipline: "Other" }
    ]);
    const baselineCount = result.filter(
      (r) => r.type.toLowerCase() === "swms — general site works"
    ).length;
    expect(baselineCount).toBe(1);
  });

  // ── Exported constants ───────────────────────────────────────────────────────

  it("exports SUGGESTION_ORIGIN = 'suggested'", () => {
    expect(SUGGESTION_ORIGIN).toBe("suggested");
  });

  it("exports MANUAL_ORIGIN = 'manual'", () => {
    expect(MANUAL_ORIGIN).toBe("manual");
  });
});
