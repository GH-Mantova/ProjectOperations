// SCOPE_SUB_TAB_V1 — the SUB tab: link the work, list the quotes.
//
// scope-subcontracted slice 5. Slice 4 shipped the link field, the quote
// table, the double-count guard and the endpoints — all proven, all
// unreachable from the screen. These tests are about the screen.
//
// The web workspace has no jsdom and no @testing-library (see
// discipline-summary-bar.test.tsx, other-operational-costs.test.tsx and
// cutting-section.test.tsx). The house pattern is followed here:
//   - a claim about a NUMBER or a STRING is tested against the exported pure
//     helpers;
//   - a claim about the DOM — "the covered row reads $0.00 and not an em dash"
//     — uses renderToStaticMarkup from react-dom/server, which needs no DOM,
//     against the very components ScopeQuantitiesTable renders;
//   - a claim about STRUCTURE — "the supplier picker is the shared one, not a
//     second one" — is asserted against the source, because with no renderer
//     there is no other way to pin a provenance.
//
// THE LOAD-BEARING CLAIM of this slice is a DISTINCTION, and it is asserted
// three times below: a covered item's Item total reads `$0.00`, it does NOT
// read an em dash, and the cell is NOT empty. Everywhere else in that column a
// missing figure is an em dash. A covered item is not missing a figure — it is
// priced, by the SUB line named beside it, at nothing here. If the covered row
// looked like an unpriced row the guard would be invisible, and an invisible
// guard reads as a bug.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CoveredGroupCells,
  WbsItemTotalCell,
  WBS_COLUMN_COUNT
} from "../../ScopeQuantitiesTable";
import {
  COVERED_ITEM_TOTAL,
  isCoveredBySubLine,
  pricedOnLabel,
  subMoney
} from "../utils/card-display";
import {
  SubLinkPicker,
  candidateOptionLabel,
  groupCandidatesByDiscipline,
  linkCandidatesForSubLine,
  linkedItemsForSubLine,
  type SubLinkableItem
} from "../SubLinkPicker";
import {
  SubQuotePicker,
  SubQuoteRow,
  formatQuoteDelta,
  quoteAmount,
  quoteDeltaAgainstSelected,
  selectedSubLineQuote,
  subLineHasUnselectedQuotes,
  subLineIncompleteNote,
  supplierPickerOptions,
  toDateInputValue,
  type SubLineQuote
} from "../SubQuotePicker";

const EM_DASH = "—";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

const tableSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"),
  "utf8"
);
const quotePickerSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/SubQuotePicker.tsx"),
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
    id: "item-dem-2",
    wbsCode: "DEM1.2",
    description: "Strip out internal walls",
    discipline: "DEM",
    status: "confirmed",
    lineTotalWithMarkup: 12400,
    pricedBySubItemId: null,
    ...overrides
  };
}

function makeQuote(overrides: Partial<SubLineQuote> = {}): SubLineQuote {
  return {
    id: "q1",
    scopeItemId: "sub-1",
    subcontractorSupplierId: null,
    supplierNameFallback: "Acme Demolition",
    amount: "55600.00",
    isSelected: false,
    receivedAt: null,
    notes: null,
    tenderDocumentLinkId: null,
    ...overrides
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. The covered row — the single most important piece of this slice
// ═══════════════════════════════════════════════════════════════════════

describe("a covered item announces itself on its OWN discipline tab", () => {
  it("replaces the Manpower and Plant column groups with 'priced on SUB1.1'", () => {
    const html = renderCells(
      <CoveredGroupCells rowCount={1} coveredByLabel={pricedOnLabel("SUB1.1")} />
    );

    // Across BOTH groups — the estimator scanning either half of the row sees
    // why it is empty without having to look at the other.
    expect(html).toContain('data-testid="wbs-covered-manpower"');
    expect(html).toContain('data-testid="wbs-covered-plant"');
    const occurrences = html.split("priced on SUB1.1").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("spans exactly the six Manpower and five Plant columns", () => {
    const html = renderCells(
      <CoveredGroupCells rowCount={1} coveredByLabel={pricedOnLabel("SUB1.1")} />
    );
    expect(html).toContain('colSpan="6"');
    expect(html).toContain('colSpan="5"');
    // 6 + 5 = the eleven columns between Description and Markup; the other
    // five (WBS, Description, Markup, Item total, Actions) are untouched.
    expect(WBS_COLUMN_COUNT).toBe(16);
  });

  it("spans every row of a multi-row item, because the statement is about the item", () => {
    const html = renderCells(
      <CoveredGroupCells rowCount={3} coveredByLabel={pricedOnLabel("SUB1.1")} />
    );
    expect(html).toContain('rowSpan="3"');
  });

  it("greys itself with theme-flipping brand tokens, never a hardcoded colour", () => {
    const html = renderCells(
      <CoveredGroupCells rowCount={1} coveredByLabel={pricedOnLabel("SUB1.1")} />
    );
    expect(html).toContain("var(--surface-subtle)");
    expect(html).toContain("var(--text-secondary)");
    // Both tokens are redefined under [data-theme="dark"] AND under
    // prefers-color-scheme: dark in tokens.css, so the greyed state stays
    // legible in either theme.
    const tokens = readFileSync(repoFile("apps/web/src/styles/tokens.css"), "utf8");
    const dark = tokens.slice(tokens.indexOf(':root[data-theme="dark"]'));
    expect(dark).toContain("--surface-subtle:");
    expect(dark).toContain("--text-secondary:");
    // Every colour the cell states is a token. The only `#` in the markup is
    // the legacy fallback inside `var(--border-default, #e5e7eb)`, which the
    // table's own shared border style has carried since SCOPE_WBS_TABLE_V1 —
    // this slice states no colour of its own.
    for (const decl of ["color:", "background:"]) {
      const at = html.indexOf(decl);
      expect(at).toBeGreaterThan(-1);
      expect(html.slice(at + decl.length, at + decl.length + 6)).toBe("var(--");
    }
    expect(html.replace(/var\(--[a-z-]+, #[0-9a-fA-F]{3,8}\)/g, "")).not.toMatch(
      /#[0-9a-fA-F]{3,8}/
    );
  });

  it("removes the manpower and plant inputs rather than greying them in place", () => {
    const html = renderCells(
      <CoveredGroupCells rowCount={1} coveredByLabel={pricedOnLabel("SUB1.1")} />
    );
    // A disabled-looking day-rate box still reads as a number that counts.
    // Nothing on a covered item's labour or plant counts.
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
  });

  it("names the SUB line, and degrades honestly when the link target is missing", () => {
    expect(pricedOnLabel("SUB1.1")).toBe("priced on SUB1.1");
    expect(pricedOnLabel("SUB2.3")).toBe("priced on SUB2.3");
    // Never "priced on undefined".
    expect(pricedOnLabel(undefined)).toBe("priced on a subcontract line");
    expect(pricedOnLabel(null)).toBe("priced on a subcontract line");
    expect(pricedOnLabel("  ")).toBe("priced on a subcontract line");
  });
});

describe("a covered item's Item total reads $0.00 — not an em dash, not blank", () => {
  const coveredHtml = renderCells(
    <WbsItemTotalCell
      rowCount={1}
      // The server has not zeroed this figure; the guard has. Whatever the
      // read carries, a covered row states the guard's answer.
      lineTotalWithMarkup={12400}
      covered
      coveredByLabel={pricedOnLabel("SUB1.1")}
    />
  );

  it("renders exactly $0.00", () => {
    expect(COVERED_ITEM_TOTAL).toBe("$0.00");
    expect(coveredHtml).toContain("$0.00");
  });

  it("does NOT render an em dash", () => {
    // The em dash is this column's "there is no number here". A covered item
    // HAS a number. This is the distinction the whole slice turns on.
    expect(coveredHtml).not.toContain(EM_DASH);
  });

  it("does NOT render an empty cell", () => {
    const cell = coveredHtml.slice(coveredHtml.indexOf("<td"), coveredHtml.indexOf("</td>"));
    expect(cell).not.toMatch(/>\s*$/);
    // The text content between the tags is non-empty and is the figure.
    // Strip the tags to a FIXED POINT, not in one pass. A single
    // replace(/<[^>]*>/g, "") is incomplete: removing one match can splice
    // its neighbours into a fresh tag, which is exactly what CodeQL's
    // js/incomplete-multi-character-sanitization reports. Repeat until the
    // string stops changing and the strip is complete.
    let stripped = coveredHtml;
    for (let previous = null; previous !== stripped; ) {
      previous = stripped;
      stripped = stripped.replace(/<[^>]*>/g, "");
    }
    const text = stripped.trim();
    expect(text).not.toBe("");
    expect(text).toBe("$0.00");
  });

  it("does not round the zero away — two decimals, unlike the rest of the column", () => {
    // fmtCurrency in ScopeQuantitiesTable is maximumFractionDigits: 0, which
    // would print "$0". "$0.00" cannot be misread as a figure that rounded
    // down to nothing.
    expect(COVERED_ITEM_TOTAL).not.toBe("$0");
    expect(subMoney(0)).toBe("$0.00");
  });

  it("marks the cell as covered so the state is addressable, not just visible", () => {
    expect(coveredHtml).toContain('data-covered="true"');
    expect(coveredHtml).toContain("priced by the subcontract quote on SUB1.1");
  });

  it("still prints an em dash for an UNCOVERED item with no figure — the contrast is the point", () => {
    const uncovered = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={null}
        covered={false}
        coveredByLabel=""
      />
    );
    expect(uncovered).toContain(EM_DASH);
    expect(uncovered).not.toContain("$0.00");
    expect(uncovered).toContain('data-covered="false"');
  });

  it("prints the server's figure, unchanged, for an uncovered priced item", () => {
    const priced = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={12400}
        covered={false}
        coveredByLabel=""
      />
    );
    expect(priced).toContain("$12,400");
    expect(priced).not.toContain("$0.00");
  });
});

describe("unlinking restores the row", () => {
  it("the covered state is the server's flag and nothing else", () => {
    expect(isCoveredBySubLine({ pricedBySubItemId: "sub-1" })).toBe(true);
    expect(isCoveredBySubLine({ pricedBySubItemId: null })).toBe(false);
    expect(isCoveredBySubLine({})).toBe(false);
  });

  it("an item whose link is cleared renders its own figure again, not $0.00", () => {
    const linked = makeItem({ pricedBySubItemId: "sub-1" });
    const unlinked = makeItem({ pricedBySubItemId: null });

    const linkedHtml = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={linked.lineTotalWithMarkup as number}
        covered={isCoveredBySubLine(linked)}
        coveredByLabel={pricedOnLabel("SUB1.1")}
      />
    );
    const unlinkedHtml = renderCells(
      <WbsItemTotalCell
        rowCount={1}
        lineTotalWithMarkup={unlinked.lineTotalWithMarkup as number}
        covered={isCoveredBySubLine(unlinked)}
        coveredByLabel=""
      />
    );

    expect(linkedHtml).toContain("$0.00");
    expect(unlinkedHtml).toContain("$12,400");
    expect(unlinkedHtml).not.toContain("$0.00");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. SubLinkPicker — what a subcontract line covers
// ═══════════════════════════════════════════════════════════════════════

describe("SubLinkPicker — which items may be linked", () => {
  const items: SubLinkableItem[] = [
    makeItem({ id: "dem-1", wbsCode: "DEM1.1", discipline: "DEM" }),
    makeItem({ id: "dem-2", wbsCode: "DEM1.2", discipline: "DEM" }),
    makeItem({ id: "civ-1", wbsCode: "CIV1.1", discipline: "CIV" }),
    // Already covered by ANOTHER subcontract line.
    makeItem({ id: "asb-1", wbsCode: "ASB1.1", discipline: "ASB", pricedBySubItemId: "sub-9" }),
    // Covered by THIS line — shown as linked, not offered again.
    makeItem({ id: "dem-3", wbsCode: "DEM1.3", discipline: "DEM", pricedBySubItemId: "sub-1" }),
    makeItem({ id: "dem-4", wbsCode: "DEM1.4", discipline: "DEM", status: "excluded" }),
    // A subcontract line is not a candidate for another subcontract line.
    makeItem({ id: "sub-2", wbsCode: "SUB1.2", discipline: "SUB" })
  ];

  it("excludes items already linked to another SUB line", () => {
    const ids = linkCandidatesForSubLine(items).map((i) => i.id);
    expect(ids).not.toContain("asb-1");
  });

  it("excludes items already linked to THIS line — they are in the linked list instead", () => {
    const ids = linkCandidatesForSubLine(items).map((i) => i.id);
    expect(ids).not.toContain("dem-3");
    expect(linkedItemsForSubLine(items, "sub-1").map((i) => i.id)).toEqual(["dem-3"]);
  });

  it("excludes excluded items and other SUB lines", () => {
    const ids = linkCandidatesForSubLine(items).map((i) => i.id);
    expect(ids).not.toContain("dem-4");
    expect(ids).not.toContain("sub-2");
  });

  it("offers everything else", () => {
    expect(linkCandidatesForSubLine(items).map((i) => i.id)).toEqual(["dem-1", "dem-2", "civ-1"]);
  });

  it("groups the offer by discipline, in the canonical tab order", () => {
    const groups = groupCandidatesByDiscipline(linkCandidatesForSubLine(items));
    expect(groups.map((g) => g.discipline)).toEqual(["DEM", "CIV"]);
    expect(groups[0].label).toBe("Demolition");
    expect(groups[1].label).toBe("Civil works");
  });

  it("shows each item's CURRENT price, so the estimator sees what they are about to move", () => {
    expect(candidateOptionLabel(makeItem({ lineTotalWithMarkup: 12400 }))).toBe(
      "DEM1.2 — Strip out internal walls · $12,400.00"
    );
    // A figure the API has not sent is a dash, never a fabricated zero.
    expect(candidateOptionLabel(makeItem({ lineTotalWithMarkup: null }))).toContain("· —");
  });

  it("renders the offer grouped, with the prices, and the linked item with a way out", () => {
    const html = renderToStaticMarkup(
      <SubLinkPicker
        subLineId="sub-1"
        subLineWbsCode="SUB1.1"
        items={items}
        onLink={() => undefined}
        onUnlink={() => undefined}
      />
    );
    expect(html).toContain('<optgroup label="DEM — Demolition"');
    expect(html).toContain('<optgroup label="CIV — Civil works"');
    expect(html).toContain("DEM1.1 — Strip out internal walls · $12,400.00");
    expect(html).toContain("Unlink DEM1.3 from SUB1.1");
    // The item spoken for by SUB1.9 is nowhere in the control.
    expect(html).not.toContain("ASB1.1");
  });

  it("says a line with no links is describing its own scope", () => {
    const html = renderToStaticMarkup(
      <SubLinkPicker
        subLineId="sub-77"
        subLineWbsCode="SUB2.1"
        items={items}
        onLink={() => undefined}
        onUnlink={() => undefined}
      />
    );
    expect(html).toContain('data-testid="sub-link-own-scope"');
    expect(html).toContain("SUB2.1 describes its own scope");
  });

  it("computes no money — it only formats what the API sent", () => {
    // Every price the picker prints reaches the screen through subMoney(),
    // and the only thing between the wire and subMoney is toAmount(), which
    // parses a Decimal string. Nothing folds, sums or scales a figure: a
    // second implementation of the server's arithmetic is how the two drift.
    const uses = linkPickerSource.match(/lineTotalWithMarkup/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    expect(linkPickerSource).toContain("subMoney(toAmount(item.lineTotalWithMarkup))");
    expect(linkPickerSource).not.toContain("reduce(");
    expect(linkPickerSource).not.toContain("+=");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. SubQuotePicker — the spread, and the incomplete state
// ═══════════════════════════════════════════════════════════════════════

describe("quote deltas re-base on the selected quote", () => {
  const quotes: SubLineQuote[] = [
    makeQuote({ id: "q1", supplierNameFallback: "Acme", amount: "55600.00", isSelected: true }),
    makeQuote({ id: "q2", supplierNameFallback: "Brava", amount: "59800.00" }),
    makeQuote({ id: "q3", supplierNameFallback: "Corvo", amount: "54450.00" })
  ];

  it("reads the amount off the wire's Decimal string", () => {
    expect(quoteAmount(quotes[0])).toBe(55600);
    expect(quoteAmount(makeQuote({ amount: 42 }))).toBe(42);
    expect(quoteAmount(makeQuote({ amount: "not a number" }))).toBe(0);
  });

  it("finds the one selected quote", () => {
    expect(selectedSubLineQuote(quotes)?.id).toBe("q1");
    expect(selectedSubLineQuote([])).toBeNull();
  });

  it("gives the selected row no delta — it IS the baseline", () => {
    expect(quoteDeltaAgainstSelected(quotes[0], quotes)).toBeNull();
  });

  it("states every other row's difference against it", () => {
    expect(quoteDeltaAgainstSelected(quotes[1], quotes)).toBe(4200);
    expect(quoteDeltaAgainstSelected(quotes[2], quotes)).toBe(-1150);
    expect(formatQuoteDelta(4200)).toBe("+$4,200");
    expect(formatQuoteDelta(-1150)).toBe("-$1,150");
  });

  it("RE-BASES every delta when a different quote is selected", () => {
    const rebased: SubLineQuote[] = [
      { ...quotes[0], isSelected: false },
      { ...quotes[1], isSelected: true },
      { ...quotes[2], isSelected: false }
    ];
    // Baseline moves from 55,600 to 59,800, so every figure moves with it.
    expect(quoteDeltaAgainstSelected(rebased[1], rebased)).toBeNull();
    expect(quoteDeltaAgainstSelected(rebased[0], rebased)).toBe(-4200);
    expect(quoteDeltaAgainstSelected(rebased[2], rebased)).toBe(-5350);
    expect(formatQuoteDelta(-4200)).toBe("-$4,200");
    expect(formatQuoteDelta(-5350)).toBe("-$5,350");
  });

  it("has no delta to state while nothing is selected — 'cheaper than what?'", () => {
    const none = quotes.map((q) => ({ ...q, isSelected: false }));
    for (const q of none) expect(quoteDeltaAgainstSelected(q, none)).toBeNull();
    expect(formatQuoteDelta(null)).toBe(EM_DASH);
  });

  it("says 'same' for an exact tie rather than '+$0'", () => {
    expect(formatQuoteDelta(0)).toBe("same");
    expect(formatQuoteDelta(0.2)).toBe("same");
  });

  it("renders the spread down the column", () => {
    const html = renderToStaticMarkup(
      <SubQuotePicker
        subLineWbsCode="SUB1.1"
        quotes={quotes}
        supplierOptions={[]}
        documentOptions={[]}
        onPatch={() => undefined}
        onSelect={() => undefined}
        onRemove={() => undefined}
        onAdd={() => undefined}
      />
    );
    expect(html).toContain("+$4,200");
    expect(html).toContain("-$1,150");
    expect(html).toContain('data-selected="true"');
  });
});

describe("a SUB line with quotes and none selected is visibly incomplete", () => {
  const unselected = [
    makeQuote({ id: "q1", amount: "55600.00" }),
    makeQuote({ id: "q2", amount: "59800.00" })
  ];

  it("recognises the state", () => {
    expect(subLineHasUnselectedQuotes(unselected)).toBe(true);
    // A line with no quotes at all is not "incomplete" — it is empty, and that
    // is a different (and honest) state.
    expect(subLineHasUnselectedQuotes([])).toBe(false);
    expect(subLineHasUnselectedQuotes([{ ...unselected[0], isSelected: true }])).toBe(false);
  });

  it("says what it prices at, in words, so a zero cannot read as free", () => {
    const note = subLineIncompleteNote(unselected);
    expect(note).toContain("2 quotes received and none selected");
    expect(note).toContain("$0.00");
    expect(note).toContain("Pick the quote the tender carries");
    expect(subLineIncompleteNote([unselected[0]])).toContain("1 quote received");
  });

  it("surfaces it the way the card already surfaces incomplete state — a muted note, no new alert", () => {
    const html = renderToStaticMarkup(
      <SubQuotePicker
        subLineWbsCode="SUB1.1"
        quotes={unselected}
        supplierOptions={[]}
        documentOptions={[]}
        onPatch={() => undefined}
        onSelect={() => undefined}
        onRemove={() => undefined}
        onAdd={() => undefined}
      />
    );
    expect(html).toContain('data-testid="sub-quote-incomplete-note"');
    expect(html).toContain('data-incomplete="true"');
    expect(html).toContain("var(--text-muted)");
    // CuttingSection's unpriced note is the pattern being reused: muted type,
    // in the section, under the table. Not a banner, not a modal, not a toast.
    const cutting = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx"),
      "utf8"
    );
    expect(cutting).toContain("cutting-section-unpriced-note");
    expect(quotePickerSource).not.toMatch(/role="alert"/);
  });

  it("drops the note the moment a quote is selected", () => {
    const html = renderToStaticMarkup(
      <SubQuotePicker
        subLineWbsCode="SUB1.1"
        quotes={[{ ...unselected[0], isSelected: true }, unselected[1]]}
        supplierOptions={[]}
        documentOptions={[]}
        onPatch={() => undefined}
        onSelect={() => undefined}
        onRemove={() => undefined}
        onAdd={() => undefined}
      />
    );
    expect(html).not.toContain('data-testid="sub-quote-incomplete-note"');
    expect(html).toContain('data-incomplete="false"');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. One picker, shared — not a second one grown here
// ═══════════════════════════════════════════════════════════════════════

describe("the supplier picker is pr-cardui-s6's shared picker", () => {
  it("is IMPORTED from OtherOperationalCosts, not re-implemented", () => {
    expect(quotePickerSource).toContain(
      'import { RateLibraryItemPicker, type RateLibraryItem } from "./OtherOperationalCosts"'
    );
    expect(quotePickerSource).toContain("<RateLibraryItemPicker");
    // No second picker grew in this file.
    expect(quotePickerSource).not.toContain("function RateLibraryItemPicker");
    expect(quotePickerSource).not.toContain("optgroup");
  });

  it("names its rows with the prefix the shared picker's own contract test pins", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <SubQuoteRow
            quote={makeQuote()}
            quotes={[makeQuote()]}
            rowIndex={1}
            supplierOptions={supplierPickerOptions([
              { id: "s1", name: "Acme Demolition", categories: ["Demolition"] }
            ])}
            documentOptions={[]}
            onPatch={() => undefined}
            onSelect={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    // other-operational-costs.test.tsx already renders the shared picker as
    // "Item for subcontract quote row 1" to pin exactly this contract.
    expect(html).toContain("Item for subcontract quote row 1 — pick from the rate library");
    expect(html).toContain("Item for subcontract quote row 1 — description");
    expect(html).toContain("Acme Demolition");
  });

  it("maps the directory onto the picker's shape without inventing a rate", () => {
    const options = supplierPickerOptions([
      { id: "s1", name: "Acme Demolition", categories: ["Demolition", "Asbestos"] },
      { id: "s2", name: "Brava Civil", categories: [], isActive: true }
    ]);
    expect(options[0]).toEqual({
      id: "s1",
      item: "Acme Demolition",
      unit: "",
      rate: 0,
      isActive: undefined,
      category: "Demolition"
    });
    expect(options[1].category).toBe("Subcontractors");
  });

  it("lets a vendor who is not in the directory be typed in", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <SubQuoteRow
            quote={makeQuote({
              subcontractorSupplierId: null,
              supplierNameFallback: "Vendor not in the directory yet"
            })}
            quotes={[makeQuote()]}
            rowIndex={2}
            supplierOptions={[]}
            documentOptions={[]}
            onPatch={() => undefined}
            onSelect={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    expect(html).toContain("Vendor not in the directory yet");
    expect(html).toContain("Item for subcontract quote row 2 — description");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. The quote row's other fields
// ═══════════════════════════════════════════════════════════════════════

describe("a quote row carries supplier, amount, received date, notes and a quote file", () => {
  const html = renderToStaticMarkup(
    <table>
      <tbody>
        <SubQuoteRow
          quote={makeQuote({
            receivedAt: "2026-03-14T00:00:00.000Z",
            notes: "Excludes traffic control",
            tenderDocumentLinkId: "doc-1"
          })}
          quotes={[makeQuote()]}
          rowIndex={1}
          supplierOptions={[]}
          documentOptions={[{ id: "doc-1", title: "Acme quote 14-03.pdf" }]}
          onPatch={() => undefined}
          onSelect={() => undefined}
          onRemove={() => undefined}
        />
      </tbody>
    </table>
  );

  it("shows the amount, the date and the notes", () => {
    expect(html).toContain('value="55600"');
    expect(html).toContain('value="2026-03-14"');
    expect(html).toContain("Excludes traffic control");
  });

  it("normalises an ISO timestamp for the date input", () => {
    expect(toDateInputValue("2026-03-14T00:00:00.000Z")).toBe("2026-03-14");
    expect(toDateInputValue("2026-03-14")).toBe("2026-03-14");
    expect(toDateInputValue(null)).toBe("");
  });

  it("names the attached tender document behind a magnifier", () => {
    expect(html).toContain("🔍");
    expect(html).toContain("Attach a tender document to subcontract quote row 1");
    expect(html).toContain("Acme quote 14-03.pdf");
  });

  it("attaches an EXISTING document and never uploads one", () => {
    expect(quotePickerSource).not.toContain('type="file"');
    expect(quotePickerSource).not.toContain("FormData");
    expect(quotePickerSource).toContain("tenderDocumentLinkId");
  });

  it("keeps the money columns from twitching as quotes are added", () => {
    // Marco's standing layout rule: fit to contents, then to window — a
    // minimum, never a fixed width, so a long figure grows its column rather
    // than spilling out of it.
    expect(quotePickerSource).toContain("minWidth: 96");
    expect(quotePickerSource).toContain("minWidth: 84");
    expect(quotePickerSource).not.toMatch(/width: "\d+px"/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Web-only, and priced by the server
// ═══════════════════════════════════════════════════════════════════════

describe("this slice adds no API and reprices nothing", () => {
  it("calls only the routes scope-subcontracted slice 4 shipped", () => {
    for (const route of [
      "/sub-link",
      "/quotes",
      "/quotes/${quoteId}",
      "/quotes/${quoteId}/select"
    ]) {
      expect(tableSource).toContain(route);
    }
    const controller = readFileSync(
      repoFile("apps/api/src/modules/tendering/scope/scope-cards.controller.ts"),
      "utf8"
    );
    expect(controller).toContain('@Post("items/:itemId/sub-link")');
    expect(controller).toContain('@Delete("items/:itemId/sub-link")');
    expect(controller).toContain('@Get("items/:itemId/quotes")');
    expect(controller).toContain('@Post("items/:itemId/quotes")');
    expect(controller).toContain('@Patch("quotes/:quoteId")');
    expect(controller).toContain('@Delete("quotes/:quoteId")');
    expect(controller).toContain('@Post("quotes/:quoteId/select")');
  });

  it("does not re-implement the double-count guard in TypeScript", () => {
    // The covered figure is a CONSTANT, not a sum. A second implementation of
    // slice 4's rule is exactly how the two drift.
    const cardDisplay = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/utils/card-display.ts"),
      "utf8"
    );
    expect(cardDisplay).toContain("export const COVERED_ITEM_TOTAL = subMoney(0);");
    expect(COVERED_ITEM_TOTAL).toBe("$0.00");
  });

  it("mounts both pickers on the SUB tab and nowhere else", () => {
    expect(tableSource).toContain("const isSubCard = discipline === \"SUB\";");
    expect(tableSource).toContain("const subRow = isSubCard ? (");
    expect(tableSource).toContain("<SubLinkPicker");
    expect(tableSource).toContain("<SubQuotePicker");
  });

  it("greys the covered groups on the DISCIPLINE tabs, which is where the number moved", () => {
    // The covered branch is in the WBS row loop, not behind a SUB-only gate:
    // a DEM row is exactly where an estimator is standing when they wonder why
    // the discipline total dropped.
    const rowLoop = tableSource.slice(tableSource.indexOf("const rows = Array.from("));
    expect(rowLoop).toContain("<CoveredGroupCells");
    expect(rowLoop).not.toContain("isSubCard ? <CoveredGroupCells");
  });
});
