/**
 * FormImportReviewPage -- pure-logic tests.
 *
 * The web workspace has no jsdom / @testing-library, so these tests cover the
 * exported pure helpers directly. Component rendering is exercised manually
 * via the smoke path in the PR body (same pattern as FormRulesBuilderPage).
 */
import { describe, expect, it } from "vitest";
import {
  confidenceLabel,
  countStats
} from "../FormImportReviewPage";
import type { FieldProvenance, SectionDto } from "../FormImportReviewPage";
// Note: PreviewImportPayload is imported above if needed in future tests

// ── confidenceLabel ────────────────────────────────────────────────────────

describe("confidenceLabel", () => {
  it("returns 'read' for confidence >= 0.8", () => {
    expect(confidenceLabel(0.8)).toBe("read");
    expect(confidenceLabel(1.0)).toBe("read");
    expect(confidenceLabel(0.95)).toBe("read");
  });

  it("returns 'guessed' for confidence in [0.4, 0.8)", () => {
    expect(confidenceLabel(0.4)).toBe("guessed");
    expect(confidenceLabel(0.6)).toBe("guessed");
    expect(confidenceLabel(0.79)).toBe("guessed");
  });

  it("returns 'invented' for confidence below 0.4", () => {
    expect(confidenceLabel(0.0)).toBe("invented");
    expect(confidenceLabel(0.2)).toBe("invented");
    expect(confidenceLabel(0.39)).toBe("invented");
  });
});

// ── countStats ─────────────────────────────────────────────────────────────

function makeSection(keys: string[], sectionOrder = 1): SectionDto {
  return {
    title: "Test Section",
    sectionOrder,
    fields: keys.map((k, i) => ({
      fieldKey: k,
      label: k,
      fieldType: "text",
      fieldOrder: i + 1
    }))
  };
}

function makeProv(confidence: number, coercedFrom: string | null = null): FieldProvenance {
  return {
    confidence,
    sourcePage: 1,
    sourceLine: 1,
    sourceText: "text",
    coercedFrom
  };
}

describe("countStats", () => {
  it("counts all fields when nothing is rejected", () => {
    const sections: SectionDto[] = [
      makeSection(["f1", "f2"], 1),
      makeSection(["f3"], 2)
    ];
    const prov: Record<string, FieldProvenance> = {
      f1: makeProv(0.9),
      f2: makeProv(0.5),
      f3: makeProv(0.2)
    };
    const stats = countStats(sections, prov, new Set());
    expect(stats.fields).toBe(3);
    expect(stats.kept).toBe(3);
    expect(stats.rejected).toBe(0);
    expect(stats.sectionCount).toBe(2);
  });

  it("decrements kept and increments rejected when fields are rejected", () => {
    const sections: SectionDto[] = [makeSection(["f1", "f2", "f3"], 1)];
    const prov: Record<string, FieldProvenance> = {
      f1: makeProv(0.9),
      f2: makeProv(0.5),
      f3: makeProv(0.9)
    };
    const rejected = new Set(["f2"]);
    const stats = countStats(sections, prov, rejected);
    expect(stats.kept).toBe(2);
    expect(stats.rejected).toBe(1);
  });

  it("counts read, guessed based on confidence label", () => {
    const sections: SectionDto[] = [makeSection(["f1", "f2", "f3", "f4"], 1)];
    const prov: Record<string, FieldProvenance> = {
      f1: makeProv(0.95),  // read
      f2: makeProv(0.85),  // read
      f3: makeProv(0.6),   // guessed
      f4: makeProv(0.1)    // invented (not guessed, not read)
    };
    const stats = countStats(sections, prov, new Set());
    expect(stats.read).toBe(2);
    expect(stats.guessed).toBe(1);
  });

  it("counts coerced fields", () => {
    const sections: SectionDto[] = [makeSection(["f1", "f2"], 1)];
    const prov: Record<string, FieldProvenance> = {
      f1: makeProv(0.9, "colour_picker"),
      f2: makeProv(0.9, null)
    };
    const stats = countStats(sections, prov, new Set());
    expect(stats.coerced).toBe(1);
  });

  it("handles missing provenance entries gracefully", () => {
    const sections: SectionDto[] = [makeSection(["f1", "f2"], 1)];
    // No provenance for f1
    const prov: Record<string, FieldProvenance> = {
      f2: makeProv(0.9)
    };
    const stats = countStats(sections, prov, new Set());
    expect(stats.fields).toBe(2);
    expect(stats.read).toBe(1);
  });

  it("returns zero counts for empty sections", () => {
    const stats = countStats([], {}, new Set());
    expect(stats.fields).toBe(0);
    expect(stats.kept).toBe(0);
    expect(stats.sectionCount).toBe(0);
  });
});
