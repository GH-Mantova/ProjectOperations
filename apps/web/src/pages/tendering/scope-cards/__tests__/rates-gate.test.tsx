// rates-gate.test.tsx
//
// Draftpanel S1 — web-side tests for the rates-lock gate on the Scope of
// Works tab. The web workspace has no jsdom and no @testing-library (see
// other-operational-costs.test.tsx). All claims here are either:
//
//   a) file-level (grep the source for structural markers), or
//   b) pure-function tests against the gate state derivation logic.
//
// No mounting required; the gate is keyed by data-testid + data-state, and
// the testid presence is verified by grepping the source.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── Source-file grep helper ─────────────────────────────────────────────────

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

function readSrc(relFromRepoRoot: string): string {
  return readFileSync(repoFile(relFromRepoRoot), "utf8");
}

// ── Pure gate-state logic (mirrors the component) ───────────────────────────

type GateState = "locked" | "unlocked-empty" | "unlocked-readonly";

function deriveGateState(
  rateSet: { id: string } | null | undefined,
  rateSetLoading: boolean,
  cardCount: number
): GateState | "loading" {
  if (rateSetLoading) return "loading";
  const ratesLocked = rateSet != null;
  if (ratesLocked) return "locked";
  return cardCount === 0 ? "unlocked-empty" : "unlocked-readonly";
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ScopeCardsTab rates-gate — source structure", () => {
  const src = readSrc("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx");

  it('carries data-testid="scope-cards-rates-gate"', () => {
    expect(src).toContain("scope-cards-rates-gate");
  });

  it('carries data-state with the three gate values', () => {
    expect(src).toContain('"unlocked-empty"');
    expect(src).toContain('"unlocked-readonly"');
    expect(src).toContain('"locked"');
  });

  it("imports getRateSet from ratesTabApi", () => {
    expect(src).toContain("getRateSet");
    expect(src).toContain("ratesTabApi");
  });

  it("imports lockRateSet from ratesTabApi", () => {
    expect(src).toContain("lockRateSet");
  });

  it("imports ScopeCardRatesRequiredEmptyState", () => {
    expect(src).toContain("ScopeCardRatesRequiredEmptyState");
  });

  it("wraps the card stack in a fieldset for the unlocked-readonly state", () => {
    expect(src).toContain("<fieldset");
    expect(src).toContain("disabled={isReadOnly}");
    expect(src).toContain("aria-disabled");
    expect(src).toContain("pointer-events");
  });

  it("shows the unlocked banner with the specified text", () => {
    expect(src).toContain("Rates are unlocked");
    expect(src).toContain("read-only until rates are locked again");
  });

  it("does NOT key the gate on ratesSnapshotAt (as ruled)", () => {
    // The gate must never read ratesSnapshotAt — it reads the rate set.
    expect(src).not.toContain("ratesSnapshotAt");
  });
});

describe("ScopeCardEmptyState — rates-required variant", () => {
  const src = readSrc("apps/web/src/pages/tendering/scope-cards/ScopeCardEmptyState.tsx");

  it("exports ScopeCardRatesRequiredEmptyState", () => {
    expect(src).toContain("ScopeCardRatesRequiredEmptyState");
  });

  it("contains the required heading text", () => {
    expect(src).toContain("Lock rates before pricing");
  });

  it("contains the one-sentence explanation", () => {
    expect(src).toContain("rates could move");
  });

  it('contains the "Lock rates" primary button', () => {
    expect(src).toContain("Lock rates");
    expect(src).toContain("s7-btn--primary");
  });
});

describe("NewTenderWizard — rates copy correction", () => {
  const src = readSrc("apps/web/src/pages/tendering/NewTenderWizard.tsx");

  it("does NOT contain the old incorrect copy about first status change", () => {
    expect(src).not.toContain("first status change");
  });

  it("contains the corrected copy pointing to the Rates tab", () => {
    expect(src).toContain("lock on the Rates tab before pricing scope");
  });
});

describe("ScopeCardTabsRow — optional onCreateCard", () => {
  const src = readSrc("apps/web/src/pages/tendering/scope-cards/ScopeCardTabsRow.tsx");

  it("declares onCreateCard as optional (rates-gate suppresses the affordance)", () => {
    // The prop must use `?:` to be optional.
    expect(src).toContain("onCreateCard?:");
  });

  it("guards ScopeCardCreateTab render on onCreateCard being defined", () => {
    expect(src).toContain("onCreateCard ?");
  });
});

describe("Gate state derivation — pure function", () => {
  it("returns 'loading' while rateSetLoading is true", () => {
    expect(deriveGateState(undefined, true, 0)).toBe("loading");
    expect(deriveGateState(null, true, 5)).toBe("loading");
  });

  it("returns 'locked' when rateSet is non-null and loading is false", () => {
    expect(deriveGateState({ id: "set-1" }, false, 0)).toBe("locked");
    expect(deriveGateState({ id: "set-1" }, false, 5)).toBe("locked");
  });

  it("returns 'unlocked-empty' when rateSet is null and there are no cards", () => {
    expect(deriveGateState(null, false, 0)).toBe("unlocked-empty");
  });

  it("returns 'unlocked-readonly' when rateSet is null and cards exist", () => {
    expect(deriveGateState(null, false, 3)).toBe("unlocked-readonly");
    expect(deriveGateState(null, false, 1)).toBe("unlocked-readonly");
  });
});
