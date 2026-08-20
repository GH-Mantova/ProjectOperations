// settings-search.test.ts
// SLICE 3 (settings-home-plan.md §4 SLICE 3): pure vitest tests for the
// searchSettings function.  No jsdom — mirrors the style of the existing
// SettingsHomePage.test.tsx (pure-logic tests).
//
// Covered:
//  1. Typing a label surfaces the matching item.
//  2. Typing a tab label surfaces the parent item with an href containing ?tab=.
//  3. Typing a description fragment surfaces the matching item.
//  4. Locked items appear in results with locked=true preserved.
//  5. Empty query returns empty results (caller renders full home view).
//  6. A query matching nothing returns empty results (caller renders empty state).
//  7. Case-insensitive matching works.

import { describe, expect, it } from "vitest";
import type { SafeUser } from "../../../auth/AuthContext";
import { searchSettings } from "../settings-search";
import { SECTIONS } from "../../../components/SettingsShell";

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

const NO_PERMS_USER = fakeUser();
const SUPER_USER = fakeUser({ isSuperUser: true });

// ── Empty query ────────────────────────────────────────────────────────────

describe("searchSettings -- empty query", () => {
  it("returns empty array for an empty string", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "");
    expect(results).toHaveLength(0);
  });

  it("returns empty array for a whitespace-only string", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "   ");
    expect(results).toHaveLength(0);
  });
});

// ── No-match query ─────────────────────────────────────────────────────────

describe("searchSettings -- no-match query", () => {
  it("returns empty array when nothing matches", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "xyzzy-no-match-ever");
    expect(results).toHaveLength(0);
  });
});

// ── Label match ────────────────────────────────────────────────────────────

describe("searchSettings -- label match", () => {
  it("searching 'Account' returns the Account item", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "Account");
    const match = results.find((r) => r.item.to === "/settings/account");
    expect(match).toBeDefined();
  });

  it("the Account item is not locked for a no-perms user", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "Account");
    const match = results.find((r) => r.item.to === "/settings/account");
    expect(match?.locked).toBe(false);
  });

  it("the href for an item-level match equals item.to", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "Account");
    const match = results.find((r) => r.item.to === "/settings/account" && !r.matchedTab);
    expect(match?.href).toBe("/settings/account");
  });

  it("searching 'Audit' returns the Audit item", () => {
    const results = searchSettings(SECTIONS, SUPER_USER, "Audit");
    const match = results.find((r) => r.item.to === "/settings/administration/audit");
    expect(match).toBeDefined();
  });

  it("searching 'Calendar' returns Calendar sync", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "Calendar");
    const match = results.find((r) => r.item.to === "/settings/calendar-sync");
    expect(match).toBeDefined();
  });
});

// ── Description match ─────────────────────────────────────────────────────

describe("searchSettings -- description match", () => {
  it("searching a description fragment 'default dashboard' surfaces Account", () => {
    // Account description: "View your profile, choose your default dashboard..."
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "default dashboard");
    const match = results.find((r) => r.item.to === "/settings/account");
    expect(match).toBeDefined();
  });

  it("searching 'audit log' surfaces Audit via description", () => {
    // Audit description: "Review the platform audit log..."
    const results = searchSettings(SECTIONS, SUPER_USER, "audit log");
    const match = results.find((r) => r.item.to === "/settings/administration/audit");
    expect(match).toBeDefined();
  });

  it("searching 'Xero' surfaces Xero file exchange item", () => {
    const results = searchSettings(SECTIONS, SUPER_USER, "Xero");
    const match = results.find((r) => r.item.to === "/settings/administration/xero-exchange");
    expect(match).toBeDefined();
  });
});

// ── Tab match ─────────────────────────────────────────────────────────────

describe("searchSettings -- tab match", () => {
  it("searching a tab label returns a result with ?tab= in the href", () => {
    // Company item has tab id "branding" with label "Branding"
    const results = searchSettings(SECTIONS, SUPER_USER, "Branding");
    const tabResult = results.find(
      (r) => r.item.to === "/settings/company" && r.matchedTab?.id === "branding"
    );
    expect(tabResult).toBeDefined();
    expect(tabResult?.href).toBe("/settings/company?tab=branding");
  });

  it("tab match href contains ?tab=<id>", () => {
    // AI settings has tab "company" with label "Company"
    // and tab "mine" with label "My Settings"
    const results = searchSettings(SECTIONS, SUPER_USER, "My Settings");
    const tabResult = results.find(
      (r) => r.item.to === "/settings/ai" && r.matchedTab?.id === "mine"
    );
    expect(tabResult).toBeDefined();
    expect(tabResult?.href).toContain("?tab=mine");
  });

  it("tab match via description also produces a ?tab= href", () => {
    // Admin settings tab "geofences" has description containing "GPS"
    const results = searchSettings(SECTIONS, SUPER_USER, "GPS");
    const tabResult = results.find(
      (r) =>
        r.item.to === "/settings/administration/system" &&
        r.matchedTab?.id === "geofences"
    );
    expect(tabResult).toBeDefined();
    expect(tabResult?.href).toBe("/settings/administration/system?tab=geofences");
  });

  it("tab match records the matched tab in matchedTab", () => {
    const results = searchSettings(SECTIONS, SUPER_USER, "Legal documents");
    const tabResult = results.find(
      (r) => r.item.to === "/settings/company" && r.matchedTab?.id === "legal"
    );
    expect(tabResult?.matchedTab?.label).toBe("Legal documents");
  });

  it("item-level match does not set matchedTab", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "Account");
    const itemResult = results.find(
      (r) => r.item.to === "/settings/account" && !r.matchedTab
    );
    expect(itemResult).toBeDefined();
    expect(itemResult?.matchedTab).toBeUndefined();
  });
});

// ── Locked items in results ────────────────────────────────────────────────

describe("searchSettings -- locked items in results", () => {
  it("a locked item appears in results with locked=true", () => {
    // Users item requires users.view; no-perms user cannot access it
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "Users");
    const match = results.find(
      (r) => r.item.to === "/settings/administration/users"
    );
    expect(match).toBeDefined();
    expect(match?.locked).toBe(true);
  });

  it("a locked tab match also carries locked=true", () => {
    // Company tabs are locked for no-perms user (platform.admin required)
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "Branding");
    const match = results.find(
      (r) => r.item.to === "/settings/company" && r.matchedTab?.id === "branding"
    );
    expect(match).toBeDefined();
    expect(match?.locked).toBe(true);
  });

  it("a super-user sees all items as locked=false", () => {
    const results = searchSettings(SECTIONS, SUPER_USER, "e");
    // Every result should be unlocked for super-user
    for (const result of results) {
      expect(result.locked).toBe(false);
    }
  });

  it("locked items appear alongside open items in the same result array", () => {
    // Search 'sync' matches Calendar sync (open) and possibly other items.
    // We just assert that open items can coexist with locked ones in results.
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "sync");
    const openResults = results.filter((r) => !r.locked);
    expect(openResults.length).toBeGreaterThan(0);
  });
});

// ── Case-insensitive matching ──────────────────────────────────────────────

describe("searchSettings -- case-insensitive matching", () => {
  it("lowercase query matches a title-cased label", () => {
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "account");
    const match = results.find((r) => r.item.to === "/settings/account");
    expect(match).toBeDefined();
  });

  it("uppercase query matches a lowercase description word", () => {
    // "dashboard" is lowercase in the Account description
    const results = searchSettings(SECTIONS, NO_PERMS_USER, "DASHBOARD");
    const match = results.find((r) => r.item.to === "/settings/account");
    expect(match).toBeDefined();
  });

  it("mixed-case query matches a tab label", () => {
    const results = searchSettings(SECTIONS, SUPER_USER, "bRANDING");
    const match = results.find(
      (r) => r.item.to === "/settings/company" && r.matchedTab?.id === "branding"
    );
    expect(match).toBeDefined();
  });
});
