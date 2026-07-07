/**
 * Logic-only specs for the rename guard and the "Copy from" source list
 * (no jsdom component render). The UI flows are covered by the PR smoke
 * checklist.
 */
import { describe, expect, it } from "vitest";
import { canRenameDashboard, copySourceDashboards, type UserDashboard } from "../types";

function dash(partial: Partial<UserDashboard>): UserDashboard {
  return {
    id: "dash-1",
    userId: "user-1",
    name: "Dashboard",
    slug: "custom",
    isSystem: false,
    isDefault: false,
    config: { period: "30d", widgets: [] },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial
  };
}

describe("canRenameDashboard", () => {
  it("lets anyone rename a custom dashboard", () => {
    expect(canRenameDashboard({ isSystem: false }, { isAdmin: false })).toBe(true);
    expect(canRenameDashboard({ isSystem: false }, { isAdmin: true })).toBe(true);
  });

  it("restricts system dashboard rename to admins", () => {
    expect(canRenameDashboard({ isSystem: true }, { isAdmin: false })).toBe(false);
    expect(canRenameDashboard({ isSystem: true }, { isAdmin: true })).toBe(true);
  });
});

describe("copySourceDashboards", () => {
  it("includes system dashboards as valid copy sources", () => {
    const list = [
      dash({ id: "c1", name: "My board", isSystem: false }),
      dash({ id: "s1", name: "Operations", isSystem: true }),
      dash({ id: "s2", name: "Tendering", isSystem: true })
    ];
    const sources = copySourceDashboards(list);
    expect(sources.map((d) => d.id)).toContain("s1");
    expect(sources.map((d) => d.id)).toContain("s2");
    expect(sources).toHaveLength(3);
  });

  it("orders system dashboards first, then alphabetically", () => {
    const list = [
      dash({ id: "c2", name: "Zeta", isSystem: false }),
      dash({ id: "c1", name: "Alpha", isSystem: false }),
      dash({ id: "s2", name: "Tendering", isSystem: true }),
      dash({ id: "s1", name: "Operations", isSystem: true })
    ];
    expect(copySourceDashboards(list).map((d) => d.id)).toEqual(["s1", "s2", "c1", "c2"]);
  });

  it("does not mutate the input list", () => {
    const list = [dash({ id: "c1", name: "B" }), dash({ id: "s1", name: "A", isSystem: true })];
    const before = list.map((d) => d.id);
    copySourceDashboards(list);
    expect(list.map((d) => d.id)).toEqual(before);
  });

  it("returns an empty list when there is nothing to copy (radio disabled with hint)", () => {
    expect(copySourceDashboards([])).toEqual([]);
  });
});
