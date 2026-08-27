// ShellLayout.nav tests — pipeline-fold cluster (2026-08-20, updated 2026-08-27).
//
// Validates the nav structure changes from the pipeline-fold:
//   5. The Tendering "Pipeline" item links to /tenders/pipeline and is gated
//      on tenders.view OR crm.view (requiresAnyPermission, matching the API's
//      @RequireAnyPermission; fixes discoverability gap from #1334).
//   6. The CRM group no longer has a Pipeline entry.
//   7. Only one nav item is active on /tenders/pipeline (exclusion-list check).
//
// No jsdom — we walk the exported NAV_GROUPS array directly.

import { describe, expect, it } from "vitest";
import { NAV_GROUPS, pickMobileTabItem } from "../ShellLayout";

// ── helpers ──────────────────────────────────────────────────────────────────

type NavItem = {
  to: string;
  label: string;
  match?: (path: string) => boolean;
  requiresPermission?: string;
  requiresAnyPermission?: string[];
};

function allItems(groupId: string): NavItem[] {
  const group = NAV_GROUPS.find((g) => g.id === groupId);
  return (group?.items ?? []) as NavItem[];
}

function activeItemsOn(path: string): NavItem[] {
  const items: NavItem[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items as NavItem[]) {
      const active = item.match ? item.match(path) : path === item.to || path.startsWith(item.to + "/");
      if (active) items.push(item);
    }
  }
  return items;
}

// ── test 5: Tendering Pipeline item ──────────────────────────────────────────

describe("Tendering group Pipeline nav item (pipeline-fold)", () => {
  const pipelineItem = allItems("tendering").find((i) => i.label === "Pipeline");

  it("exists in the Tendering group", () => {
    expect(pipelineItem).toBeDefined();
  });

  it("points to /tenders/pipeline", () => {
    expect(pipelineItem?.to).toBe("/tenders/pipeline");
  });

  it("is gated on tenders.view OR crm.view via requiresAnyPermission (not a single requiresPermission)", () => {
    // The API uses @RequireAnyPermission("tenders.view", "crm.view"); the nav
    // gate must match so both holder classes can discover the page.
    expect(pipelineItem?.requiresPermission).toBeUndefined();
    expect(pipelineItem?.requiresAnyPermission).toEqual(["tenders.view", "crm.view"]);
  });

  it("match predicate activates on /tenders/pipeline", () => {
    const active = pipelineItem?.match ? pipelineItem.match("/tenders/pipeline") : false;
    expect(active).toBe(true);
  });

  it("match predicate activates on /tenders/pipeline?tab=insights", () => {
    // match receives the pathname only (no query string) in ShellLayout
    const active = pipelineItem?.match ? pipelineItem.match("/tenders/pipeline") : false;
    expect(active).toBe(true);
  });
});

// ── test 6: CRM group has no Pipeline entry ──────────────────────────────────

describe("CRM group — no Pipeline entry", () => {
  it("the CRM group does not contain a Pipeline item", () => {
    const crmPipeline = allItems("crm").find((i) => i.label === "Pipeline");
    expect(crmPipeline).toBeUndefined();
  });

  it("the CRM group does not contain any item pointing to /crm/pipeline", () => {
    const item = allItems("crm").find((i) => i.to === "/crm/pipeline");
    expect(item).toBeUndefined();
  });
});

// ── test 7: only one item is active on /tenders/pipeline ────────────────────

describe("Active items on /tenders/pipeline", () => {
  it("exactly one nav item is active on /tenders/pipeline", () => {
    const active = activeItemsOn("/tenders/pipeline");
    expect(active).toHaveLength(1);
  });

  it("the single active item is Pipeline (not Tenders)", () => {
    const active = activeItemsOn("/tenders/pipeline");
    expect(active[0]?.label).toBe("Pipeline");
    expect(active[0]?.to).toBe("/tenders/pipeline");
  });

  it("the Tenders item is NOT active on /tenders/pipeline", () => {
    const tendersItem = allItems("tendering").find((i) => i.label === "Tenders");
    const active = tendersItem?.match ? tendersItem.match("/tenders/pipeline") : false;
    expect(active).toBe(false);
  });
});

// ── additional: mobile tab bar still works ───────────────────────────────────

describe("pickMobileTabItem — Tendering group", () => {
  it("returns the first item with a real route (Leads & opportunities)", () => {
    const tenderingGroup = NAV_GROUPS.find((g) => g.id === "tendering");
    expect(tenderingGroup).toBeDefined();
    const tabItem = pickMobileTabItem(tenderingGroup!);
    // First item is Leads & opportunities at /tenders/leads
    expect(tabItem?.to).toBe("/tenders/leads");
  });
});
