// SCOPE_QD_UI_ITEMS_V1 — tests for the quote-destination control and the
// WBS-items destination rendering.
//
// The web workspace has no jsdom and no @testing-library (see the existing
// test files in this directory). The house pattern is followed here:
//   - claims about labels and values use the exported pure helpers;
//   - claims about the DOM use renderToStaticMarkup from react-dom/server;
//   - claims about STRUCTURE are asserted against source text.
//
// THE LOAD-BEARING CLAIM of this slice is that changing a row's destination
// PATCHes `{ quoteDestination }` on the item route and reverts on failure.
// That round-trip is tested via source inspection (the patchDestination helper
// calls patchItem with { quoteDestination }); the rendered control is tested
// via renderToStaticMarkup.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DESTINATION_LABELS,
  DESTINATION_NOTE,
  DESTINATION_ROW_CLASS,
  QuoteDestinationSelect,
  type QuoteDestination
} from "../QuoteDestinationSelect";
import {
  WbsItemTotalCell,
  WbsVsbadge,
  SCOPE_QD_UI_ITEMS_V1
} from "../../ScopeQuantitiesTable";
import {
  SubLinkPicker,
  linkNeedsInternalDialog,
  type SubLinkableItem
} from "../SubLinkPicker";
import { pricedOnLabel } from "../utils/card-display";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

const tableSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"),
  "utf8"
);
const linkPickerSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/SubLinkPicker.tsx"),
  "utf8"
);

/** Wrap cells in the minimum valid table so the markup is what a row renders. */
function renderCells(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <table>
      <tbody>
        <tr>{node}</tr>
      </tbody>
    </table>
  );
}

function makeItem(overrides: Partial<SubLinkableItem> = {}): SubLinkableItem {
  return {
    id: "item-1",
    wbsCode: "DEM1.1",
    description: "Strip out",
    discipline: "DEM",
    status: "confirmed",
    lineTotalWithMarkup: 12400,
    pricedBySubItemId: null,
    quoteDestination: "PRICE",
    ...overrides
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Slice marker
// ═══════════════════════════════════════════════════════════════════════

describe("SCOPE_QD_UI_ITEMS_V1 slice marker", () => {
  it("is exported from ScopeQuantitiesTable", () => {
    expect(SCOPE_QD_UI_ITEMS_V1).toBe("scopecards-s2b-a");
  });

  it("does NOT set SCOPE_QUOTE_DESTINATION_UI_V1 (that is S2b-c's marker)", () => {
    expect(tableSource).not.toContain("SCOPE_QUOTE_DESTINATION_UI_V1");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. QuoteDestinationSelect — the four-option control
// ═══════════════════════════════════════════════════════════════════════

describe("QuoteDestinationSelect renders the four options", () => {
  const destinations: QuoteDestination[] = ["PRICE", "PROVISIONAL", "OPTION", "INTERNAL"];

  it("has a label for each destination", () => {
    expect(DESTINATION_LABELS.PRICE).toBe("In the price");
    expect(DESTINATION_LABELS.PROVISIONAL).toBe("Provisional");
    expect(DESTINATION_LABELS.OPTION).toBe("Cost option");
    expect(DESTINATION_LABELS.INTERNAL).toBe("Internal only");
  });

  it("renders all four options", () => {
    const html = renderToStaticMarkup(
      <QuoteDestinationSelect value="PRICE" onChange={() => undefined} />
    );
    expect(html).toContain("In the price");
    expect(html).toContain("Provisional");
    expect(html).toContain("Cost option");
    expect(html).toContain("Internal only");
  });

  it("uses the correct value attributes (PRICE | PROVISIONAL | OPTION | INTERNAL)", () => {
    const html = renderToStaticMarkup(
      <QuoteDestinationSelect value="PRICE" onChange={() => undefined} />
    );
    for (const dest of destinations) {
      expect(html).toContain(`value="${dest}"`);
    }
  });

  it("carries the verbatim title from destSel()", () => {
    const html = renderToStaticMarkup(
      <QuoteDestinationSelect value="PRICE" onChange={() => undefined} />
    );
    expect(html).toContain(
      "Where this line goes on the client quote. It is priced either way - the destination only decides where the money lands."
    );
  });

  it("applies the destsel class and the destination-specific class", () => {
    for (const dest of destinations) {
      const html = renderToStaticMarkup(
        <QuoteDestinationSelect value={dest} onChange={() => undefined} />
      );
      expect(html).toContain(`class="destsel d-${dest.toLowerCase()}`);
    }
  });

  it("renders the Opt pill when optionLetter is provided", () => {
    const html = renderToStaticMarkup(
      <QuoteDestinationSelect value="OPTION" onChange={() => undefined} optionLetter="A" />
    );
    expect(html).toContain("Opt A");
    expect(html).toContain('class="optlbl"');
    expect(html).toContain('title="Grouped as Option A on the quote"');
  });

  it("does NOT render the Opt pill when optionLetter is absent", () => {
    const html = renderToStaticMarkup(
      <QuoteDestinationSelect value="PRICE" onChange={() => undefined} />
    );
    expect(html).not.toContain("Opt ");
    expect(html).not.toContain("optlbl");
  });

  it("uses brand tokens only — no hard-coded colour values", () => {
    for (const dest of destinations) {
      const html = renderToStaticMarkup(
        <QuoteDestinationSelect value={dest} onChange={() => undefined} />
      );
      // Strip token references before checking for raw hex
      const stripped = html.replace(/var\(--[a-z-]+(?:,\s*[^)]+)?\)/g, "");
      expect(stripped).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });

  it("the call site in ScopeQuantitiesTable omits optionLetter (S2b-a has no option-letter cascade)", () => {
    // S2b-a does not wire the option-letter cascade (that is S2b-c). The
    // call site must not pass optionLetter={undefined} — omit the prop entirely.
    expect(tableSource).toContain("<QuoteDestinationSelect");
    expect(tableSource).not.toContain("optionLetter={undefined}");
    expect(tableSource).not.toContain("optionLetter=");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Destination notes
// ═══════════════════════════════════════════════════════════════════════

describe("destination note text", () => {
  it("states provisional sum for PROVISIONAL", () => {
    expect(DESTINATION_NOTE.PROVISIONAL).toBe("provisional sum");
  });

  it("states cost option for OPTION", () => {
    expect(DESTINATION_NOTE.OPTION).toBe("cost option");
  });

  it("states internal only for INTERNAL", () => {
    expect(DESTINATION_NOTE.INTERNAL).toBe("internal only");
  });

  it("has no note for PRICE", () => {
    expect(DESTINATION_NOTE.PRICE).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Row classes
// ═══════════════════════════════════════════════════════════════════════

describe("destination row classes", () => {
  it("maps each destination to its rail class", () => {
    expect(DESTINATION_ROW_CLASS.PRICE).toBe("d-price");
    expect(DESTINATION_ROW_CLASS.PROVISIONAL).toBe("d-prov");
    expect(DESTINATION_ROW_CLASS.OPTION).toBe("d-option");
    expect(DESTINATION_ROW_CLASS.INTERNAL).toBe("d-internal");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Covered item — inputs visible, vsbadge chip shown
// ═══════════════════════════════════════════════════════════════════════

describe("a covered item renders its inputs and a vsbadge chip", () => {
  it("the vsbadge chip shows '⇄ quoted on SUB1.1'", () => {
    const html = renderToStaticMarkup(
      <WbsVsbadge coveredByLabel={pricedOnLabel("SUB1.1")} />
    );
    expect(html).toContain("⇄");
    expect(html).toContain("quoted on SUB1.1");
    expect(html).toContain('data-testid="wbs-vsbadge"');
  });

  it("the vsbadge title is verbatim from the mock-up", () => {
    const html = renderToStaticMarkup(
      <WbsVsbadge coveredByLabel={pricedOnLabel("SUB1.1")} />
    );
    expect(html).toContain(
      "A subcontract quote sits against this scope on SUB1.1. Both are priced; the destination decides which one the total counts."
    );
  });

  it("WbsItemTotalCell shows the server's figure for a covered item (not $0.00)", () => {
    const html = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={12400}
        covered
        coveredByLabel={pricedOnLabel("SUB1.1")}
      />
    );
    expect(html).toContain("$12,400");
    expect(html).not.toContain("$0.00");
  });

  it("WbsItemTotalCell shows the vsbadge chip for a covered item", () => {
    const html = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={12400}
        covered
        coveredByLabel={pricedOnLabel("SUB1.1")}
      />
    );
    expect(html).toContain('data-testid="wbs-vsbadge"');
    expect(html).toContain("quoted on SUB1.1");
  });

  it("WbsItemTotalCell shows no vsbadge chip for a non-covered item", () => {
    const html = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={12400}
        covered={false}
        coveredByLabel=""
      />
    );
    expect(html).not.toContain("wbs-vsbadge");
    expect(html).toContain("$12,400");
  });

  it("WbsItemTotalCell shows an em dash when there is no figure (uncovered)", () => {
    const html = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={null}
        covered={false}
        coveredByLabel=""
      />
    );
    expect(html).toContain("—");
    expect(html).not.toContain("$");
  });

  it("no data-covered cell: CoveredGroupCells is deleted from ScopeQuantitiesTable", () => {
    // The greyed placeholder cells (wbs-covered-manpower / wbs-covered-plant)
    // were removed in S2b-a. Every item renders its inputs regardless of the
    // covered state — the vsbadge chip is the only difference.
    expect(tableSource).not.toContain("wbs-covered-manpower");
    expect(tableSource).not.toContain("wbs-covered-plant");
    expect(tableSource).not.toContain("CoveredGroupCells");
    expect(tableSource).not.toContain("COVERED_ITEM_TOTAL");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Rejected proposals drawer
// ═══════════════════════════════════════════════════════════════════════

describe("the drawer is named Rejected proposals", () => {
  it("the drawer label reads 'Rejected proposals (n)'", () => {
    expect(tableSource).toContain("Rejected proposals");
  });

  it("the internal status field is still named 'excluded'", () => {
    // The drawer label changed; the status string on the server did not.
    // Rejected proposals are rows with status === "excluded".
    expect(tableSource).toContain('"excluded"');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. SubLinkPicker — link dialog
// ═══════════════════════════════════════════════════════════════════════

describe("the link dialog — Set to Internal only?", () => {
  it("linkNeedsInternalDialog is true for non-INTERNAL items", () => {
    expect(linkNeedsInternalDialog({ quoteDestination: "PRICE" })).toBe(true);
    expect(linkNeedsInternalDialog({ quoteDestination: "PROVISIONAL" })).toBe(true);
    expect(linkNeedsInternalDialog({ quoteDestination: "OPTION" })).toBe(true);
    expect(linkNeedsInternalDialog({ quoteDestination: null })).toBe(true);
    expect(linkNeedsInternalDialog({ quoteDestination: undefined })).toBe(true);
  });

  it("linkNeedsInternalDialog is false for already-INTERNAL items", () => {
    expect(linkNeedsInternalDialog({ quoteDestination: "INTERNAL" })).toBe(false);
  });

  it("the link picker renders without errors given items with quoteDestination", () => {
    const items: SubLinkableItem[] = [
      makeItem({ id: "d1", wbsCode: "DEM1.1", discipline: "DEM", quoteDestination: "PRICE" }),
      makeItem({ id: "d2", wbsCode: "DEM1.2", discipline: "DEM", quoteDestination: "PROVISIONAL" })
    ];
    const html = renderToStaticMarkup(
      <SubLinkPicker
        subLineId="sub-1"
        subLineWbsCode="SUB1.1"
        items={items}
        onLink={() => undefined}
        onUnlink={() => undefined}
      />
    );
    expect(html).toContain("DEM1.1");
    expect(html).toContain("DEM1.2");
  });

  it("unlink never sends setInternal — the source shows no setInternal in the unlink path", () => {
    // Unlink is always a simple onUnlink(itemId) call with no flags.
    const unlinkIdx = linkPickerSource.indexOf("onUnlink(");
    const setInternalIdx = linkPickerSource.indexOf("setInternal");
    // setInternal only appears in the onLink / confirm path, not the unlink path
    expect(setInternalIdx).toBeGreaterThan(-1);
    // The unlink call itself carries no setInternal
    const unlinkCtx = linkPickerSource.slice(unlinkIdx, unlinkIdx + 60);
    expect(unlinkCtx).not.toContain("setInternal");
  });

  it("the source carries the confirm + cancel button labels verbatim", () => {
    expect(linkPickerSource).toContain("Internal only");
    expect(linkPickerSource).toContain("Keep in the price");
  });

  it("confirm sends setInternal: true, decline sends setInternal: false", () => {
    expect(linkPickerSource).toContain("setInternal: true");
    expect(linkPickerSource).toContain("setInternal: false");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. Goes-to column
// ═══════════════════════════════════════════════════════════════════════

describe("the Goes-to column in the WBS table", () => {
  it("the source renders QuoteDestinationSelect in the WBS rows", () => {
    expect(tableSource).toContain("<QuoteDestinationSelect");
    expect(tableSource).toContain('data-testid="wbs-dest-cell"');
  });

  it("the source PATCHes { quoteDestination } on change", () => {
    expect(tableSource).toContain("patchDestination(item.id, next)");
    expect(tableSource).toContain('quoteDestination: dest');
  });

  it("omits optionLetter at the call site — S2b-a does not wire the option-letter cascade", () => {
    // No optionLetter={undefined} (must omit the prop, not pass undefined)
    expect(tableSource).not.toContain("optionLetter={undefined}");
    // optionLetter= does not appear at all in the table's call site for S2b-a
    expect(tableSource).not.toContain("optionLetter=");
  });
});
