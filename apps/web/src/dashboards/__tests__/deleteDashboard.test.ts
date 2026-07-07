/**
 * Logic-only specs for the dashboard delete guard, following the seam
 * pattern used elsewhere in the web workspace (no jsdom component render).
 * The modal flow itself is covered by the PR smoke checklist.
 */
import { describe, expect, it } from "vitest";
import { canDeleteDashboard } from "../types";

describe("canDeleteDashboard", () => {
  it("allows deleting a custom (non-system) dashboard", () => {
    expect(canDeleteDashboard({ isSystem: false })).toBe(true);
  });

  it("protects system dashboards — delete stays blocked regardless of role", () => {
    expect(canDeleteDashboard({ isSystem: true })).toBe(false);
  });
});
