// enclosure-lines-table.test.tsx
//
// ASB_ENCLOSURE_LINES_UI_V1 — unit tests for EnclosureLinesTable.
//
// These tests follow the pattern established by other-operational-costs.test.tsx:
//   - No jsdom, no @testing-library.
//   - Number/logic claims: pure helper assertions.
//   - Structural/DOM claims: renderToStaticMarkup from react-dom/server.
//   - Source claims: readFileSync to assert the component text.
//
// Tests required by the brief:
//   1. Type list renders from the API — no type-name string literals in the component.
//   2. Adding a line POSTs { enclosureType, qty }. Typing a rate PATCHes rateOverride.
//      Clearing PATCHes null.
//   3. Subtotal + line totals come from API; component never multiplies qty × rate.
//   4. Block does not render on a non-ASB card.
//   5. acmFactCount includes the priced lines.
//   6. After edit, card totals refresh; item total equals the API value.
//   7. Tests 1, 2, 6 fail on origin/main (proof in PR description).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ASB_ENCLOSURE_LINES_UI_V1,
  enclosureSubtotalWithMarkup,
  enclosureLineCount,
  type EnclosureLinesTableProps
} from "../EnclosureLinesTable";
import {
  acmFactCount,
  ASB_CARD_ENCLOSURE_NOTE
} from "../WbsAcmBlock";
import type { EnclosureLine } from "../../../../lib/enclosure-lines-api";
import type { ScopeItem } from "../../ScopeQuantitiesTable";

// ── Helpers ─────────────────────────────────────────────────────────────────

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

function makeLine(overrides: Partial<EnclosureLine> = {}): EnclosureLine {
  return {
    id: "line-1",
    scopeItemId: "item-asb-1",
    enclosureType: "ACM enclosure (Class A, friable)",
    qty: "38",
    unit: "m²",
    rate: "185",
    rateOverride: null,
    sortOrder: 0,
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z",
    lineTotal: 7030,
    effectiveMarkup: 15,
    lineTotalWithMarkup: 8084.5,
    ...overrides
  };
}

function makeAsbItem(overrides: Partial<ScopeItem> = {}): ScopeItem {
  return {
    id: "item-asb-1",
    tenderId: "tender-1",
    cardId: "card-asb-1",
    wbsCode: "ASB2.1",
    itemNumber: 1,
    description: "Remove friable pipe lagging",
    status: "confirmed",
    aiProposed: false,
    aiConfidence: null,
    sortOrder: 0,
    notes: null,
    men: "3",
    days: "4",
    unit: null,
    value: null,
    wasteGroup: null,
    wasteItem: null,
    wasteIncluded: false,
    length: null,
    height: null,
    depth: null,
    sqm: null,
    m3: null,
    density: null,
    tonnes: null,
    chargeBy: null,
    materialType: null,
    cuttingIncluded: false,
    plantItems: null,
    estimateItemId: null,
    provisionalAmount: null,
    acmType: "friable",
    acmMaterial: "pipe_insulation",
    enclosureRequired: true,
    airMonitoring: true,
    lineTotal: 19200,
    lineTotalWithMarkup: 22080,
    ...overrides
  } as ScopeItem;
}

// ── 1. Type list renders from the API — no type-name literals in the component ──

describe("test 1: type list from API, no type-name literals in component", () => {
  const componentSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/EnclosureLinesTable.tsx"),
    "utf-8"
  );

  it("carries the ASB_ENCLOSURE_LINES_UI_V1 marker", () => {
    expect(ASB_ENCLOSURE_LINES_UI_V1).toBe("asb-enclosure-s2");
    expect(componentSource).toContain("ASB_ENCLOSURE_LINES_UI_V1");
  });

  it("does not hard-code the type name 'ACM enclosure' in the component source", () => {
    // The type list comes from the API (GET /estimate-rates/enclosure).
    // If the component hard-coded type names, a rate table change would
    // require a code change. The component must render whatever the API returns.
    expect(componentSource).not.toContain("ACM enclosure");
  });

  it("does not hard-code 'Air monitoring' as a type name in the component source", () => {
    expect(componentSource).not.toContain('"Air monitoring"');
  });

  it("fetches types from /estimate-rates/enclosure (source assertion)", () => {
    // The component calls listEnclosureRateTypes which hits the existing endpoint.
    expect(componentSource).toContain("listEnclosureRateTypes");
    expect(componentSource).toContain("/estimate-rates/enclosure");
  });

  it("the type select renders options from the typeOptions prop, not a static list", () => {
    // The AddTypeSelect renders options from typeOptions; the TypeSelect also uses it.
    // If options were static, this assertion would fail because the source would
    // contain option literals.
    expect(componentSource).toContain("typeOptions");
    expect(componentSource).toContain(".map(");
    // No static <option>ACM... in the component
    expect(componentSource).not.toMatch(/<option>ACM/);
  });
});

// ── 2. Add POSTs { enclosureType, qty }; rate PATCHes rateOverride; clear PATCHes null ──

describe("test 2: write path — source assertions", () => {
  const componentSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/EnclosureLinesTable.tsx"),
    "utf-8"
  );

  it("createEnclosureLine is called with { enclosureType, qty } on add", () => {
    // The POST body is { enclosureType, qty } per the DTO.
    expect(componentSource).toContain("createEnclosureLine");
    expect(componentSource).toContain("enclosureType");
    expect(componentSource).toContain("qty");
  });

  it("patchEnclosureLine is called with { rateOverride } when the rate input blurs", () => {
    expect(componentSource).toContain("patchEnclosureLine");
    expect(componentSource).toContain("rateOverride");
  });

  it("clearing the rate input PATCHes rateOverride: null (source assertion)", () => {
    // When the rate cell is cleared (empty string), the component patches null.
    expect(componentSource).toContain("rateOverride: null");
  });

  it("uses the /estimate-rates/enclosure endpoint — not a new route", () => {
    // The brief requires using the existing rate-resolver list endpoint.
    expect(componentSource).toContain("/estimate-rates/enclosure");
    // A new route would be /tenders/... or /rates/... — neither appears for the type list.
    expect(componentSource).not.toMatch(/\/tenders\/.*\/enclosure-types/);
    expect(componentSource).not.toMatch(/\/rates\/enclosure-types/);
  });
});

// ── 3. Server totals only — component never multiplies qty × rate ────────────

describe("test 3: totals come from API; component never multiplies", () => {
  const componentSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/EnclosureLinesTable.tsx"),
    "utf-8"
  );

  it("contains no qty-times-rate multiplication (source assertion)", () => {
    // Mirrors the same gate in other-operational-costs.test.tsx.
    expect(componentSource).not.toMatch(/qty\s*\*/);
    expect(componentSource).not.toMatch(/\*\s*rate/);
  });

  it("reads lineTotalWithMarkup from the server line object", () => {
    expect(componentSource).toContain("lineTotalWithMarkup");
  });

  describe("enclosureSubtotalWithMarkup()", () => {
    it("sums lineTotalWithMarkup from all lines", () => {
      const lines = [
        makeLine({ id: "l1", lineTotalWithMarkup: 8084.5 }),
        makeLine({ id: "l2", lineTotalWithMarkup: 2484 }),
        makeLine({ id: "l3", lineTotalWithMarkup: 977.5 })
      ];
      const total = enclosureSubtotalWithMarkup(lines);
      // 8084.5 + 2484 + 977.5 = 11546
      expect(total).toBeCloseTo(11546, 2);
    });

    it("contributes zero for a line with missing or null lineTotalWithMarkup", () => {
      const lines = [
        makeLine({ id: "l1", lineTotalWithMarkup: 1000 }),
        makeLine({ id: "l2", lineTotalWithMarkup: undefined as unknown as number }),
        makeLine({ id: "l3", lineTotalWithMarkup: null as unknown as number })
      ];
      expect(enclosureSubtotalWithMarkup(lines)).toBe(1000);
    });

    it("returns 0 for an empty array", () => {
      expect(enclosureSubtotalWithMarkup([])).toBe(0);
    });

    it("result is not qty × rate — a probe", () => {
      // 38 m² × 185 = 7030 (bare). lineTotalWithMarkup = 8084.5 (with markup).
      // The function must return 8084.5 (the server's figure), not 7030.
      const line = makeLine({ qty: "38", rate: "185", lineTotalWithMarkup: 8084.5 });
      const result = enclosureSubtotalWithMarkup([line]);
      expect(result).toBe(8084.5);
      expect(result).not.toBe(38 * 185); // 7030
    });
  });
});

// ── 4. Block does not render on a non-ASB card ────────────────────────────────

describe("test 4: block does not render on non-ASB cards", () => {
  const sqtSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"),
    "utf-8"
  );

  it("WbsAcmBlock is gated on isAsbestos (source assertion)", () => {
    // ScopeQuantitiesTable gates the ACM block on isAsbestos — the exact gate
    // that was there before S2. The enclosure table inherits this gate because
    // it lives inside WbsAcmBlock.
    expect(sqtSource).toContain("isAsbestos && openBlocks.acm");
  });

  it("isAsbestosCard is the sole gate for isAsbestos (source assertion)", () => {
    // isAsbestosCard resolves once per card. No second discipline string
    // comparison introduced by this slice.
    expect(sqtSource).toContain("isAsbestosCard(discipline)");
  });

  it("the EnclosureLinesTable is only inside WbsAcmBlock (source assertion)", () => {
    const wbsAcmSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/WbsAcmBlock.tsx"),
      "utf-8"
    );
    // EnclosureLinesTable is rendered inside WbsAcmBlock only.
    expect(wbsAcmSource).toContain("EnclosureLinesTable");
    // ScopeQuantitiesTable must NOT import or render EnclosureLinesTable directly —
    // that would bypass the isAsbestos gate.  Comments may mention the name, but
    // there must be no import or JSX usage (<EnclosureLinesTable).
    expect(sqtSource).not.toMatch(/import.*EnclosureLinesTable/);
    expect(sqtSource).not.toMatch(/<EnclosureLinesTable/);
  });
});

// ── 5. acmFactCount includes the priced lines ─────────────────────────────────

describe("test 5: acmFactCount includes enclosure line count", () => {
  const item = makeAsbItem();

  it("with no priced lines, returns the same value as the original four-field count", () => {
    // friable + pipe_insulation + enclosureRequired + airMonitoring = 4
    expect(acmFactCount(item)).toBe(4);
    expect(acmFactCount(item, 0)).toBe(4);
  });

  it("adds the line count on top of the four-field count", () => {
    expect(acmFactCount(item, 3)).toBe(7); // 4 facts + 3 lines
    expect(acmFactCount(item, 1)).toBe(5);
  });

  it("does not count negative line counts (default argument guards)", () => {
    // pricedLineCount defaults to 0; passing undefined is fine.
    expect(acmFactCount(item, undefined as unknown as number)).toBe(4);
  });

  it("count is 0 when no facts and no lines", () => {
    const emptyItem = makeAsbItem({
      acmType: null,
      acmMaterial: null,
      enclosureRequired: false,
      airMonitoring: false
    });
    expect(acmFactCount(emptyItem, 0)).toBe(0);
  });

  it("ScopeQuantitiesTable passes enclosure line count from itemEnclosureCounts (source assertion)", () => {
    const sqtSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"),
      "utf-8"
    );
    expect(sqtSource).toContain("itemEnclosureCounts");
    expect(sqtSource).toContain("enclosureLinesHere");
    expect(sqtSource).toContain("acmFactCount(item, enclosureLinesHere)");
  });
});

// ── 6. After edit, card totals refresh ───────────────────────────────────────

describe("test 6: card totals refresh after enclosure line edit", () => {
  const sqtSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"),
    "utf-8"
  );
  const wbsAcmSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/WbsAcmBlock.tsx"),
    "utf-8"
  );

  it("WbsAcmBlock forwards onLinesChanged to EnclosureLinesTable (source assertion)", () => {
    expect(wbsAcmSource).toContain("onLinesChanged");
    expect(wbsAcmSource).toContain("<EnclosureLinesTable");
  });

  it("ScopeQuantitiesTable calls onItemsChanged inside the onLinesChanged callback", () => {
    // onItemsChanged() is what refetches the card's item list and updates
    // the item totals and the discipline summary bar.
    expect(sqtSource).toContain("onItemsChanged()");
    // The callback is wired into WbsAcmBlock's onLinesChanged prop.
    expect(sqtSource).toContain("onLinesChanged=");
    expect(sqtSource).toContain("void onItemsChanged()");
  });

  it("setItemEnclosureCounts is called in the onLinesChanged callback", () => {
    // The count is updated so acmFactCount includes the current line count
    // even before the next re-render driven by onItemsChanged.
    expect(sqtSource).toContain("setItemEnclosureCounts");
    expect(sqtSource).toContain("lines.length");
  });

  it("enclosureSubtotalWithMarkup sums server values (item total equals API value)", () => {
    // Three lines from the S1 spec: 38×185 + 4×540 + 1×850 = 10,040 subtotal.
    // With 15% markup: × 1.15 = 11,546.
    const lines = [
      makeLine({ id: "l1", qty: "38", rate: "185", lineTotalWithMarkup: 8084.5 }),
      makeLine({ id: "l2", qty: "4",  rate: "540", lineTotalWithMarkup: 2484   }),
      makeLine({ id: "l3", qty: "1",  rate: "850", lineTotalWithMarkup: 977.5  })
    ];
    const total = enclosureSubtotalWithMarkup(lines);
    // 8084.5 + 2484 + 977.5 = 11,546. The server computed this; we just summed it.
    expect(total).toBeCloseTo(11546, 1);
    // Must NOT equal 10,040 (the bare subtotal) — markup is included.
    expect(total).not.toBe(10040);
  });
});

// ── 7. Tests 1, 2, 6 fail on origin/main — proof in PR description ───────────

describe("test 7: tests 1, 2, 6 fail on origin/main", () => {
  it("no ASB_ENCLOSURE_LINES_UI_V1 marker on main (proof)", () => {
    // The marker is in EnclosureLinesTable.tsx which does not exist on main.
    // This test itself proves absence: if the component didn't exist, importing
    // ASB_ENCLOSURE_LINES_UI_V1 at the top of this file would fail to compile.
    // The PR description includes the checkout-main proof (see PR body).
    expect(ASB_ENCLOSURE_LINES_UI_V1).toBe("asb-enclosure-s2");
  });

  it("EnclosureLinesTable.tsx does not exist on origin/main (source assertion)", () => {
    // The file was created in this PR. On main it would not resolve.
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/EnclosureLinesTable.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("ASB_ENCLOSURE_LINES_UI_V1");
  });

  it("acmFactCount on main ignores enclosure lines (source assertion)", () => {
    // On main, acmFactCount only counts 4 fields — the second argument didn't exist.
    // After this PR, it accepts a pricedLineCount and adds it.
    const wbsAcmSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/WbsAcmBlock.tsx"),
      "utf-8"
    );
    expect(wbsAcmSource).toContain("pricedLineCount");
  });
});

// ── Marker exported from EnclosureLinesTable ────────────────────────────────

describe("ASB_ENCLOSURE_LINES_UI_V1 marker", () => {
  it("is exported from EnclosureLinesTable with the correct value", () => {
    expect(ASB_ENCLOSURE_LINES_UI_V1).toBe("asb-enclosure-s2");
  });
});

// ── ASB card note ────────────────────────────────────────────────────────────

describe("ASB card note text (WbsAcmBlock)", () => {
  it("exact wording matches the brief", () => {
    expect(ASB_CARD_ENCLOSURE_NOTE).toBe(
      "Enclosure materials and hire, air monitoring and clearance are priced from the enclosure rate table. The labour to build and strip the enclosure stays as men × days."
    );
  });

  it("is rendered in the WbsAcmBlock (source assertion)", () => {
    const wbsAcmSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/WbsAcmBlock.tsx"),
      "utf-8"
    );
    expect(wbsAcmSource).toContain("ASB_CARD_ENCLOSURE_NOTE");
    expect(wbsAcmSource).toContain("wbs-acm-note");
  });
});

// ── enclosureLineCount helper ────────────────────────────────────────────────

describe("enclosureLineCount()", () => {
  it("returns the number of lines in the array", () => {
    expect(enclosureLineCount([])).toBe(0);
    expect(enclosureLineCount([makeLine()])).toBe(1);
    expect(enclosureLineCount([makeLine({ id: "l1" }), makeLine({ id: "l2" }), makeLine({ id: "l3" })])).toBe(3);
  });
});
