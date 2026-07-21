// Sidebar restructure (Marco 2026-07-17): the desktop nav is organised into
// the 7 approved groups. The Dashboards group is rendered inline in
// ShellLayout (it owns the "+ new dashboard" affordance and the dynamic list
// of user-created dashboards), so NAV_GROUPS carries the other six. These
// tests lock the group ids/labels/ordering, the role gate on the Settings
// group, and the "Tenders" active-match rule that used to swallow
// /tenders/settings and /tenders/dashboard.

import { describe, expect, it } from "vitest";
import type { SafeUser } from "../../auth/AuthContext";
import { isAdminUser } from "../../auth/permissions";
import { NAV_GROUPS } from "../ShellLayout";

function fakeUser(overrides: Partial<SafeUser>): SafeUser {
  return {
    id: "u1",
    email: "u@example.com",
    firstName: "U",
    lastName: "One",
    isActive: true,
    isSuperUser: false,
    roles: [],
    permissions: [],
    ...overrides
  } as SafeUser;
}

describe("ShellLayout admin gate", () => {
  it("super-user WITHOUT the Admin role is treated as admin", () => {
    const superUser = fakeUser({ isSuperUser: true, roles: [] });
    expect(isAdminUser(superUser)).toBe(true);
  });

  it("user WITH the Admin role is treated as admin", () => {
    const admin = fakeUser({ roles: [{ id: "r1", name: "Admin" }] });
    expect(isAdminUser(admin)).toBe(true);
  });

  it("planner (no Admin role, not super-user) is not treated as admin", () => {
    const planner = fakeUser({ roles: [{ id: "r2", name: "Planner" }] });
    expect(isAdminUser(planner)).toBe(false);
  });

  it("null user is not treated as admin", () => {
    expect(isAdminUser(null)).toBe(false);
  });
});

describe("ShellLayout nav — 7 approved groups (2026-07-17 restructure)", () => {
  it("carries the six non-dashboard groups in the approved order", () => {
    // Dashboards is rendered inline in ShellLayout (Home + custom user
    // dashboards + the "+" affordance) and is not in NAV_GROUPS.
    expect(NAV_GROUPS.map((g) => g.id)).toEqual([
      "estimating",
      "projects",
      "operations",
      "hr",
      "safety",
      "settings"
    ]);
  });

  it("uses the approved group labels", () => {
    const labels: Record<string, string> = {};
    for (const g of NAV_GROUPS) labels[g.id] = g.label;
    expect(labels).toEqual({
      estimating: "Estimating",
      projects: "Projects",
      operations: "Operations",
      hr: "HR",
      safety: "Safety & Compliance",
      settings: "Settings"
    });
  });

  it("Settings is the only role-gated group", () => {
    const adminOnly = NAV_GROUPS.filter((group) => group.adminOnly);
    expect(adminOnly.map((g) => g.id)).toEqual(["settings"]);
  });

  it("Settings surfaces a single entry that opens the Settings shell", () => {
    const settings = NAV_GROUPS.find((g) => g.id === "settings");
    expect(settings?.items).toHaveLength(1);
    expect(settings?.items[0]?.to).toBe("/admin/settings");
    expect(settings?.items[0]?.label).toBe("Settings");
  });

  const allItems = NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ groupId: group.id, ...item }))
  );

  it("Estimating carries Tenders, Contracts, Tender Settings, Directory, Rates & Lists, Reports (in order)", () => {
    const estimating = NAV_GROUPS.find((g) => g.id === "estimating");
    expect(estimating?.items.map((i) => [i.label, i.to])).toEqual([
      ["Tenders", "/tenders"],
      ["Contracts", "/contracts"],
      ["Tender Settings", "/tenders/settings"],
      ["Directory", "/master-data"],
      ["Rates & Lists", "/admin/rates-lists"],
      ["Reports", "/reports"]
    ]);
  });

  it("Projects carries Jobs and Sites (in order)", () => {
    const projects = NAV_GROUPS.find((g) => g.id === "projects");
    expect(projects?.items.map((i) => [i.label, i.to])).toEqual([
      ["Jobs", "/jobs"],
      ["Sites", "/sites"]
    ]);
  });

  it("Operations carries Scheduler, Assets & Equipment (collapsible), Procurement (in order)", () => {
    const operations = NAV_GROUPS.find((g) => g.id === "operations");
    expect(operations?.items.map((i) => i.label)).toEqual([
      "Scheduler",
      "Assets & Equipment",
      "Procurement"
    ]);
    const bundle = operations?.items.find((i) => i.label === "Assets & Equipment");
    expect(bundle?.children?.map((c) => [c.label, c.to])).toEqual([
      ["Assets", "/assets"],
      ["Inventory", "/inventory"],
      ["Maintenance", "/maintenance"]
    ]);
  });

  it("HR carries Workers, Payroll Export, Timesheet Approval (in order)", () => {
    const hr = NAV_GROUPS.find((g) => g.id === "hr");
    expect(hr?.items.map((i) => [i.label, i.to])).toEqual([
      ["Workers", "/workers"],
      ["Payroll Export", "/timesheets/payroll-export"],
      ["Timesheet Approval", "/timesheets/approval"]
    ]);
  });

  it("Safety & Compliance carries Safety, Compliance, Forms, Documents (in order)", () => {
    const safety = NAV_GROUPS.find((g) => g.id === "safety");
    expect(safety?.items.map((i) => [i.label, i.to])).toEqual([
      ["Safety", "/safety"],
      ["Compliance", "/compliance"],
      ["Forms", "/forms"],
      ["Documents", "/documents"]
    ]);
  });

  it("no sidebar entry points at /tenders/dashboard or the seeded system dashboards", () => {
    for (const item of allItems) {
      expect(item.to.startsWith("/tenders/dashboard")).toBe(false);
    }
  });

  it("the Tenders active-match rule does not swallow settings/dashboard/contacts/reports", () => {
    const tenders = allItems.find((i) => i.to === "/tenders" && i.label === "Tenders");
    expect(tenders).toBeDefined();
    expect(tenders?.match).toBeDefined();
    expect(tenders!.match!("/tenders")).toBe(true);
    expect(tenders!.match!("/tenders/settings")).toBe(false);
    expect(tenders!.match!("/tenders/dashboard")).toBe(false);
    expect(tenders!.match!("/tenders/contacts")).toBe(false);
    expect(tenders!.match!("/tenders/reports")).toBe(false);
  });
});
