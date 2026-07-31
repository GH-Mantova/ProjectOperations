// GPS-A2 — unit tests for the pure helpers exported by useBreadcrumbTrail.
// The React hook itself needs a DOM (visibilityState + setInterval) that
// the web workspace does not set up (see PayrollExportPage.test.ts). We
// pin the client-side distance floor here so a future refactor cannot
// silently drop the 25m skip that keeps the log table quiet.

import { describe, expect, it } from "vitest";
import {
  BREADCRUMB_INTERVAL_MS,
  BREADCRUMB_MIN_MOVE_METRES,
  distanceMetres
} from "../useBreadcrumbTrail";

describe("useBreadcrumbTrail — distanceMetres", () => {
  it("returns 0 for identical points", () => {
    expect(distanceMetres(-37.81, 144.96, -37.81, 144.96)).toBe(0);
  });

  it("returns a small (<25m) distance for a sub-arcsecond move", () => {
    // ~0.0001 degree ≈ 11m at Melbourne latitude — well under the floor.
    const d = distanceMetres(-37.81, 144.96, -37.8101, 144.96);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(BREADCRUMB_MIN_MOVE_METRES);
  });

  it("returns >25m for a clearly separate reading", () => {
    // ~0.0005 degree ≈ 55m north — comfortably above the floor.
    const d = distanceMetres(-37.81, 144.96, -37.8095, 144.96);
    expect(d).toBeGreaterThan(BREADCRUMB_MIN_MOVE_METRES);
  });
});

describe("useBreadcrumbTrail — constants", () => {
  it("samples at most every 180s", () => {
    expect(BREADCRUMB_INTERVAL_MS).toBe(180_000);
  });

  it("skips posts within 25m of the last sent point", () => {
    expect(BREADCRUMB_MIN_MOVE_METRES).toBe(25);
  });
});
