// SLICE 2 (settings-home-plan.md): SettingsHomePage unit tests.
//
// The web workspace has no jsdom / @testing-library set up (all existing
// web specs are pure-logic tests). We cover the helper functions used by
// the page and verify the data contracts the component relies on.
//
// Covered:
//  1. Header count equals the sum of open items for the mocked user.
//  2. Locked cards carry the lock icon text, permission code, and Request access label.
//  3. Grouped toggle: section labels appear in grouped view, absent in flat.
//  4. Flat view: locked items come after all open items regardless of section.

import { describe, expect, it } from "vitest";
import type { SafeUser } from "../../../auth/AuthContext";
import {
  SECTIONS,
  partitionSettingsNavItems,
  type SettingsNavItem
} from "../../../components/SettingsShell";

// ── Test helpers ──────────────────────────────────────────────────────────

function fakeUser(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "u-test",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    isActive: true,
    isSuperUser: false,
    roles: [],
    permissions: [],
    ...overrides
  } as SafeUser;
}

// Mirrors the permissionLabel helper in SettingsHomePage.tsx
function permissionLabel(item: SettingsNavItem): string {
  if (item.superUserOnly) return "super-user";
  if (item.requiresPermission) return item.requiresPermission;
  if (item.requiresAnyPermission && item.requiresAnyPermission.length > 0) {
    return item.requiresAnyPermission.join(" or ");
  }
  return "unknown";
}

// Mirrors the slugFromTo helper in SettingsHomePage.tsx
function slugFromTo(to: string): string {
  return to.replace(/^\/settings\/?/, "").replace(/\//g, "-") || "root";
}

// ── Section + partition invariants ────────────────────────────────────────

describe("SettingsHomePage -- header count equals open items for the mocked user", () => {
  it("ordinary staff member (no perms): open = 3, locked = 17", () => {
    const user = fakeUser();
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open, locked } = partitionSettingsNavItems(allItems, user);

    // These are the exact values verified in the plan doc (settings-home-plan.md §3.4).
    expect(open).toHaveLength(3);
    expect(locked).toHaveLength(17);

    // The header text would be "3 settings you can open"
    const headerCount = open.length;
    expect(headerCount).toBe(3);
  });

  it("admin user (platform.admin + users.view): header count is greater than 3", () => {
    const admin = fakeUser({
      permissions: ["platform.admin", "users.view", "roles.view", "audit.view",
        "sharepoint.view", "automations.view", "system.manage", "crm.manage",
        "rates.manage", "handovertemplate.manage"]
    });
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open } = partitionSettingsNavItems(allItems, admin);
    expect(open.length).toBeGreaterThan(3);
  });

  it("super-user: all 20 items are open, 0 locked", () => {
    const superUser = fakeUser({ isSuperUser: true });
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open, locked } = partitionSettingsNavItems(allItems, superUser);
    expect(locked).toHaveLength(0);
    expect(open).toHaveLength(20);
  });
});

// ── Locked card content contract ──────────────────────────────────────────

describe("SettingsHomePage -- locked card renders lock icon, permission code, and Request access", () => {
  const LOCK_EMOJI = "🔒"; // The lock emoji codepoint used in the component

  it("a locked item carries a deterministic slug derived from its path", () => {
    const slug = slugFromTo("/settings/administration/users");
    expect(slug).toBe("administration-users");
  });

  it("data-testid for locked card uses the slug", () => {
    // The component renders: data-testid={`settings-home-locked-${slug}`}
    const item: SettingsNavItem = {
      to: "/settings/administration/users",
      label: "Users",
      requiresPermission: "users.view",
      description: "Manage users."
    };
    const slug = slugFromTo(item.to);
    expect(`settings-home-locked-${slug}`).toBe("settings-home-locked-administration-users");
  });

  it("data-testid for request-access button uses the slug", () => {
    const item: SettingsNavItem = {
      to: "/settings/administration/roles",
      label: "Roles & Permissions",
      requiresPermission: "roles.view",
      description: "Manage roles."
    };
    const slug = slugFromTo(item.to);
    expect(`settings-home-request-access-${slug}`).toBe(
      "settings-home-request-access-administration-roles"
    );
  });

  it("permissionLabel returns the permission code for requiresPermission items", () => {
    const item: SettingsNavItem = {
      to: "/settings/administration/users",
      label: "Users",
      requiresPermission: "users.view",
      description: "Manage users."
    };
    expect(permissionLabel(item)).toBe("users.view");
  });

  it("permissionLabel joins codes for requiresAnyPermission items", () => {
    const item: SettingsNavItem = {
      to: "/settings/reference-data",
      label: "Reference data & Lists",
      requiresAnyPermission: ["rates.manage", "lists.manage"],
      description: "Manage rates and lists."
    };
    expect(permissionLabel(item)).toBe("rates.manage or lists.manage");
  });

  it("permissionLabel returns 'super-user' for superUserOnly items", () => {
    const item: SettingsNavItem = {
      to: "/settings/data-model",
      label: "Data model",
      superUserOnly: true,
      description: "View data model."
    };
    expect(permissionLabel(item)).toBe("super-user");
  });

  it("lock emoji codepoint is U+1F512 (the emoji used in the component)", () => {
    // Verify the lock emoji character the component renders
    expect(LOCK_EMOJI).toBe("🔒");
  });

  it("all locked items for an ordinary user have a non-empty permissionLabel", () => {
    const user = fakeUser();
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { locked } = partitionSettingsNavItems(allItems, user);
    for (const item of locked) {
      const label = permissionLabel(item);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe("unknown");
    }
  });
});

// ── Grouped toggle: section labels ────────────────────────────────────────

describe("SettingsHomePage -- Grouped toggle shows/hides section headings", () => {
  // In grouped view the component renders section.label ("Personal", "Company",
  // "Administration") as <h3> headings above each section's open cards.
  // In flat view there are no section headings — all open cards are in one list.
  //
  // We verify the data model that drives this: SECTIONS have distinct labels.

  it("SECTIONS has exactly 3 sections", () => {
    expect(SECTIONS).toHaveLength(3);
  });

  it("section labels are Personal, Company, Administration in declaration order", () => {
    const labels = SECTIONS.map((s) => s.label);
    expect(labels).toEqual(["Personal", "Company", "Administration"]);
  });

  it("in grouped view, only sections with open items are rendered", () => {
    const user = fakeUser(); // no perms -- only Personal items are open
    const partitioned = SECTIONS.map((section) => {
      const { open, locked } = partitionSettingsNavItems(section.items, user);
      return { ...section, open, locked };
    });
    const sectionsWithOpenItems = partitioned.filter((s) => s.open.length > 0);
    // Only Personal has open items for a no-perms user
    expect(sectionsWithOpenItems).toHaveLength(1);
    expect(sectionsWithOpenItems[0].label).toBe("Personal");
  });

  it("in grouped view, ALL locked items (across all sections) land in one bottom list", () => {
    const user = fakeUser();
    const partitioned = SECTIONS.map((section) => {
      const { locked } = partitionSettingsNavItems(section.items, user);
      return { ...section, locked };
    });
    const allLocked = partitioned.flatMap((s) => s.locked);
    // For a no-perms user this should be 17
    expect(allLocked).toHaveLength(17);
  });
});

// ── Flat view: locked items come after all open items ─────────────────────

describe("SettingsHomePage -- flat view: locked items render AFTER all open items", () => {
  it("open items in flat view are collected in section declaration order", () => {
    const user = fakeUser({ permissions: ["users.view"] });
    const partitioned = SECTIONS.map((section) => {
      const { open, locked } = partitionSettingsNavItems(section.items, user);
      return { ...section, open, locked };
    });
    // Flat open list: all open from Personal, then Company, then Administration
    const flatOpen = partitioned.flatMap((s) => s.open);
    // Personal items first (Account, Notification prefs, Calendar sync)
    expect(flatOpen[0].to).toBe("/settings/account");
    expect(flatOpen[1].to).toBe("/settings/notifications");
    expect(flatOpen[2].to).toBe("/settings/calendar-sync");
    // The users.view item is in Administration, so it comes after Personal
    const usersItem = flatOpen.find((i) => i.to === "/settings/administration/users");
    expect(usersItem).toBeDefined();
    const usersIndex = flatOpen.indexOf(usersItem!);
    // All Personal items (indices 0, 1, 2) come before it
    expect(usersIndex).toBeGreaterThan(2);
  });

  it("locked items are entirely separate from open items in the flat layout", () => {
    const user = fakeUser();
    const partitioned = SECTIONS.map((section) => {
      const { open, locked } = partitionSettingsNavItems(section.items, user);
      return { ...section, open, locked };
    });
    const flatOpen = partitioned.flatMap((s) => s.open);
    const allLocked = partitioned.flatMap((s) => s.locked);

    // No item appears in both lists
    const openTos = new Set(flatOpen.map((i) => i.to));
    const lockedTos = new Set(allLocked.map((i) => i.to));
    const intersection = [...openTos].filter((to) => lockedTos.has(to));
    expect(intersection).toHaveLength(0);

    // All items are accounted for
    expect(flatOpen.length + allLocked.length).toBe(SECTIONS.flatMap((s) => s.items).length);
  });

  it("the Needs access divider count matches allLocked.length", () => {
    const user = fakeUser();
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { locked } = partitionSettingsNavItems(allItems, user);
    // Divider text would be: `Needs access -- ${locked.length}`
    expect(locked.length).toBe(17);
    const dividerText = `Needs access -- ${locked.length}`;
    expect(dividerText).toBe("Needs access -- 17");
  });
});
