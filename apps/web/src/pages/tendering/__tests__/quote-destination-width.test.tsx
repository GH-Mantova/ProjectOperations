// WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- Tests for the "Goes to" column
// width fix on QuoteDestinationSelect.
//
// House pattern (no jsdom / no @testing-library): pure helper assertions,
// renderToStaticMarkup, and source text assertions.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  QuoteDestinationSelect,
  DESTINATION_LABELS,
  type QuoteDestination
} from "../scope-cards/QuoteDestinationSelect";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../${relFromRepoRoot}`, import.meta.url));

const selectSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/QuoteDestinationSelect.tsx"),
  "utf-8"
);
const wasteSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeWasteTab.tsx"),
  "utf-8"
);
const cuttingSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeCuttingSheet.tsx"),
  "utf-8"
);
const quantitiesSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"),
  "utf-8"
);
const otherCostsSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
  "utf-8"
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. The shared select carries minWidth 96 and maxWidth 112
// ─────────────────────────────────────────────────────────────────────────────

describe("QuoteDestinationSelect width constraint (WASTE_PANEL_LAYOUT_V1)", () => {
  it("baseSelectStyle carries minWidth 96 in the source", () => {
    // Discipline Cards mock-up v26 .destsel specifies these values.
    expect(selectSource).toContain("minWidth: 96");
  });

  it("baseSelectStyle carries maxWidth 112 in the source", () => {
    expect(selectSource).toContain("maxWidth: 112");
  });

  it("the rendered select carries inline minWidth and maxWidth styles", () => {
    const html = renderToStaticMarkup(
      <QuoteDestinationSelect value="PRICE" onChange={() => undefined} />
    );
    expect(html).toContain("min-width:96px");
    expect(html).toContain("max-width:112px");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. All four DESTINATION_LABELS render in full on each of the four screens
// ─────────────────────────────────────────────────────────────────────────────

describe("DESTINATION_LABELS render in full for each destination", () => {
  const destinations: QuoteDestination[] = ["PRICE", "PROVISIONAL", "OPTION", "INTERNAL"];

  it("each destination renders its full label text", () => {
    for (const dest of destinations) {
      const html = renderToStaticMarkup(
        <QuoteDestinationSelect value={dest} onChange={() => undefined} />
      );
      // Every label must appear (all four options are always rendered)
      expect(html).toContain(DESTINATION_LABELS.PRICE);
      expect(html).toContain(DESTINATION_LABELS.PROVISIONAL);
      expect(html).toContain(DESTINATION_LABELS.OPTION);
      expect(html).toContain(DESTINATION_LABELS.INTERNAL);
    }
  });

  it("the four screens each use QuoteDestinationSelect", () => {
    // ScopeWasteTab
    expect(wasteSource).toContain("<QuoteDestinationSelect");
    // ScopeCuttingSheet
    expect(cuttingSource).toContain("<QuoteDestinationSelect");
    // ScopeQuantitiesTable
    expect(quantitiesSource).toContain("<QuoteDestinationSelect");
    // OtherOperationalCosts
    expect(otherCostsSource).toContain("<QuoteDestinationSelect");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The waste table header for Goes-to has no 1% width
// ─────────────────────────────────────────────────────────────────────────────

describe("waste table Goes-to header has no 1% width (WASTE_PANEL_LAYOUT_V1)", () => {
  it('the "1%" width is not in ScopeWasteTab source', () => {
    // Before S8j the header had width: "1%" on the Goes to column.
    // After S8j it is removed; the shared select's minWidth does the job.
    expect(wasteSource).not.toContain('"1%"');
  });

  it('the "Goes to" header still exists in ScopeWasteTab', () => {
    expect(wasteSource).toContain('"Goes to"');
  });
});
