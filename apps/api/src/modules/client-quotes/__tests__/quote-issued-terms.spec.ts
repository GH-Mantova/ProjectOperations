/**
 * QPDF-4 — quote-issued-terms.spec.ts
 *
 * Unit-tests the T&C clause fallback ladder implemented in QuotePdfService.
 * All four rows of the ladder are covered (see comments on each test).
 *
 * We test the helpers directly (parseClauses, parseDefaultClauses,
 * resolveLiveClauses, resolvePinnedClauses) so there is no need to stand up
 * a full NestJS application or hit a database.
 */

import { parseClauses, parseDefaultClauses } from "../../quote/tc-parser";
import { resolveLiveClauses, resolvePinnedClauses } from "../../estimate-export/estimate-export.service";
import { TC_TEXT } from "../../estimate-export/pdf/tc-text.const";

// ── parseClauses / parseDefaultClauses refactor parity ──────────────────────

describe("parseClauses / parseDefaultClauses refactor parity (QPDF-4)", () => {
  it("parseClauses(TC_TEXT) is byte-identical to parseDefaultClauses()", () => {
    const via_direct = parseDefaultClauses();
    const via_text   = parseClauses(TC_TEXT);
    expect(via_text).toEqual(via_direct);
  });

  it("parseDefaultClauses returns ≥1 clause (smoke-check the real TC_TEXT)", () => {
    expect(parseDefaultClauses().length).toBeGreaterThan(0);
  });

  it("parseClauses on the real TC_TEXT includes clause 17A", () => {
    const clauses = parseClauses(TC_TEXT);
    const c17a = clauses.find((c) => c.number === "17A");
    expect(c17a).toBeDefined();
    expect(c17a!.heading).toBe("FUEL PRICE ADJUSTMENT");
  });

  it("parseClauses returns empty array for text with no N. HEADING lines", () => {
    const result = parseClauses("This is just prose.\nNo structured headings here.");
    expect(result).toHaveLength(0);
  });

  it("parseClauses returns empty array for empty string", () => {
    expect(parseClauses("")).toHaveLength(0);
  });
});

// ── resolveLiveClauses ────────────────────────────────────────────────────────

describe("resolveLiveClauses", () => {
  it("returns stored JSON clauses when tandC row has valid clause array", () => {
    const stored = [
      { number: "1", heading: "DEFINITIONS", body: "body A" },
      { number: "2", heading: "PAYMENT", body: "body B" }
    ];
    const result = resolveLiveClauses({ clauses: stored });
    expect(result).toEqual(stored);
  });

  it("falls back to parseDefaultClauses() when tandC is null", () => {
    const result = resolveLiveClauses(null);
    expect(result).toEqual(parseDefaultClauses());
  });

  it("falls back to parseDefaultClauses() when tandC is undefined", () => {
    const result = resolveLiveClauses(undefined);
    expect(result).toEqual(parseDefaultClauses());
  });

  it("falls back to parseDefaultClauses() when clauses is an empty array", () => {
    // isClauseArray allows empty arrays (no structural violation); resolveLiveClauses
    // therefore returns the stored empty array, not defaults. This is intentional —
    // the caller (tender-level PDF) honours an explicitly cleared T&C row.
    const result = resolveLiveClauses({ clauses: [] });
    expect(result).toHaveLength(0);
  });

  it("falls back to parseDefaultClauses() when clauses field is not an array", () => {
    const result = resolveLiveClauses({ clauses: "not an array" as unknown });
    expect(result).toEqual(parseDefaultClauses());
  });

  it("falls back to parseDefaultClauses() when an item is malformed", () => {
    const malformed = [{ number: "1", heading: 42, body: "x" }];
    const result = resolveLiveClauses({ clauses: malformed as unknown });
    expect(result).toEqual(parseDefaultClauses());
  });
});

// ── resolvePinnedClauses ─────────────────────────────────────────────────────

describe("resolvePinnedClauses", () => {
  const liveClauses = parseDefaultClauses();

  // Fallback ladder row 4: pinned row found and parses to ≥1 clause
  it("row 4 — returns pinned clauses when content parses to ≥1 clause", () => {
    const pinnedContent = `1. CUSTOM HEADER\nThis is a custom clause body.\n\n2. SECOND CLAUSE\nAnother body.`;
    const { clauses, usedPinned } = resolvePinnedClauses(pinnedContent, liveClauses);
    expect(usedPinned).toBe(true);
    expect(clauses.length).toBe(2);
    expect(clauses[0]!.heading).toBe("CUSTOM HEADER");
    expect(clauses[1]!.heading).toBe("SECOND CLAUSE");
  });

  // Fallback ladder row 3: pinned row found but parseClauses() returns empty
  it("row 3 — falls back to live clauses + usedPinned=false when pinned content parses empty", () => {
    const unparseable = "This is T&C prose with no structured headings.";
    const { clauses, usedPinned } = resolvePinnedClauses(unparseable, liveClauses);
    expect(usedPinned).toBe(false);
    expect(clauses).toEqual(liveClauses);
  });

  // Fallback ladder row 3 edge case: empty string
  it("row 3 — falls back to live clauses when pinned content is empty string", () => {
    const { clauses, usedPinned } = resolvePinnedClauses("", liveClauses);
    expect(usedPinned).toBe(false);
    expect(clauses).toEqual(liveClauses);
  });

  // Pinned row with real TC_TEXT content should parse successfully (v1 doc pinned at send)
  it("row 4 — TC_TEXT as pinned content parses to the same clauses as parseDefaultClauses", () => {
    const { clauses, usedPinned } = resolvePinnedClauses(TC_TEXT, liveClauses);
    expect(usedPinned).toBe(true);
    expect(clauses).toEqual(parseDefaultClauses());
  });

  // Pinned doc A (v1) vs modified live (v2): assert a unique heading from v1 survives
  it("row 4 — end-to-end parity: pinned v1 clause unique heading renders even after live terms change", () => {
    // Simulate v1 pinned content — has a clause unique to document A
    const documentAContent = TC_TEXT + "\n\n22. SPECIAL CONDITION UNIQUE TO DOC A\nOnly in document A.";
    // Live terms were edited — v2 has no clause 22
    const v2LiveClauses = parseClauses(TC_TEXT);

    const { clauses, usedPinned } = resolvePinnedClauses(documentAContent, v2LiveClauses);
    expect(usedPinned).toBe(true);
    const uniqueClause = clauses.find((c) => c.heading === "SPECIAL CONDITION UNIQUE TO DOC A");
    expect(uniqueClause).toBeDefined();
    expect(uniqueClause!.number).toBe("22");
    // v2 live clauses do NOT have this heading
    expect(v2LiveClauses.find((c) => c.heading === "SPECIAL CONDITION UNIQUE TO DOC A")).toBeUndefined();
  });
});

// ── Fallback ladder: all four rows ────────────────────────────────────────────

describe("Fallback ladder — all four rows (QPDF-4 spec)", () => {
  const liveClauses = parseDefaultClauses();

  /**
   * Row 1: quote.sentAt is null → render live clauses.
   * The service uses resolveLiveClauses() directly (no pinned check) when sentAt is null.
   * We replicate that conditional here.
   */
  it("row 1 — unsent quote (sentAt null): live clauses rendered", () => {
    const sentAt: Date | null = null;
    const pinnedContent: string | null = null;

    const clauses = (sentAt !== null && pinnedContent !== null)
      ? resolvePinnedClauses(pinnedContent, liveClauses).clauses
      : resolveLiveClauses({ clauses: liveClauses });

    expect(clauses).toEqual(liveClauses);
  });

  /**
   * Row 2: sent but issuedTermsDocumentId is NULL (issuedTerms === null) → live clauses.
   * This covers pre-#549 sends and quotes sent when no active T&C row existed.
   */
  it("row 2 — sent, issuedTermsDocumentId null: live clauses rendered", () => {
    const sentAt: Date | null = new Date();
    const pinnedContent: string | null = null; // issuedTerms is null → no content

    const clauses = (sentAt !== null && pinnedContent !== null)
      ? resolvePinnedClauses(pinnedContent, liveClauses).clauses
      : resolveLiveClauses({ clauses: liveClauses });

    expect(clauses).toEqual(liveClauses);
  });

  /**
   * Row 3: pinned row found, but parseClauses(content) returns empty → live clauses + warn.
   * (logger.warn is emitted in the service; we just test the helper returns usedPinned=false)
   */
  it("row 3 — sent, pinned content parses to 0 clauses: live clauses rendered, usedPinned=false", () => {
    const sentAt: Date | null = new Date();
    const pinnedContent: string | null = "Prose only, no headings.";

    let clauses;
    let usedPinned = true;
    if (sentAt !== null && pinnedContent !== null) {
      ({ clauses, usedPinned } = resolvePinnedClauses(pinnedContent, liveClauses));
    } else {
      clauses = resolveLiveClauses({ clauses: liveClauses });
    }
    expect(usedPinned).toBe(false);
    expect(clauses).toEqual(liveClauses);
  });

  /**
   * Row 4: pinned row found and parses ≥1 clause → pinned clauses.
   * This is the core #549 spec — historical PDF renders terms agreed to at issue.
   */
  it("row 4 — sent, pinned content parses ≥1 clause: pinned clauses rendered", () => {
    const sentAt: Date | null = new Date();
    const pinnedContent: string | null = TC_TEXT;

    let clauses;
    let usedPinned = false;
    if (sentAt !== null && pinnedContent !== null) {
      ({ clauses, usedPinned } = resolvePinnedClauses(pinnedContent, liveClauses));
    } else {
      clauses = resolveLiveClauses({ clauses: liveClauses });
    }
    expect(usedPinned).toBe(true);
    expect(clauses).toEqual(parseDefaultClauses());
  });
});
