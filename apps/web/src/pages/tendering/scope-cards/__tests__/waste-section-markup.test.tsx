// SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — S3 tests for ScopeWasteTab.
//
// Source assertions and pure helper tests for the per-line markup column.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  sumWasteLineTotals,
  WasteSectionSummary,
  fmtWasteMoney
} from "../../ScopeWasteTab";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

const wasteTabSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeWasteTab.tsx"),
  "utf-8"
);

// ── Source assertions ────────────────────────────────────────────────────

describe("S3: ScopeWasteTab source assertions", () => {
  it("MARKUP column is present", () => {
    expect(wasteTabSource).toContain('"Markup"');
  });

  it("does not use computeWithMarkup (browser pricing removed in S3)", () => {
    expect(wasteTabSource).not.toContain("computeWithMarkup");
  });

  it("does not multiply lineTotal in the browser (* (1 +)", () => {
    expect(wasteTabSource).not.toContain("* (1 +");
  });

  it("uses lineTotalWithMarkup from server for section total", () => {
    expect(wasteTabSource).toContain("lineTotalWithMarkup");
  });

  it("waste-row-markup cell is rendered", () => {
    expect(wasteTabSource).toContain('data-testid="waste-row-markup"');
  });
});

// ── WasteSectionSummary — withMarkup prop ────────────────────────────────

describe("WasteSectionSummary — withMarkup from server", () => {
  it("shows withMarkup figure from server (not computeWithMarkup)", () => {
    const html = renderToStaticMarkup(
      <WasteSectionSummary
        discipline="DEM"
        lineCount={2}
        subtotal={1000}
        withMarkup={1250}
        sectionMarkupOverride={null}
        tenderMarkup={30}
        collapsed={false}
      />
    );
    // The displayed figure should be the server's withMarkup, not subtotal*1.3
    expect(html).toContain("$1,250.00");
    expect(html).not.toContain("$1,300.00"); // would be computeWithMarkup(1000, null, 30)
  });

  it("falls back to subtotal when withMarkup is not provided", () => {
    const html = renderToStaticMarkup(
      <WasteSectionSummary
        discipline="DEM"
        lineCount={1}
        subtotal={500}
        tenderMarkup={30}
        collapsed={false}
      />
    );
    expect(html).toContain("$500.00");
  });
});

// ── sumWasteLineTotals stays on lineTotal (cost engine) ─────────────────

describe("sumWasteLineTotals — unchanged cost-engine total", () => {
  it("sums lineTotal (not lineTotalWithMarkup) — cost engine unchanged", () => {
    const rows = [
      { lineTotal: "400.00" },
      { lineTotal: "600.00" }
    ];
    expect(sumWasteLineTotals(rows)).toBe(1000);
  });
});
