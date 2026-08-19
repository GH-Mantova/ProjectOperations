// SLICE 1 (settings-home-plan.md): unit tests for partitionSettingsNavItems.
//
// Item counts verified directly from SettingsShell.tsx + settings-nav-items.ts
// on 2026-08-19:
//   Personal (3, all ungated) + Company (7, all gated) + Administration (10, all gated)
//   = 20 total.
//   A user with no permissions or roles sees 3 open, 17 locked.

import { describe, expect, it } from "vitest";
import type { SafeUser } from "../../auth/AuthContext";
import {
  partitionSettingsNavItems,
  SECTIONS,
  ADMINISTRATION_ITEMS
} from "../SettingsShell";

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

  it("a user with no permissions sees 3 open and 17 locked", () => {
    const noPermsUser = fakeUser({ isSuperUser: false, permissions: [], roles: [] });
    const { open, locked } = partitionSettingsNavItems(ALL_ITEMS, noPermsUser);
    expect(open).toHaveLength(3);
    expect(locked).toHaveLength(17);
    // The 3 open items must be the Personal section items.
    expect(open.map((i) => i.to)).toEqual([
      "/settings/account",
      "/settings/notifications",
      "/settings/calendar-sync"
    ]);
  });

  it("a null user sees 3 open (ungated personal items) and 17 locked", () => {
    const { open, locked } = partitionSettingsNavItems(ALL_ITEMS, null);
    expect(open).toHaveLength(3);
    expect(locked).toHaveLength(17);
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
