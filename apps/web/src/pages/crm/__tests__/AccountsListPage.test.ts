// AccountsListPage — pure logic assertions (no jsdom).
//
// The web workspace has no @testing-library / jsdom setup (all existing web
// tests are pure logic). We test `computeContactState`, the client-side
// derivation exported from AccountsListPage, and CRM_COLD_V3 — the shared
// contract that the KPI tile, the client-side chips, and the server-side
// deriveContactState all read from.
//
// CRM_COLD_V3 (2026-09-04): Marco ruled that never-contacted becomes its OWN
// state and "cold" goes back to meaning WAS WARM, WENT QUIET. Under the
// previous contract null was the coldest state; with no contact ever logged
// that made every account cold and the KPI tile read "Going cold 175" out of
// 175. Marco's decisions now pinned here:
//   - Default threshold is 60 days.
//   - lastContactedAt === null is "NEVER_CONTACTED", NOT "COLD".

import { describe, expect, it } from "vitest";
import { computeContactState, CRM_COLD_V3 } from "../AccountsListPage";

// Pin "now" so tests don't drift.
const NOW = new Date("2026-08-14T12:00:00Z").getTime();
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe("CRM_COLD_V3 (web mirror)", () => {
  // Assert the NUMBER, not the constant name — a silent drift to a different
  // literal must fail CI. Server truth is asserted symmetrically in
  // apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts.
  it("THRESHOLD_DAYS is 60 (matches the server-side CRM_COLD_V3)", () => {
    expect(CRM_COLD_V3.THRESHOLD_DAYS).toBe(60);
  });

  it("carries no null-rule flag — the null case is a state, not a boolean", () => {
    expect(Object.keys(CRM_COLD_V3)).toEqual(["THRESHOLD_DAYS"]);
  });
});

describe("computeContactState — CRM_COLD_V3 contract", () => {
  it("returns COLD when lastContactedAt is >60 days ago and lifecycle is ACTIVE", () => {
    expect(computeContactState("ACTIVE", daysAgo(61), NOW)).toBe("COLD");
  });

  it("returns COLD when lastContactedAt is >60 days ago and lifecycle is PROSPECT", () => {
    expect(computeContactState("PROSPECT", daysAgo(120), NOW)).toBe("COLD");
  });

  it("returns IN_CONTACT at exactly 60 days ago (threshold is >60, not >=)", () => {
    expect(computeContactState("ACTIVE", daysAgo(60), NOW)).toBe("IN_CONTACT");
  });

  it("returns COLD one millisecond past 60 days", () => {
    const justOver = new Date(NOW - 60 * 24 * 60 * 60 * 1000 - 1).toISOString();
    expect(computeContactState("ACTIVE", justOver, NOW)).toBe("COLD");
  });

  it("returns IN_CONTACT at 30 days ago (well inside the window)", () => {
    expect(computeContactState("ACTIVE", daysAgo(30), NOW)).toBe("IN_CONTACT");
  });

  it("returns PAST for PAST lifecycle even when contact is very old", () => {
    expect(computeContactState("PAST", daysAgo(365), NOW)).toBe("PAST");
  });

  it("returns PAST for PAST lifecycle even when lastContactedAt is null", () => {
    // Rule order matters: PAST is checked before the null rule.
    expect(computeContactState("PAST", null, NOW)).toBe("PAST");
  });

  it("returns NEVER_CONTACTED for a null date on ACTIVE (not COLD)", () => {
    expect(computeContactState("ACTIVE", null, NOW)).toBe("NEVER_CONTACTED");
  });

  it("returns NEVER_CONTACTED for a null date on PROSPECT (not COLD)", () => {
    expect(computeContactState("PROSPECT", null, NOW)).toBe("NEVER_CONTACTED");
  });

  it("handles Date objects (not just ISO strings)", () => {
    const old = new Date(NOW - 80 * 24 * 60 * 60 * 1000);
    expect(computeContactState("ACTIVE", old, NOW)).toBe("COLD");
    const fresh = new Date(NOW - 3 * 24 * 60 * 60 * 1000);
    expect(computeContactState("ACTIVE", fresh, NOW)).toBe("IN_CONTACT");
  });
});

// Mirror check — server (deriveContactState) and web (computeContactState)
// must agree. We can't import the server file from the web test (different
// tsconfig root), but we can pin the CONTRACT here so a drift in the numbers
// or the null-rule fails BOTH suites on the same commit.
describe("computeContactState / deriveContactState — mirror contract", () => {
  const cases: Array<{
    label: string;
    lifecycle: "PROSPECT" | "ACTIVE" | "PAST";
    lastContactedAt: string | null;
    expected: "PAST" | "NEVER_CONTACTED" | "COLD" | "IN_CONTACT";
  }> = [
    { label: "PROSPECT + null → NEVER_CONTACTED", lifecycle: "PROSPECT", lastContactedAt: null, expected: "NEVER_CONTACTED" },
    { label: "ACTIVE + null → NEVER_CONTACTED", lifecycle: "ACTIVE", lastContactedAt: null, expected: "NEVER_CONTACTED" },
    { label: "PAST + null → PAST", lifecycle: "PAST", lastContactedAt: null, expected: "PAST" },
    { label: "PROSPECT + 120d → COLD", lifecycle: "PROSPECT", lastContactedAt: daysAgo(120), expected: "COLD" },
    { label: "ACTIVE + 61d → COLD", lifecycle: "ACTIVE", lastContactedAt: daysAgo(61), expected: "COLD" },
    { label: "PAST + 365d → PAST", lifecycle: "PAST", lastContactedAt: daysAgo(365), expected: "PAST" },
    { label: "ACTIVE + 30d → IN_CONTACT", lifecycle: "ACTIVE", lastContactedAt: daysAgo(30), expected: "IN_CONTACT" },
    { label: "ACTIVE + 60d → IN_CONTACT", lifecycle: "ACTIVE", lastContactedAt: daysAgo(60), expected: "IN_CONTACT" }
  ];

  for (const c of cases) {
    it(`web mirror agrees: ${c.label}`, () => {
      expect(computeContactState(c.lifecycle, c.lastContactedAt, NOW)).toBe(c.expected);
    });
  }
});
