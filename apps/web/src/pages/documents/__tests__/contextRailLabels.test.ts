import { describe, expect, it } from "vitest";
import { resolveContextRailLabel } from "../contextRailLabels";

describe("resolveContextRailLabel", () => {
  it("splits a `CODE - Name` entity summary into label and subLabel", () => {
    const result = resolveContextRailLabel(
      { entitySummary: { title: "JOB-2026-001 - North precinct services package" } },
      "doc-1"
    );
    expect(result).toEqual({ label: "JOB-2026-001", subLabel: "North precinct services package" });
  });

  it("returns the whole summary as the label when there is no ` - ` separator", () => {
    const result = resolveContextRailLabel(
      { entitySummary: { title: "FRM-INDUCTION submission" } },
      "submission-1"
    );
    expect(result).toEqual({ label: "FRM-INDUCTION submission" });
  });

  it("preserves trailing dashes inside the parent name", () => {
    const result = resolveContextRailLabel(
      { entitySummary: { title: "TND-2026-014 - Stage 2 - civil works" } },
      "doc-2"
    );
    expect(result).toEqual({ label: "TND-2026-014", subLabel: "Stage 2 - civil works" });
  });

  it("falls back to the parent folder segment when no entity summary is present", () => {
    const result = resolveContextRailLabel(
      {
        entitySummary: null,
        folderLink: { relativePath: "Project Operations/Jobs/JOB-2026-005_north-precinct/Documents" }
      },
      "doc-3"
    );
    expect(result).toEqual({ label: "JOB-2026-005_north-precinct" });
  });

  it("falls back to a truncated entity id when nothing else is available", () => {
    const result = resolveContextRailLabel(
      { entitySummary: null, folderLink: null },
      "abcdef1234567890"
    );
    expect(result).toEqual({ label: "abcdef1234" });
  });
});
