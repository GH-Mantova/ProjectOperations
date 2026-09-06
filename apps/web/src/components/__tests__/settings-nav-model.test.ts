// SLICE 1 (settings-home-plan.md): unit tests for partitionSettingsNavItems.
//
// Item counts verified directly from SettingsShell.tsx + settings-nav-items.ts
// on 2026-09-06 (SETTINGS_HOME_S1):
//   Personal (3, all ungated) + Company (7, all gated) + Administration (10,
//   all gated) + Elsewhere (2, all gated) = 22 total.
//   A user with no permissions or roles sees 3 open, 19 locked.
//   "Elsewhere" holds the two settings pages that live outside /settings and
//   are linked in place: Schedule of Rates and Job roles.

import { describe, expect, it } from "vitest";
import type { SafeUser } from "../../auth/AuthContext";
import {
  partitionSettingsNavItems,
  SECTIONS,
  ADMINISTRATION_ITEMS
} from "../SettingsShell";
import { EXTERNAL_ITEMS } from "../settings-nav-items";

// ── Test helpers ──────────────────────────────────────────────────────────

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

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

// ── partitionSettingsNavItems ─────────────────────────────────────────────

describe("partitionSettingsNavItems", () => {
  it("a super-user sees no locked items", () => {
    const superUser = fakeUser({ isSuperUser: true });
    const { open, locked } = partitionSettingsNavItems(ALL_ITEMS, superUser);
    expect(locked).toHaveLength(0);
    expect(open).toHaveLength(ALL_ITEMS.length);
  });

  it("a user with no permissions sees 3 open and 19 locked", () => {
    const noPermsUser = fakeUser({ isSuperUser: false, permissions: [], roles: [] });
    const { open, locked } = partitionSettingsNavItems(ALL_ITEMS, noPermsUser);
    expect(open).toHaveLength(3);
    expect(locked).toHaveLength(19);
    // The 3 open items must be the Personal section items.
    expect(open.map((i) => i.to)).toEqual([
      "/settings/account",
      "/settings/notifications",
      "/settings/calendar-sync"
    ]);
  });

  it("a null user sees 3 open (ungated personal items) and 19 locked", () => {
    const { open, locked } = partitionSettingsNavItems(ALL_ITEMS, null);
    expect(open).toHaveLength(3);
    expect(locked).toHaveLength(19);
  });

  it("a user with users.view sees the Users item in open", () => {
    const usersViewer = fakeUser({ permissions: ["users.view"] });
    const { open } = partitionSettingsNavItems(ADMINISTRATION_ITEMS, usersViewer);
    const usersItem = open.find((i) => i.label === "Users");
    expect(usersItem).toBeDefined();
    expect(usersItem?.to).toBe("/settings/administration/users");
  });

  it("an item with requiresAnyPermission lands in open when the user holds any listed code", () => {
    // Reference data & Lists requires rates.manage OR lists.manage.
    const listsManager = fakeUser({ permissions: ["lists.manage"] });
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open } = partitionSettingsNavItems(allItems, listsManager);
    const refDataItem = open.find((i) => i.to === "/settings/reference-data");
    expect(refDataItem).toBeDefined();

    // Verify it works with the other permitted code too.
    const ratesManager = fakeUser({ permissions: ["rates.manage"] });
    const { open: open2 } = partitionSettingsNavItems(allItems, ratesManager);
    const refDataItem2 = open2.find((i) => i.to === "/settings/reference-data");
    expect(refDataItem2).toBeDefined();
  });

  it("an item with requiresAnyPermission lands in locked when user holds none of the codes", () => {
    const unrelated = fakeUser({ permissions: ["audit.view"] });
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { locked } = partitionSettingsNavItems(allItems, unrelated);
    const refDataItem = locked.find((i) => i.to === "/settings/reference-data");
    expect(refDataItem).toBeDefined();
  });

  it("open and locked together contain every input item exactly once", () => {
    const noPermsUser = fakeUser({});
    const { open, locked } = partitionSettingsNavItems(ALL_ITEMS, noPermsUser);
    const combined = [...open, ...locked];
    expect(combined).toHaveLength(ALL_ITEMS.length);
    // No duplicates: every item's `to` appears exactly once.
    const tos = combined.map((i) => i.to);
    const unique = new Set(tos);
    expect(unique.size).toBe(ALL_ITEMS.length);
    // No overlap: no `to` appears in both open and locked.
    const openTos = new Set(open.map((i) => i.to));
    const lockedTos = new Set(locked.map((i) => i.to));
    for (const t of openTos) {
      expect(lockedTos.has(t)).toBe(false);
    }
  });

  it("order within open and locked follows declaration order", () => {
    const noPermsUser = fakeUser({});
    const { open } = partitionSettingsNavItems(ALL_ITEMS, noPermsUser);
    // Personal items are the only open items for a no-perms user, in order.
    expect(open[0]?.to).toBe("/settings/account");
    expect(open[1]?.to).toBe("/settings/notifications");
    expect(open[2]?.to).toBe("/settings/calendar-sync");
  });

  it("super-user-only items are locked for a non-super user regardless of permissions", () => {
    // Data model, Field definitions, Companies are superUserOnly.
    const adminUser = fakeUser({ permissions: ["platform.admin", "system.manage", "users.view"] });
    const { locked } = partitionSettingsNavItems(ALL_ITEMS, adminUser);
    const superOnlyLocked = locked.filter((i) => i.superUserOnly);
    expect(superOnlyLocked.map((i) => i.to)).toEqual([
      "/settings/data-model",
      "/settings/field-definitions",
      "/settings/companies"
    ]);
  });

  it("super-user-only items are open for a super user", () => {
    const superUser = fakeUser({ isSuperUser: true });
    const { open } = partitionSettingsNavItems(ALL_ITEMS, superUser);
    const superOnlyOpen = open.filter((i) => i.superUserOnly);
    expect(superOnlyOpen.length).toBeGreaterThanOrEqual(3);
  });
});

// ── SETTINGS_HOME_S1: descriptions are the approved copy ──────────────────

describe("settings nav — approved descriptions", () => {
  it("no item still carries an inferred-from-the-code description marker", () => {
    // The VERIFY block asserts the same thing with a grep over the file; this
    // asserts it over the data the app actually renders.
    for (const item of ALL_ITEMS) {
      expect(item.description).not.toMatch(/GUESS/i);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("every description is distinct — no page borrowed another's copy", () => {
    const descriptions = ALL_ITEMS.map((i) => i.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("CRM drop reasons kept its card and carries the 2026-09-05 approved line", () => {
    const item = ALL_ITEMS.find((i) => i.to === "/settings/administration/crm-drop-reasons");
    expect(item).toBeDefined();
    expect(item!.description).toBe(
      "Why an opportunity was dropped — the list your team picks from when they close one out."
    );
  });
});

// ── SETTINGS_HOME_S1: the two pages that live outside /settings ───────────

describe("settings nav — EXTERNAL_ITEMS", () => {
  it("declares exactly the two pages Marco named, at their existing routes", () => {
    expect(EXTERNAL_ITEMS.map((i) => [i.label, i.to])).toEqual([
      ["Schedule of Rates", "/admin/schedule-of-rates"],
      ["Job roles", "/workers/job-roles"]
    ]);
  });

  it("each carries the guard its destination actually enforces", () => {
    // Neither route is wrapped in RequirePermissions (App.tsx:613 and :377 are
    // bare <Route> elements). The guard lives on the page itself:
    // ScheduleOfRatesAdminPage:514 renders <NoAccess required="rates.manage" />
    // and JobRolesPage:51 renders <NoAccess required="resources.view" />
    // (PR #1700, mirroring job-roles.controller.ts:26). A card must never
    // advertise a page that would refuse the click.
    expect(EXTERNAL_ITEMS[0].requiresPermission).toBe("rates.manage");
    expect(EXTERNAL_ITEMS[1].requiresPermission).toBe("resources.view");
  });

  it("both are flagged external, and nothing under /settings is", () => {
    for (const item of EXTERNAL_ITEMS) {
      expect(item.external).toBe(true);
      expect(item.to.startsWith("/settings")).toBe(false);
    }
    const internal = ALL_ITEMS.filter((i) => i.to.startsWith("/settings"));
    expect(internal.length).toBe(20);
    for (const item of internal) {
      expect(item.external).toBeUndefined();
    }
  });

  it("they are reachable through SECTIONS, so search and the counts line see them", () => {
    const tos = ALL_ITEMS.map((i) => i.to);
    expect(tos).toContain("/admin/schedule-of-rates");
    expect(tos).toContain("/workers/job-roles");
    expect(ALL_ITEMS).toHaveLength(22);
  });

  it("a user holding only rates.manage can open Schedule of Rates but not Job roles", () => {
    const ratesUser = fakeUser({ permissions: ["rates.manage"] });
    const { open, locked } = partitionSettingsNavItems(EXTERNAL_ITEMS, ratesUser);
    expect(open.map((i) => i.to)).toEqual(["/admin/schedule-of-rates"]);
    expect(locked.map((i) => i.to)).toEqual(["/workers/job-roles"]);
  });

  it("a user holding only resources.view can open Job roles but not Schedule of Rates", () => {
    const resourcesUser = fakeUser({ permissions: ["resources.view"] });
    const { open, locked } = partitionSettingsNavItems(EXTERNAL_ITEMS, resourcesUser);
    expect(open.map((i) => i.to)).toEqual(["/workers/job-roles"]);
    expect(locked.map((i) => i.to)).toEqual(["/admin/schedule-of-rates"]);
  });
});
