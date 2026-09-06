// SLICE 2 (settings-home-plan.md): SettingsHomePage unit tests.
// SETTINGS_HOME_S1 (pr-settings-home-s1-cards-tabs-counts): the card surface —
//   tab chips, the computed counts line, the All items / Grouped toggle, and
//   the route / "needs <permission>" line.
//
// The web workspace has no jsdom / @testing-library. The house pattern is:
//   * numeric and string claims are proven against pure exported helpers;
//   * DOM claims are proven with renderToStaticMarkup from react-dom/server,
//     which needs no DOM (see scope-cards/__tests__ for worked examples).
// SettingsHomeContent takes the user and authFetch as props precisely so it
// can be rendered here without an AuthContext.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { SafeUser } from "../../../auth/AuthContext";
import {
  SECTIONS,
  partitionSettingsNavItems,
  type SettingsNavItem
} from "../../../components/SettingsShell";
import { searchSettings } from "../settings-search";
import {
  SettingsHomeContent,
  collapseSearchResults,
  computeSettingsCounts,
  formatCountsLine,
  highlightSegments,
  permissionLabel,
  routeLineLabel,
  slugFromTo
} from "../SettingsHomePage";

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

const SUPER_USER = fakeUser({ isSuperUser: true });
const NO_PERMS_USER = fakeUser();

const noopFetch = async () => new Response(null, { status: 204 });

function markup(props: Parameters<typeof SettingsHomeContent>[0]): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SettingsHomeContent {...props} />
    </MemoryRouter>
  );
}

// Independent re-derivation of the counts straight from SECTIONS. If the page
// ever hard-codes a figure, these expectations move and the page does not.
function derivedCounts(user: SafeUser | null) {
  const allItems = SECTIONS.flatMap((s) => s.items);
  const { open, locked } = partitionSettingsNavItems(allItems, user);
  return {
    open: open.length,
    tabs: open.reduce((n, i) => n + (i.tabs?.length ?? 0), 0),
    needAccess: locked.length
  };
}

// ── Section + partition invariants ────────────────────────────────────────

describe("SettingsHomePage -- header count equals open items for the mocked user", () => {
  it("ordinary staff member (no perms): open = 3, locked = 19", () => {
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open, locked } = partitionSettingsNavItems(allItems, NO_PERMS_USER);

    // 20 settings pages + the 2 that live outside /settings (SETTINGS_HOME_S1).
    expect(open).toHaveLength(3);
    expect(locked).toHaveLength(19);
  });

  it("admin user (platform.admin + users.view): open count is greater than 3", () => {
    const admin = fakeUser({
      permissions: ["platform.admin", "users.view", "roles.view", "audit.view",
        "sharepoint.view", "automations.view", "system.manage", "crm.manage",
        "rates.manage", "handovertemplate.manage"]
    });
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open } = partitionSettingsNavItems(allItems, admin);
    expect(open.length).toBeGreaterThan(3);
  });

  it("super-user: all 22 items are open, 0 locked", () => {
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open, locked } = partitionSettingsNavItems(allItems, SUPER_USER);
    expect(locked).toHaveLength(0);
    expect(open).toHaveLength(22);
  });
});

// ── The counts line: computed, never printed ──────────────────────────────

describe("SettingsHomePage -- the counts line is computed from settings-nav-items", () => {
  it("a synthetic nav yields the synthetic figures, not the real ones", () => {
    // THIS is the test that catches a hard-coded counts line. computeSettingsCounts
    // is handed a nav that is nothing like the app's, so any literal baked into
    // the function (22, 3, 19, or the mock-up's 11/21/10) fails here.
    const synthetic: Array<{ items: SettingsNavItem[] }> = [
      {
        items: [
          { to: "/a", label: "A", description: "a", tabs: [] },
          {
            to: "/b",
            label: "B",
            description: "b",
            tabs: [
              { id: "t1", label: "T1", description: "t1" },
              { id: "t2", label: "T2", description: "t2" }
            ]
          },
          {
            to: "/c",
            label: "C",
            description: "c",
            requiresPermission: "nobody.has.this",
            // Tabs on a LOCKED item must not be counted — the line says
            // "N tabs" about tabs the user can actually reach.
            tabs: [{ id: "t3", label: "T3", description: "t3" }]
          }
        ]
      }
    ];
    expect(computeSettingsCounts(synthetic, NO_PERMS_USER)).toEqual({
      open: 2,
      tabs: 2,
      needAccess: 1
    });
  });

  it("adding a tab to the synthetic nav moves the tab count by exactly one", () => {
    const base: SettingsNavItem[] = [
      { to: "/a", label: "A", description: "a", tabs: [{ id: "x", label: "X", description: "x" }] }
    ];
    const before = computeSettingsCounts([{ items: base }], NO_PERMS_USER);
    const after = computeSettingsCounts(
      [
        {
          items: [
            {
              ...base[0],
              tabs: [...base[0].tabs!, { id: "y", label: "Y", description: "y" }]
            }
          ]
        }
      ],
      NO_PERMS_USER
    );
    expect(after.tabs).toBe(before.tabs + 1);
  });

  it("re-gating a page moves it from `open` to `need access`", () => {
    const item: SettingsNavItem = { to: "/a", label: "A", description: "a", tabs: [] };
    expect(computeSettingsCounts([{ items: [item] }], NO_PERMS_USER)).toEqual({
      open: 1,
      tabs: 0,
      needAccess: 0
    });
    expect(
      computeSettingsCounts(
        [{ items: [{ ...item, requiresPermission: "nobody.has.this" }] }],
        NO_PERMS_USER
      )
    ).toEqual({ open: 0, tabs: 0, needAccess: 1 });
  });

  it("against the real nav it agrees with an independent re-derivation", () => {
    for (const user of [SUPER_USER, NO_PERMS_USER, fakeUser({ permissions: ["rates.manage"] })]) {
      expect(computeSettingsCounts(SECTIONS, user)).toEqual(derivedCounts(user));
    }
  });

  it("a super user sees every page and every declared tab", () => {
    // 20 settings pages + 2 outside /settings; 22 tabs across them.
    expect(computeSettingsCounts(SECTIONS, SUPER_USER)).toEqual({
      open: 22,
      tabs: 22,
      needAccess: 0
    });
  });

  it("a permission-less user sees a different line, with a non-zero need-access figure", () => {
    const staff = computeSettingsCounts(SECTIONS, NO_PERMS_USER);
    const superUser = computeSettingsCounts(SECTIONS, SUPER_USER);
    expect(staff).not.toEqual(superUser);
    expect(staff.needAccess).toBeGreaterThan(0);
    expect(superUser.needAccess).toBe(0);
  });

  it("formatCountsLine renders the approved wording", () => {
    expect(formatCountsLine({ open: 22, tabs: 22, needAccess: 0 })).toBe(
      "22 settings you can open · 22 tabs · 0 need access"
    );
  });

  it("the rendered counts line carries the computed figures and the approved words", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    const counts = computeSettingsCounts(SECTIONS, SUPER_USER);
    const line = html.slice(html.indexOf('data-testid="settings-home-counts"'));
    expect(line).toContain("settings you can open");
    expect(line).toContain("tabs");
    expect(line).toContain("need access");
    expect(line).toContain(`>${counts.open}<`);
    expect(line).toContain(`>${counts.tabs}<`);
    expect(line).toContain(`>${counts.needAccess}<`);
  });

  it("the mock-up's persona figures are NOT rendered for a super user", () => {
    // The approved PDF printed 11 / 21 / 10 and claimed 30 pages / 47 entries.
    // Marco ruled the page must report what exists; none of those may appear.
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    const line = html.slice(
      html.indexOf('data-testid="settings-home-counts"'),
      html.indexOf('data-testid="settings-home-counts"') + 2000
    );
    for (const stale of [">11<", ">21<", ">10<", ">30<", ">47<"]) {
      expect(line).not.toContain(stale);
    }
  });
});

// ── Tab chips ─────────────────────────────────────────────────────────────

describe("SettingsHomePage -- tab chips", () => {
  it("an item with tabs renders one chip per declared tab", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    const company = SECTIONS.flatMap((s) => s.items).find((i) => i.to === "/settings/company")!;
    expect(company.tabs!.length).toBe(7);
    for (const tab of company.tabs!) {
      expect(html).toContain(`data-testid="settings-home-tab-company-${tab.id}"`);
    }
  });

  it("a card with tabs: [] renders NO chip row at all -- not an empty container", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    const account = SECTIONS.flatMap((s) => s.items).find((i) => i.to === "/settings/account")!;
    expect(account.tabs).toEqual([]);
    // The chip row's own testid is absent for this card.
    expect(html).toContain('data-testid="settings-home-tabs-company"');
    expect(html).not.toContain('data-testid="settings-home-tabs-account"');
  });

  it("every item declaring no tabs contributes no chip row", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    for (const item of SECTIONS.flatMap((s) => s.items)) {
      const id = `data-testid="settings-home-tabs-${slugFromTo(item.to)}"`;
      if ((item.tabs ?? []).length === 0) {
        expect(html, `${item.label} declares no tabs but rendered a chip row`).not.toContain(id);
      } else {
        expect(html, `${item.label} declares tabs but rendered no chip row`).toContain(id);
      }
    }
  });

  it("a chip on an open card deep-links to ?tab=<id>", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    expect(html).toContain('href="/settings/company?tab=commercial"');
  });
});

// ── Search: the matched tab's chip is highlighted ─────────────────────────

describe("SettingsHomePage -- a tab hit highlights that chip", () => {
  it("collapseSearchResults folds searchSettings output to one card per item", () => {
    // "Company" matches the Company item's label AND the AI settings tab
    // labelled "Company"; the raw result list has more entries than cards.
    const raw = searchSettings(SECTIONS, SUPER_USER, "Company");
    const cards = collapseSearchResults(raw);
    expect(raw.length).toBeGreaterThan(cards.length);
    const tos = cards.map((c) => c.item.to);
    expect(new Set(tos).size).toBe(tos.length);
  });

  it("searching GST resolves to Company with the Commercial defaults tab matched", () => {
    const cards = collapseSearchResults(searchSettings(SECTIONS, SUPER_USER, "GST"));
    expect(cards).toHaveLength(1);
    expect(cards[0].item.label).toBe("Company");
    expect(cards[0].matchedTabIds).toEqual(["commercial"]);
    // "GST" is nowhere in the card's own title or description.
    expect(cards[0].item.label.toLowerCase()).not.toContain("gst");
    expect(cards[0].item.description.toLowerCase()).not.toContain("gst");
  });

  it("the rendered GST search marks the Commercial defaults chip and no other", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch, initialQuery: "GST" });
    expect(html).toContain('data-testid="settings-home-tab-company-commercial"');
    const commercial = html.slice(html.indexOf('data-testid="settings-home-tab-company-commercial"'));
    expect(commercial.slice(0, 200)).toContain('data-tab-hit="true"');
    const branding = html.slice(html.indexOf('data-testid="settings-home-tab-company-branding"'));
    expect(branding.slice(0, 200)).not.toContain('data-tab-hit="true"');
  });

  it("a label hit is marked in the card title", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch, initialQuery: "Audit" });
    expect(html).toContain("<mark");
  });

  it("highlightSegments splits a string into matched and unmatched runs", () => {
    expect(highlightSegments("Commercial defaults", "commercial")).toEqual([
      { text: "Commercial", hit: true },
      { text: " defaults", hit: false }
    ]);
  });

  it("highlightSegments returns one unmatched run for an empty query", () => {
    expect(highlightSegments("Audit", "")).toEqual([{ text: "Audit", hit: false }]);
    expect(highlightSegments("Audit", "   ")).toEqual([{ text: "Audit", hit: false }]);
  });

  it("highlightSegments returns one unmatched run when nothing matches", () => {
    expect(highlightSegments("Audit", "zzz")).toEqual([{ text: "Audit", hit: false }]);
  });
});

// ── The route / needs-permission line ─────────────────────────────────────

describe("SettingsHomePage -- each card shows its route, or the permission it needs", () => {
  it("routeLineLabel gives the path for an open card", () => {
    const item: SettingsNavItem = {
      to: "/settings/account",
      label: "Account",
      description: "d",
      tabs: []
    };
    expect(routeLineLabel(item, false)).toBe("/settings/account");
  });

  it("routeLineLabel gives 'needs <permission>' for a locked card", () => {
    const item: SettingsNavItem = {
      to: "/settings/administration/users",
      label: "Users",
      requiresPermission: "users.view",
      description: "d",
      tabs: []
    };
    expect(routeLineLabel(item, true)).toBe("needs users.view");
  });

  it("routeLineLabel joins alternatives, and names super-user", () => {
    expect(
      routeLineLabel(
        { to: "/x", label: "X", requiresAnyPermission: ["a.b", "c.d"], description: "d", tabs: [] },
        true
      )
    ).toBe("needs a.b or c.d");
    expect(
      routeLineLabel({ to: "/y", label: "Y", superUserOnly: true, description: "d", tabs: [] }, true)
    ).toBe("needs super-user");
  });

  it("the super user's cards render routes, not permissions", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    expect(html).toContain('data-testid="settings-home-route-account"');
    expect(html).toContain("/settings/administration/xero-exchange");
    expect(html).not.toContain('data-testid="settings-home-needs-account"');
  });

  it("a permission-less user's locked cards render 'needs <permission>'", () => {
    const html = markup({ user: NO_PERMS_USER, authFetch: noopFetch });
    expect(html).toContain('data-testid="settings-home-needs-administration-users"');
    expect(html).toContain("needs users.view");
    expect(html).toContain("needs super-user");
    expect(html).toContain("Request access");
  });
});

// ── The All items / Grouped toggle ────────────────────────────────────────

describe("SettingsHomePage -- All items / Grouped toggle", () => {
  it("both halves of the toggle are rendered, with All items pressed by default", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    expect(html).toContain("All items");
    expect(html).toContain("Grouped");
    const allBtn = html.slice(html.indexOf('data-testid="settings-home-view-all"') - 200);
    expect(allBtn.slice(0, 400)).toContain('aria-pressed="true"');
    const grpBtn = html.slice(html.indexOf('data-testid="settings-home-view-grouped"') - 200);
    expect(grpBtn.slice(0, 400)).toContain('aria-pressed="false"');
  });

  it("All items renders no section headings; Grouped renders them", () => {
    const flat = markup({ user: SUPER_USER, authFetch: noopFetch });
    const grouped = markup({ user: SUPER_USER, authFetch: noopFetch, initialGrouped: true });
    for (const section of SECTIONS) {
      expect(grouped).toContain(`>${section.label}</h3>`);
    }
    expect(flat).not.toContain("</h3>");
  });

  it("SECTIONS has 4 sections: Personal, Company, Administration, Elsewhere", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual([
      "Personal",
      "Company",
      "Administration",
      "Elsewhere"
    ]);
  });

  it("in grouped view, only sections with open items are rendered", () => {
    const grouped = markup({ user: NO_PERMS_USER, authFetch: noopFetch, initialGrouped: true });
    expect(grouped).toContain(">Personal</h3>");
    expect(grouped).not.toContain(">Administration</h3>");
  });
});

// ── The two settings that live outside /settings ──────────────────────────

describe("SettingsHomePage -- the pages that live outside /settings", () => {
  it("both are cards, badged Elsewhere, linking to their existing routes", () => {
    const html = markup({ user: SUPER_USER, authFetch: noopFetch });
    expect(html).toContain('href="/admin/schedule-of-rates"');
    expect(html).toContain('href="/workers/job-roles"');
    expect(html).toContain("Elsewhere");
  });

  it("their slugs do not collide with the /settings ones", () => {
    expect(slugFromTo("/admin/schedule-of-rates")).toBe("admin-schedule-of-rates");
    expect(slugFromTo("/workers/job-roles")).toBe("workers-job-roles");
    expect(slugFromTo("/settings/administration/users")).toBe("administration-users");
  });

  it("a user holding only the guard permission sees each one open", () => {
    const ratesUser = fakeUser({ permissions: ["rates.manage"] });
    const sorHtml = markup({ user: ratesUser, authFetch: noopFetch });
    expect(sorHtml).toContain('data-testid="settings-home-open-admin-schedule-of-rates"');
    expect(sorHtml).toContain('data-testid="settings-home-locked-workers-job-roles"');

    const resourcesUser = fakeUser({ permissions: ["resources.view"] });
    const rolesHtml = markup({ user: resourcesUser, authFetch: noopFetch });
    expect(rolesHtml).toContain('data-testid="settings-home-open-workers-job-roles"');
    expect(rolesHtml).toContain('data-testid="settings-home-locked-admin-schedule-of-rates"');
  });
});

// ── Locked card content contract ──────────────────────────────────────────

describe("SettingsHomePage -- locked card renders lock icon, permission code, and Request access", () => {
  it("data-testid for locked card uses the slug", () => {
    expect(`settings-home-locked-${slugFromTo("/settings/administration/users")}`).toBe(
      "settings-home-locked-administration-users"
    );
  });

  it("data-testid for request-access button uses the slug", () => {
    expect(`settings-home-request-access-${slugFromTo("/settings/administration/roles")}`).toBe(
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

  it("a locked card carries a lock glyph and a Request access button", () => {
    const html = markup({ user: NO_PERMS_USER, authFetch: noopFetch });
    const card = html.slice(html.indexOf('data-testid="settings-home-locked-administration-users"'));
    expect(card.slice(0, 1600)).toContain("<svg");
    expect(card.slice(0, 1600)).toContain(
      'data-testid="settings-home-request-access-administration-users"'
    );
  });

  it("all locked items for an ordinary user have a non-empty permissionLabel", () => {
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { locked } = partitionSettingsNavItems(allItems, NO_PERMS_USER);
    for (const item of locked) {
      const label = permissionLabel(item);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe("unknown");
    }
  });
});

// ── Locked items land at the bottom, in both views ────────────────────────

describe("SettingsHomePage -- locked items render AFTER all open items", () => {
  it("the Needs access divider counts the locked cards on screen", () => {
    const html = markup({ user: NO_PERMS_USER, authFetch: noopFetch });
    const { needAccess } = computeSettingsCounts(SECTIONS, NO_PERMS_USER);
    expect(html).toContain(`Needs access — ${needAccess}`);
  });

  it("in flat view the first locked card comes after the last open card", () => {
    const html = markup({ user: NO_PERMS_USER, authFetch: noopFetch });
    const lastOpen = html.lastIndexOf('data-testid="settings-home-open-');
    const firstLocked = html.indexOf('data-testid="settings-home-locked-');
    expect(lastOpen).toBeGreaterThan(-1);
    expect(firstLocked).toBeGreaterThan(lastOpen);
  });

  it("in grouped view every locked card still sits below the section headings", () => {
    const html = markup({ user: NO_PERMS_USER, authFetch: noopFetch, initialGrouped: true });
    const lastHeading = html.lastIndexOf("</h3>");
    expect(html.indexOf('data-testid="settings-home-locked-')).toBeGreaterThan(lastHeading);
  });

  it("open and locked cards partition the nav exactly", () => {
    const allItems = SECTIONS.flatMap((s) => s.items);
    const { open, locked } = partitionSettingsNavItems(allItems, NO_PERMS_USER);
    const openTos = new Set(open.map((i) => i.to));
    const lockedTos = new Set(locked.map((i) => i.to));
    expect([...openTos].filter((to) => lockedTos.has(to))).toHaveLength(0);
    expect(open.length + locked.length).toBe(allItems.length);
  });
});

// ── Search with no openable match ─────────────────────────────────────────

describe("SettingsHomePage -- empty search result", () => {
  it("shows the approved empty notice when nothing the user can open matches", () => {
    const html = markup({
      user: NO_PERMS_USER,
      authFetch: noopFetch,
      initialQuery: "xyzzy-no-match-ever"
    });
    expect(html).toContain('data-testid="settings-home-search-empty"');
    expect(html).toContain("Nothing you can open matches");
  });

  it("keeps the locked section visible when only locked items match", () => {
    const html = markup({ user: NO_PERMS_USER, authFetch: noopFetch, initialQuery: "GST" });
    expect(html).toContain('data-testid="settings-home-search-empty"');
    expect(html).toContain('data-testid="settings-home-locked-company"');
  });
});
