// AccountsListPage — pure logic assertions (no jsdom).
//
// The web workspace has no @testing-library / jsdom setup (all existing web
// tests are pure logic). We test `computeGoingCold`, the client-side derivation
// exported from AccountsListPage, and CRM_COLD_V2 — the shared going-cold
// contract that the KPI tile, the client-side flag, and the server-side
// deriveGoingCold all read from.
//
// CRM UIFIX S1 (2026-09-01): CRM_COLD_V2 replaces the split 14-day/30-day and
// null-not-cold/null-is-cold defect. Marco's decisions:
//   - Default threshold is 60 days.
//   - lastContactedAt === null counts as COLD (if non-PAST). Never-contacted
//     is the coldest state in the system, not the warmest.

import { describe, expect, it } from "vitest";
import { computeGoingCold, CRM_COLD_V2 } from "../AccountsListPage";

// Pin "now" so tests don't drift.
const NOW = new Date("2026-08-14T12:00:00Z").getTime();
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe("CRM_COLD_V2 (web mirror)", () => {
  // Assert the NUMBER, not the constant name — a silent drift to a different
  // literal must fail CI. Server truth is asserted symmetrically in
  // apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts.
  it("THRESHOLD_DAYS is 60 (matches the server-side CRM_COLD_V2)", () => {
    expect(CRM_COLD_V2.THRESHOLD_DAYS).toBe(60);
  });

  it("NULL_IS_COLD is true (never-contacted is the coldest state)", () => {
    expect(CRM_COLD_V2.NULL_IS_COLD).toBe(true);
  });
});

describe("computeGoingCold — CRM_COLD_V2 contract", () => {
  it("returns true when lastContactedAt is >60 days ago and lifecycle is ACTIVE", () => {
    expect(computeGoingCold("ACTIVE", daysAgo(61), NOW)).toBe(true);
  });

  it("returns true when lastContactedAt is >60 days ago and lifecycle is PROSPECT", () => {
    expect(computeGoingCold("PROSPECT", daysAgo(120), NOW)).toBe(true);
  });

  it("returns false when lastContactedAt is exactly 60 days ago (threshold is >60, not >=)", () => {
    expect(computeGoingCold("ACTIVE", daysAgo(60), NOW)).toBe(false);
  });

  it("returns false when lastContactedAt is 30 days ago (well inside the 60-day window)", () => {
    expect(computeGoingCold("ACTIVE", daysAgo(30), NOW)).toBe(false);
  });

  it("returns false for PAST lifecycle even when contact is very old", () => {
    expect(computeGoingCold("PAST", daysAgo(365), NOW)).toBe(false);
  });

  it("returns false for PAST lifecycle even when lastContactedAt is null", () => {
    expect(computeGoingCold("PAST", null, NOW)).toBe(false);
  });

  it("returns TRUE when lastContactedAt is null and lifecycle is ACTIVE (CRM_COLD_V2)", () => {
    expect(computeGoingCold("ACTIVE", null, NOW)).toBe(true);
  });

  it("returns TRUE when lastContactedAt is null and lifecycle is PROSPECT (CRM_COLD_V2)", () => {
    expect(computeGoingCold("PROSPECT", null, NOW)).toBe(true);
  });

  it("handles Date objects (not just ISO strings)", () => {
    const old = new Date(NOW - 80 * 24 * 60 * 60 * 1000);
    expect(computeGoingCold("ACTIVE", old, NOW)).toBe(true);
    const fresh = new Date(NOW - 3 * 24 * 60 * 60 * 1000);
    expect(computeGoingCold("ACTIVE", fresh, NOW)).toBe(false);
  });
});

// Mirror check — the four cases the spec pins: server (deriveGoingCold) and web
// (computeGoingCold) must agree. We can't import the server file from the web
// test (different tsconfig root), but we can pin the CONTRACT here so a drift
// in the numbers or the null-rule fails BOTH suites on the same commit.
describe("computeGoingCold / deriveGoingCold — mirror contract (CRM UIFIX S1)", () => {
  // Case set is verbatim from the CRM UIFIX S1 spec, tests 2 and 3.
  const cases: Array<{
    label: string;
    lifecycle: "PROSPECT" | "ACTIVE" | "PAST";
    lastContactedAt: string | null;
    expected: boolean;
  }> = [
    { label: "PROSPECT + null → cold", lifecycle: "PROSPECT", lastContactedAt: null, expected: true },
    { label: "ACTIVE + null → cold", lifecycle: "ACTIVE", lastContactedAt: null, expected: true },
    { label: "PAST + null → not cold", lifecycle: "PAST", lastContactedAt: null, expected: false },
    { label: "PROSPECT + 120d → cold", lifecycle: "PROSPECT", lastContactedAt: daysAgo(120), expected: true },
    { label: "ACTIVE + 61d → cold", lifecycle: "ACTIVE", lastContactedAt: daysAgo(61), expected: true },
    { label: "PAST + 365d → not cold", lifecycle: "PAST", lastContactedAt: daysAgo(365), expected: false },
    { label: "ACTIVE + 30d → not cold", lifecycle: "ACTIVE", lastContactedAt: daysAgo(30), expected: false }
  ];

  for (const c of cases) {
    it(`web mirror agrees: ${c.label}`, () => {
      expect(computeGoingCold(c.lifecycle, c.lastContactedAt, NOW)).toBe(c.expected);
    });
  }
});
