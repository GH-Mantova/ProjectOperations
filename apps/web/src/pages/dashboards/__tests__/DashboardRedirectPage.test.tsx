/**
 * Unit tests for DashboardRedirectPage — defaultDashboardId resolver logic.
 *
 * The web workspace has no @testing-library / jsdom set up so we test the
 * pure `resolveNavigationTarget` helper exported from the page rather than
 * rendering the React component. The full navigation flow is exercised by
 * the smoke suite; here we lock the branching contract.
 */
import { describe, expect, it } from "vitest";
import {
  resolveNavigationTarget,
  type DefaultDashboardPayload
} from "../DashboardRedirectPage";

function makePayload(overrides: Partial<DefaultDashboardPayload> = {}): DefaultDashboardPayload {
  return {
    id: "dash-abc",
    name: "My Dashboard",
    scope: "personal",
    isDefault: true,
    isFallback: false,
    ...overrides
  };
}

// ─── Personal default set ──────────────────────────────────────────────────────

describe("resolveNavigationTarget — personal default set (isFallback: false)", () => {
  it("returns /dashboards/:id with the payload id", () => {
    const target = resolveNavigationTarget(makePayload({ id: "dash-123", isFallback: false }));
    expect(target).toBe("/dashboards/dash-123");
  });

  it("uses the exact id from the payload (no slug transformation)", () => {
    const target = resolveNavigationTarget(
      makePayload({ id: "cuid-clxyz1234abcdef", isFallback: false })
    );
    expect(target).toBe("/dashboards/cuid-clxyz1234abcdef");
  });
});

// ─── Fallback (no personal default) ───────────────────────────────────────────

describe("resolveNavigationTarget — fallback (isFallback: true)", () => {
  it("returns '/' (global Operations canvas), NOT /dashboards/*", () => {
    const target = resolveNavigationTarget(makePayload({ isFallback: true }));
    expect(target).toBe("/");
    // Must not start with /dashboards to avoid a redirect loop through this page.
    expect(target.startsWith("/dashboards")).toBe(false);
  });

  it("returns '/' regardless of the id in the payload when isFallback is true", () => {
    const target = resolveNavigationTarget(
      makePayload({ id: "home-global", isFallback: true })
    );
    expect(target).toBe("/");
  });
});

// ─── Fetch error / non-ok response contract ───────────────────────────────────
// The component navigates to "/" on any error — the test below verifies the
// pure helper never throws so that branch is always reachable.

describe("resolveNavigationTarget — never throws", () => {
  it("does not throw for a minimal valid payload", () => {
    expect(() =>
      resolveNavigationTarget({ id: "x", name: "X", scope: "global", isDefault: false, isFallback: false })
    ).not.toThrow();
  });
});
