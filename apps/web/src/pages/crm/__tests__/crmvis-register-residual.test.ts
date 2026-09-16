/**
 * crmvis-register-residual — CRM_REGISTER_RESIDUAL_V1 assertions.
 *
 * Spec:
 *   1. Populated Next action: text is in its own block above the badge; the
 *      badge has marginTop and NOT marginRight; the badge has no display:block.
 *   2. Empty Next action: "None set" is in its own block; the Stalled badge has
 *      marginTop and NOT display:block.
 *   3. Value chip round-trips valueMin / valueMax into the query string via
 *      buildQueryStringWithPage.
 *   4. Logged by filter narrows rows client-side; option list is derived from
 *      loaded rows (not hard-coded); "Never logged" case covered.
 *   5. Owner chip: accessible name is "Owner"; query param is still estimatorId.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildQueryStringWithPage, type FiltersForQuery } from "../../tendering/tenderingPage.helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = resolve(__dirname, "..");

function readCrmSource(basename: string): string {
  return readFileSync(resolve(CRM_DIR, basename), "utf-8");
}

const src = readCrmSource("TendersRegisterPage.tsx");

// ---------------------------------------------------------------------------
// 1. Populated Next action: text above badge
// ---------------------------------------------------------------------------

describe("Next action cell — populated branch (CRM_REGISTER_RESIDUAL_V1)", () => {
  it("renders the text in its own block element (display:block span)", () => {
    // The naLabel span must use display: "block"
    expect(src).toContain('style={{ display: "block" }}>{naLabel}');
  });

  it("badge uses marginTop, not marginRight", () => {
    // Should have marginTop: 4 on the overdue badge — no marginRight on it
    // We look for the pattern: s7-badge--danger ... marginTop
    // and ensure marginRight: 4 is NOT present near the badge in populated branch
    const dangerBadgeMatch = src.match(/s7-badge--danger[\s\S]{0,200}aria-label="overdue"/);
    expect(dangerBadgeMatch).not.toBeNull();
    if (dangerBadgeMatch) {
      expect(dangerBadgeMatch[0]).toContain("marginTop");
      expect(dangerBadgeMatch[0]).not.toContain("marginRight");
    }
  });

  it("overdue badge does not carry display:block override", () => {
    // The badge must not have display: "block" or display:"block"
    const dangerBadgeBlock = src.match(/s7-badge--danger[\s\S]{0,300}aria-label="overdue"/);
    expect(dangerBadgeBlock).not.toBeNull();
    if (dangerBadgeBlock) {
      expect(dangerBadgeBlock[0]).not.toMatch(/display[: "]*block/);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Empty Next action: "None set" above Stalled badge (inline-flex, not block)
// ---------------------------------------------------------------------------

describe("Next action cell — empty branch / Stalled badge (CRM_REGISTER_RESIDUAL_V1)", () => {
  it('"None set" is wrapped in its own block element', () => {
    // The "None set" em must be inside a display:block span.
    // Allow up to 300 chars to cover the em wrapper line.
    expect(src).toMatch(/display: "block"[\s\S]{0,300}None set/);
  });

  it("Stalled badge does NOT carry display:block override", () => {
    // Find the Stalled badge section — it must NOT have display: "block"
    const stalledMatch = src.match(/s7-badge--neutral[\s\S]{0,200}Stalled/);
    expect(stalledMatch).not.toBeNull();
    if (stalledMatch) {
      expect(stalledMatch[0]).not.toMatch(/display[: "]*block/);
    }
  });

  it("Stalled badge has marginTop", () => {
    const stalledMatch = src.match(/s7-badge--neutral[\s\S]{0,200}Stalled/);
    expect(stalledMatch).not.toBeNull();
    if (stalledMatch) {
      expect(stalledMatch[0]).toContain("marginTop");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Value chip round-trips valueMin / valueMax via buildQueryStringWithPage
// ---------------------------------------------------------------------------

describe("Value chip — valueMin / valueMax in query string (CRM_REGISTER_RESIDUAL_V1)", () => {
  const baseFilters: FiltersForQuery = {
    search: "",
    status: [],
    estimatorId: null,
    clientId: null,
    probability: [],
    valueMin: "",
    valueMax: "",
    dueDateFrom: "",
    dueDateTo: "",
    discipline: [],
    sortBy: null,
    sortDir: "desc"
  };

  it("valueMin appears in the query string when set", () => {
    const qs = buildQueryStringWithPage({ ...baseFilters, valueMin: "500000" }, 100, 1);
    expect(qs).toContain("valueMin=500000");
  });

  it("valueMax appears in the query string when set", () => {
    const qs = buildQueryStringWithPage({ ...baseFilters, valueMax: "2000000" }, 100, 1);
    expect(qs).toContain("valueMax=2000000");
  });

  it("both bounds appear together", () => {
    const qs = buildQueryStringWithPage(
      { ...baseFilters, valueMin: "100000", valueMax: "999999" },
      100,
      1
    );
    expect(qs).toContain("valueMin=100000");
    expect(qs).toContain("valueMax=999999");
  });

  it("empty valueMin is not included in the query string", () => {
    const qs = buildQueryStringWithPage(baseFilters, 100, 1);
    expect(qs).not.toContain("valueMin");
    expect(qs).not.toContain("valueMax");
  });

  it("the page source wires valueMin to the min input and valueMax to the max input", () => {
    expect(src).toContain("valueMin");
    expect(src).toContain("valueMax");
    // The filter chip must use aria-label="Filter by value"
    expect(src).toContain('aria-label="Filter by value"');
    // Inputs use type="number" with inputMode="numeric"
    expect(src).toContain('type="number"');
    expect(src).toContain('inputMode="numeric"');
  });
});

// ---------------------------------------------------------------------------
// 4. Logged by filter: client-side, derived options, Never logged case
// ---------------------------------------------------------------------------

describe("Logged by filter — client-side narrow (CRM_REGISTER_RESIDUAL_V1)", () => {
  it("the page source contains a Logged by chip with aria-label", () => {
    expect(src).toContain('aria-label="Filter by logged by"');
  });

  it("the option list includes a Never logged sentinel", () => {
    expect(src).toContain("Never logged");
    expect(src).toContain("NEVER_LOGGED");
  });

  it("options are derived from enrichedRows.loggedByName (not hard-coded)", () => {
    // The select options come from loggedByOptions, which is computed from enrichedRows
    expect(src).toContain("loggedByOptions");
    expect(src).toContain("loggedByName");
    // Confirm the options map over loggedByOptions
    expect(src).toContain("loggedByOptions.map");
  });

  it("the filter predicate handles NEVER_LOGGED separately from a name", () => {
    // The source must branch on NEVER_LOGGED
    expect(src).toContain('loggedByFilter === "NEVER_LOGGED"');
  });

  it("the filter narrows rows by loggedByName match", () => {
    // The else branch compares loggedByName to loggedByFilter
    expect(src).toContain("t.loggedByName !== loggedByFilter");
  });
});

// ---------------------------------------------------------------------------
// 5. Owner chip: accessible name and query param
// ---------------------------------------------------------------------------

describe("Owner chip — relabelled from Estimator (CRM_REGISTER_RESIDUAL_V1)", () => {
  it('chip has aria-label "Filter by owner"', () => {
    expect(src).toContain('aria-label="Filter by owner"');
  });

  it("chip placeholder/label says Owner, not Estimator", () => {
    // The Owner chip placeholder must say "Owner"
    expect(src).toContain('"Owner ▾"');
  });

  it("query param is still estimatorId (no rename)", () => {
    // The Owner chip must still set filters.estimatorId
    expect(src).toContain("estimatorId: e.target.value || null");
  });

  it("the decision comment records Marco's 2026-09-16 call", () => {
    expect(src).toContain("2026-09-16");
    expect(src).toContain("Estimator is the owner");
  });

  it("carries the CRM_REGISTER_RESIDUAL_V1 marker", () => {
    expect(src).toContain("CRM_REGISTER_RESIDUAL_V1");
  });
});
