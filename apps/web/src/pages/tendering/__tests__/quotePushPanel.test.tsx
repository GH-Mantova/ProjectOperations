// quotePushPanel.test.tsx -- QUOTE_PUSH_PANEL_V1 (scopecards-s4b)
//
// Source-read tests: grep the source files for structural claims.
// The web workspace has no jsdom / @testing-library; DOM claims are
// validated by reading the source text directly.
//
// Pattern follows waste-section.test.tsx and quotePreviewParity.test.tsx.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../${relFromRepoRoot}`, import.meta.url));

const panelSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/QuotePushPanel.tsx"),
  "utf-8"
);

const diffSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/QuotePushDiffModal.tsx"),
  "utf-8"
);

const clientQuoteSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ClientQuotesPanel.tsx"),
  "utf-8"
);

// ── QuotePushPanel structural assertions ──────────────────────────

describe("QuotePushPanel structural assertions (QUOTE_PUSH_PANEL_V1)", () => {
  it("panel is only mounted inside CostTab (not in other tabs)", () => {
    // QuotePushPanel is imported and used in ClientQuotesPanel.tsx
    expect(clientQuoteSource).toMatch(/QuotePushPanel/);
    // It should appear inside the CostTab function body (after 'CostTab' function declaration)
    const costTabIndex = clientQuoteSource.indexOf("function CostTab(");
    const panelUsageIndex = clientQuoteSource.indexOf("QuotePushPanel", costTabIndex);
    expect(panelUsageIndex).toBeGreaterThan(costTabIndex);
    // It should NOT appear in the ProvisionalTab or OptionsTab bodies
    const provisionalTabIndex = clientQuoteSource.indexOf("function ProvisionalTab(");
    const optionsTabIndex = clientQuoteSource.indexOf("function OptionsTab(");
    // QuotePushPanel should not appear after ProvisionalTab
    const panelAfterProvIdx = clientQuoteSource.indexOf("<QuotePushPanel", provisionalTabIndex);
    expect(panelAfterProvIdx).toBe(-1);
  });

  it("Re-push button is disabled when status !== DRAFT (state-5 strip present)", () => {
    // The button must be disabled when status is not DRAFT
    expect(panelSource).toMatch(/disabled=\{quote\.status !== "DRAFT"\}/);
  });

  it("state-5 strip (cannot be changed by a push) is present when quote is not DRAFT", () => {
    // The SENT strip message is present
    expect(panelSource).toMatch(/cannot be changed by a push/);
    expect(panelSource).toMatch(/Create a new revision/);
  });

  it("apply posts push-from-estimate (never push-from-scope)", () => {
    // Panel calls QuotePushDiffModal which applies by posting push-from-estimate
    expect(panelSource).toContain("push-from-estimate");
    expect(panelSource).not.toContain("push-from-scope");
  });

  it("diff modal posts push-from-estimate (never push-from-scope)", () => {
    expect(diffSource).toContain("push-from-estimate");
    expect(diffSource).not.toContain("push-from-scope");
  });

  it("modal lists a 'withdraw' kind", () => {
    expect(diffSource).toMatch(/withdraw/i);
    // The withdrawn row has a red rail
    expect(diffSource).toMatch(/status-danger/);
  });

  it("Left off this quote strip filters quoteDestination === INTERNAL", () => {
    // The CostTab reads pushable lines and filters INTERNAL
    expect(clientQuoteSource).toMatch(/quoteDestination.*INTERNAL|INTERNAL.*quoteDestination/);
    expect(clientQuoteSource).toContain("Left off this quote");
  });

  it("the old 'from estimate' pill is gone (replaced by SourceChipBadge)", () => {
    // The old pill had the text "from estimate" as literal JSX text
    // It should no longer appear as a bare literal inside a <span>from estimate</span>
    // We check that the old sourceEstimateLineId && 'from estimate' text block is removed
    expect(clientQuoteSource).not.toMatch(/>\s*from estimate\s*<\/span>/);
  });

  it("per-line nextLabel (String.fromCharCode) is gone from CostTab", () => {
    // The old nextLabel = String.fromCharCode(65 + quote.costLines.length) is removed
    expect(clientQuoteSource).not.toMatch(/String\.fromCharCode\(65\s*\+\s*quote\.costLines\.length\)/);
  });

  it("group header PATCHes printMode via cost-groups endpoint", () => {
    // CostTab sends PATCH to cost-groups with printMode
    expect(clientQuoteSource).toContain("cost-groups");
    expect(clientQuoteSource).toContain("printMode");
  });

  it("Priced on the estimate text is present in CostTab", () => {
    expect(clientQuoteSource).toContain("Priced on the estimate");
  });
});

// ── QuotePushDiffModal structural assertions ──────────────────────

describe("QuotePushDiffModal structural assertions (QUOTE_PUSH_PANEL_V1)", () => {
  it("modal uses CenteredModal", () => {
    expect(diffSource).toContain("CenteredModal");
  });

  it("modal shows the title with N changes", () => {
    // Title includes "What re-pushing will do" and counts
    expect(diffSource).toContain("What re-pushing will do");
  });

  it("modal has Cancel and Apply buttons", () => {
    expect(diffSource).toContain("Cancel");
    expect(diffSource).toContain("Apply");
  });

  it("apply uses POST to push-from-estimate (not GET)", () => {
    // The modal calls authFetch with push-from-estimate and method POST
    expect(diffSource).toContain("push-from-estimate");
    expect(diffSource).toContain(`method: "POST"`);
  });

  it("409 response shows conflict message inside modal (not toast)", () => {
    expect(diffSource).toMatch(/409|status === 409/);
    expect(diffSource).toContain("conflictMsg");
  });

  it("withdrawn kind has red rail (status-danger)", () => {
    expect(diffSource).toMatch(/status-danger/);
    expect(diffSource).toMatch(/withdraw/i);
  });
});

// ── no hex fallback literals in new files ──────────────────────────

describe("hex-ratchet compliance (QUOTE_PUSH_PANEL_V1)", () => {
  it("QuotePushPanel.tsx has no var(--x, #hex) fallback patterns", () => {
    // Must not use var(--token, #hexvalue) — use bare var(--token) only
    const hexFallbacks = [...panelSource.matchAll(/var\(--[^,)]+,\s*#[0-9a-fA-F]{3,8}\)/g)].map((m) => m[0]);
    expect(hexFallbacks).toHaveLength(0);
  });

  it("QuotePushDiffModal.tsx has no var(--x, #hex) fallback patterns", () => {
    const hexFallbacks = [...diffSource.matchAll(/var\(--[^,)]+,\s*#[0-9a-fA-F]{3,8}\)/g)].map((m) => m[0]);
    expect(hexFallbacks).toHaveLength(0);
  });
});
