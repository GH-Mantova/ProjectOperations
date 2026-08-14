// NAV-2: AccountsListPage vitest — pure logic assertions.
//
// The web workspace has no @testing-library / jsdom setup (all existing
// web tests are pure logic). We test `computeGoingCold`, the client-side
// derivation function exported from AccountsListPage. The server mirrors
// the same logic (deriveGoingCold in accounts.service.ts), so these cases
// cover both ends.
//
// Four cases per spec:
//   1. >14 days ago  + non-PAST lifecycle  → cold
//   2. ≤14 days ago  + non-PAST lifecycle  → not cold
//   3. PAST lifecycle                      → never cold (regardless of date)
//   4. null lastContactedAt                → not cold

import { describe, expect, it } from "vitest";
import { computeGoingCold } from "../AccountsListPage";

// Pin "now" so tests don't drift.
const NOW = new Date("2026-08-14T12:00:00Z").getTime();
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe("computeGoingCold (NAV-2 AccountsListPage)", () => {
  it("returns true when lastContactedAt is >14 days ago and lifecycle is ACTIVE", () => {
    expect(computeGoingCold("ACTIVE", daysAgo(15), NOW)).toBe(true);
  });

  it("returns true when lastContactedAt is >14 days ago and lifecycle is PROSPECT", () => {
    expect(computeGoingCold("PROSPECT", daysAgo(30), NOW)).toBe(true);
  });

  it("returns false when lastContactedAt is exactly 14 days ago (threshold is >14, not >=)", () => {
    // exactly 14 days — not over the threshold
    expect(computeGoingCold("ACTIVE", daysAgo(14), NOW)).toBe(false);
  });

  it("returns false when lastContactedAt is <=14 days ago (fresh contact)", () => {
    expect(computeGoingCold("ACTIVE", daysAgo(7), NOW)).toBe(false);
  });

  it("returns false for PAST lifecycle even when contact is very old", () => {
    expect(computeGoingCold("PAST", daysAgo(365), NOW)).toBe(false);
  });

  it("returns false when lastContactedAt is null (no evidence, must not go cold)", () => {
    expect(computeGoingCold("ACTIVE", null, NOW)).toBe(false);
  });

  it("returns false when lastContactedAt is null and lifecycle is PROSPECT", () => {
    expect(computeGoingCold("PROSPECT", null, NOW)).toBe(false);
  });

  it("handles Date objects (not just strings)", () => {
    const old = new Date(NOW - 20 * 24 * 60 * 60 * 1000);
    expect(computeGoingCold("ACTIVE", old, NOW)).toBe(true);
    const fresh = new Date(NOW - 3 * 24 * 60 * 60 * 1000);
    expect(computeGoingCold("ACTIVE", fresh, NOW)).toBe(false);
  });
});
