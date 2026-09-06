// SLICE 1 (settings-home-plan.md): coverage test — enforces that every
// settings nav item has a non-empty description and a tabs array.
//
// This test fails the moment a contributor adds a new settings page and
// forgets to supply a description or declare tabs.  It is deliberately
// strict: a page with genuinely no tabs must be named in the
// EXPECTED_NO_TABS list below — the test will not silently accept a
// blanket empty array.

import { describe, expect, it } from "vitest";
import { SECTIONS } from "../SettingsShell";

// Pages that have been verified as having no internal tab strip.
// Add a new entry here only when the page genuinely has no tabs.
// The route `to` value is used as the identifier.
const EXPECTED_NO_TABS = new Set<string>([
  // Personal — none of these pages have internal tabs.
  "/settings/account",
  "/settings/notifications",
  "/settings/calendar-sync",
  // Company — pages with no tab strip.
  "/settings/handover-template",
  "/settings/data-model",
  "/settings/companies",
  // Administration — all single-surface pages with no internal tabs.
  "/settings/administration/users",
  "/settings/administration/roles",
  "/settings/administration/audit",
  "/settings/administration/platform",
  "/settings/administration/automations",
  "/settings/administration/client-versions",
  "/settings/administration/map-locations",
  "/settings/administration/xero-exchange",
  "/settings/administration/crm-drop-reasons",
  // Elsewhere — the two settings pages that live outside /settings
  // (SETTINGS_HOME_S1).  Neither has an internal tab strip.
  "/admin/schedule-of-rates",
  "/workers/job-roles"
]);

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

describe("settings nav — description coverage", () => {
  it.each(ALL_ITEMS.map((item) => ({ to: item.to, label: item.label, item })))(
    "$label ($to) has a non-empty description",
    ({ item }) => {
      expect(item.description).toBeDefined();
      expect(typeof item.description).toBe("string");
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  );
});

describe("settings nav — tabs coverage", () => {
  it.each(ALL_ITEMS.map((item) => ({ to: item.to, label: item.label, item })))(
    "$label ($to) declares a tabs array",
    ({ item }) => {
      expect(item.tabs).toBeDefined();
      expect(Array.isArray(item.tabs)).toBe(true);
    }
  );

  it.each(
    ALL_ITEMS
      .filter((item) => !EXPECTED_NO_TABS.has(item.to))
      .map((item) => ({ to: item.to, label: item.label, item }))
  )(
    "$label ($to) has at least one tab (not in EXPECTED_NO_TABS)",
    ({ item }) => {
      // This item is not in the expected-no-tabs list, so it must declare
      // at least one tab.  If this fails, either add the page to
      // EXPECTED_NO_TABS (if it genuinely has no tabs) or populate its tabs
      // array in settings-nav-items.ts.
      expect(item.tabs!.length).toBeGreaterThan(0);
    }
  );

  it.each(
    ALL_ITEMS
      .filter((item) => item.tabs && item.tabs.length > 0)
      .flatMap((item) =>
        (item.tabs ?? []).map((tab) => ({
          itemLabel: item.label,
          tabId: tab.id,
          tabLabel: tab.label,
          tabDescription: tab.description
        }))
      )
  )(
    "tab '$tabId' on $itemLabel has non-empty label and description",
    ({ tabLabel, tabDescription }) => {
      expect(tabLabel.trim().length).toBeGreaterThan(0);
      expect(tabDescription.trim().length).toBeGreaterThan(0);
    }
  );

  it("EXPECTED_NO_TABS only names items that actually exist in SECTIONS", () => {
    const allTos = new Set(ALL_ITEMS.map((i) => i.to));
    for (const to of EXPECTED_NO_TABS) {
      expect(allTos.has(to), `EXPECTED_NO_TABS entry "${to}" is not in SECTIONS — remove it`).toBe(
        true
      );
    }
  });

  it("every item in EXPECTED_NO_TABS actually has an empty tabs array (not accidentally populated)", () => {
    for (const item of ALL_ITEMS) {
      if (EXPECTED_NO_TABS.has(item.to)) {
        expect(
          item.tabs,
          `${item.label} is in EXPECTED_NO_TABS but has tabs populated — remove it from EXPECTED_NO_TABS or clear its tabs array`
        ).toHaveLength(0);
      }
    }
  });
});
