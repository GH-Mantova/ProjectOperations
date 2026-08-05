// Sidebar restructure (Marco 2026-07-17): the desktop nav is organised into
// the 7 approved groups. The Dashboards group is rendered inline in
// ShellLayout (it owns the "+ new dashboard" affordance and the dynamic list
// of user-created dashboards), so NAV_GROUPS carries the other six. These
// tests lock the group ids/labels/ordering, the role gate on the Settings
// group, and the "Tenders" active-match rule.

import { describe, expect, it } from "vitest";
import type { SafeUser } from "../../auth/AuthContext";
import { can, isAdminUser } from "../../auth/permissions";
import { NAV_GROUPS, pickMobileTabItem } from "../ShellLayout";

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

  it("no sidebar group is role-gated at the group level (SLICE 3: settings-restructure)", () => {
    // SLICE 3 drops adminOnly on the Settings group. Every group now
    // renders for all authenticated users; per-item requiresPermission
    // decides which entries surface inside a group. The SettingsShell
    // then does the same for its own sub-nav (Company/Administration).
    const adminOnly = NAV_GROUPS.filter((group) => group.adminOnly);
    expect(adminOnly).toEqual([]);
  });

  it("Settings surfaces a single entry that opens the Settings shell", () => {
    const settings = NAV_GROUPS.find((g) => g.id === "settings");
    expect(settings?.items).toHaveLength(1);
    expect(settings?.items[0]?.to).toBe("/settings");
    expect(settings?.items[0]?.label).toBe("Settings");
  });

  const allItems = NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ groupId: group.id, ...item }))
  );

  it("Estimating carries Tenders, Contracts, Directory, Rates & Lists, Reports (in order)", () => {
    const estimating = NAV_GROUPS.find((g) => g.id === "estimating");
    expect(estimating?.items.map((i) => [i.label, i.to])).toEqual([
      ["Tenders", "/tenders"],
      ["Contracts", "/contracts"],
      ["Directory", "/directory"],
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

  it("Operations carries Scheduler, Live crew map, Assets & Equipment (collapsible), Procurement (in order)", () => {
    const operations = NAV_GROUPS.find((g) => g.id === "operations");
    expect(operations?.items.map((i) => i.label)).toEqual([
      "Scheduler",
      "Live crew map",
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

  it("HR carries Workers, Leave Approvals, Payroll Export, Timesheet Approval, Dockets, Expenses (in order)", () => {
    const hr = NAV_GROUPS.find((g) => g.id === "hr");
    expect(hr?.items.map((i) => [i.label, i.to])).toEqual([
      ["Workers", "/workers"],
      ["Leave Approvals", "/workers/leave-approvals"],
      ["Payroll Export", "/timesheets/payroll-export"],
      ["Timesheet Approval", "/timesheets/approval"],
      ["Dockets", "/dockets"],
      ["Expenses", "/expenses"]
    ]);
  });

  it("Safety & Compliance carries Safety, Cases, Knowledge Base, Compliance, Forms, Documents (in order)", () => {
    const safety = NAV_GROUPS.find((g) => g.id === "safety");
    expect(safety?.items.map((i) => [i.label, i.to])).toEqual([
      ["Safety", "/safety"],
      ["Cases", "/cases"],
      ["Knowledge Base", "/knowledge"],
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

  it("the Tenders active-match rule does not swallow contacts (and settings/reports are deleted)", () => {
    const tenders = allItems.find((i) => i.to === "/tenders" && i.label === "Tenders");
    expect(tenders).toBeDefined();
    expect(tenders?.match).toBeDefined();
    expect(tenders!.match!("/tenders")).toBe(true);
    expect(tenders!.match!("/tenders/contacts")).toBe(false);
    // /tenders/settings and /tenders/reports no longer exist as routes (deleted
    // by PR #841 and PR #844); the match falling through them is harmless
    // because neither renders a page nor has a sidebar entry.
  });
});

// Per-item permission gates (sidebar sanity — audit 2026-07-31). Every entry
// whose backing API requires a *.view or *.manage permission is hidden from
// users who lack it, so non-holders don't see a menu full of items that 403.
// The mapping below mirrors the actual API decorator on each page's primary
// controller (verified by grepping RequirePermissions per module).
describe("ShellLayout nav — per-item permission gates", () => {
  const EXPECTED_GATES: Array<{ label: string; permission: string }> = [
    // CRM sidebar entry deleted by PR #841 — CRM now lives only as a tab on
    // the Tenders page, so there's no top-level nav item to gate.
    { label: "Tenders", permission: "tenders.view" },
    // Contracts API gates on finance.view (legacy naming from when contracts
    // lived under the finance module), NOT contracts.view.
    { label: "Contracts", permission: "finance.view" },
    // Unified Directory (/directory) — clients, subcontractors & suppliers,
    // contacts. Primary API is directory.controller.ts (directory.view).
    { label: "Directory", permission: "directory.view" },
    { label: "Reports", permission: "reporting.view" },
    { label: "Jobs", permission: "jobs.view" },
    // Sites list hits /master-data/sites — masterdata.view, not sites.view.
    { label: "Sites", permission: "masterdata.view" },
    { label: "Scheduler", permission: "scheduler.view" },
    { label: "Live crew map", permission: "scheduler.view" },
    { label: "Procurement", permission: "procurement.view" },
    // Workers roster hits /workers which requires resources.view (the
    // WorkerProfile entity was carved out of the Resources module).
    { label: "Workers", permission: "resources.view" },
    // Leave Approvals hits /workers/leave-requests/pending + /decide which
    // require workers.manage (leave-request.controller.ts:124,135,160).
    { label: "Leave Approvals", permission: "workers.manage" },
    { label: "Payroll Export", permission: "field.manage" },
    { label: "Timesheet Approval", permission: "field.manage" },
    // Back-office dockets register — GET /field/dockets is field.view.
    { label: "Dockets", permission: "field.view" },
    // Expenses register — GET /expenses is expenses.view.
    { label: "Expenses", permission: "expenses.view" },
    { label: "Safety", permission: "safety.view" },
    { label: "Cases", permission: "cases.view" },
    { label: "Knowledge Base", permission: "knowledge.view" },
    { label: "Compliance", permission: "compliance.view" },
    { label: "Forms", permission: "forms.view" },
    { label: "Documents", permission: "documents.view" }
  ];

  const EXPECTED_CHILD_GATES: Array<{ label: string; permission: string }> = [
    { label: "Assets", permission: "assets.view" },
    { label: "Inventory", permission: "inventory.view" },
    { label: "Maintenance", permission: "maintenance.view" }
  ];

  const leafItems = NAV_GROUPS.flatMap((g) => g.items);
  const childItems = leafItems.flatMap((i) => i.children ?? []);

  it.each(EXPECTED_GATES)("%o is gated on the expected permission", ({ label, permission }) => {
    const item = leafItems.find((i) => i.label === label);
    expect(item, `expected leaf item labelled "${label}"`).toBeDefined();
    expect(item?.requiresPermission).toBe(permission);
  });

  it.each(EXPECTED_CHILD_GATES)("%o (child) is gated on the expected permission", ({ label, permission }) => {
    const child = childItems.find((c) => c.label === label);
    expect(child, `expected child item labelled "${label}"`).toBeDefined();
    expect(child?.requiresPermission).toBe(permission);
  });

  it("mobile tab bar: pickMobileTabItem skips sub-group parents (relative `to`) and returns a routable item", () => {
    // Operations' first item is Scheduler (routable); the Assets & Equipment
    // bundle at index 2 is a collapsible parent with a relative `to`. Even if
    // Scheduler were filtered out by permissions, the picker must still skip
    // the bundle parent and land on Procurement, never on the relative path.
    const operations = NAV_GROUPS.find((g) => g.id === "operations")!;
    for (const item of operations.items) {
      if (item.to.startsWith("/")) continue;
      // Confirms the picker skips this exact shape (a sub-group parent).
      expect(item.children).toBeDefined();
    }
    const picked = pickMobileTabItem(operations);
    expect(picked?.to.startsWith("/")).toBe(true);

    // Synthetic: a group whose only qualifying item is the bundle parent
    // must produce no tab (undefined) rather than an unroutable URL.
    const bundleOnly = {
      id: "x",
      label: "X",
      items: [operations.items.find((i) => !i.to.startsWith("/"))!]
    };
    expect(pickMobileTabItem(bundleOnly)).toBeUndefined();
  });

  it("mobile tab bar: every NAV_GROUPS picked item is an absolute route", () => {
    // Every group with at least one routable item must yield a `/`-prefixed
    // tab target; the Home tab (rendered separately in ShellLayout) covers
    // "/" itself.
    for (const group of NAV_GROUPS) {
      const picked = pickMobileTabItem(group);
      if (picked) expect(picked.to.startsWith("/")).toBe(true);
    }
  });

  it("regression: `can(user)` short-circuits on isSuperUser so gated items still show for super-users (STEP-0 lesson)", () => {
    // Locking this in a test — the entire per-item gate is safe only because
    // can() returns true unconditionally when isSuperUser === true. If that
    // ever regresses, super-users get a blank sidebar.
    const superUser: SafeUser = {
      id: "u1",
      email: "s@example.com",
      firstName: "S",
      lastName: "U",
      isActive: true,
      isSuperUser: true,
      roles: [],
      permissions: []
    } as SafeUser;
    for (const { permission } of EXPECTED_GATES) {
      expect(can(superUser, permission)).toBe(true);
    }
    for (const { permission } of EXPECTED_CHILD_GATES) {
      expect(can(superUser, permission)).toBe(true);
    }
  });
});
