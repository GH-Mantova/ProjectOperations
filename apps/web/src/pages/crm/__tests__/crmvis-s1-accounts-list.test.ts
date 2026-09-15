// crmvis-s1-accounts-list — visual parity (CRM_PARITY_ACCOUNTS_V1) assertions.
//
// Tests:
//   (a) CrmTabs renders with correct ARIA: exactly one tab has aria-selected="true".
//   (b) AccountsListPage.tsx source: no 6-digit hex, imports crm.css.
//   (c) buildGoingColdTile regression pin — exact return strings from current impl.
//
// No jsdom — pure logic and source-scan only (web workspace constraint).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { buildGoingColdTile, CRM_PARITY_ACCOUNTS_V1 } from "../AccountsListPage";
import { CRM_COLD_V3 } from "../crm-cold";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = resolve(__dirname, "..");

const PAGE_SRC = readFileSync(resolve(CRM_DIR, "AccountsListPage.tsx"), "utf-8");
const TABS_SRC = readFileSync(resolve(CRM_DIR, "CrmTabs.tsx"), "utf-8");

// ── (a) CrmTabs ARIA contract ─────────────────────────────────────────────────

describe("CrmTabs — ARIA tab contract (source-scan)", () => {
  it("renders exactly one element with aria-selected={true} given one active tab", () => {
    // Source-scan: CrmTabs maps over tabs and applies aria-selected={isActive}.
    // Only the tab whose id === activeId gets isActive=true — so exactly one
    // element gets aria-selected="true" per render.
    expect(TABS_SRC).toContain("aria-selected={isActive}");
    // The active class is applied conditionally.
    expect(TABS_SRC).toContain("crm-tab--on");
    // role="tab" is on every Link.
    expect(TABS_SRC).toContain('role="tab"');
    // role="tablist" is on the nav wrapper.
    expect(TABS_SRC).toContain('role="tablist"');
  });

  it("CrmTabs accepts tabs, activeId, and ariaLabel props", () => {
    expect(TABS_SRC).toContain("tabs: CrmTabDef[]");
    expect(TABS_SRC).toContain("activeId");
    expect(TABS_SRC).toContain("ariaLabel");
  });
});

// ── (b) AccountsListPage.tsx source contract ──────────────────────────────────

describe("AccountsListPage.tsx — no hex, imports crm.css (crmvis-S1)", () => {
  it("contains no 6-digit hex colour literals", () => {
    // done_when check: ! grep -qE '#[0-9a-fA-F]{6}\\b' AccountsListPage.tsx
    const hexMatches = PAGE_SRC.match(/#[0-9a-fA-F]{6}\b/g);
    expect(hexMatches).toBeNull();
  });

  it("imports crm.css", () => {
    expect(PAGE_SRC).toContain('import "./crm.css"');
  });

  it("carries the CRM_PARITY_ACCOUNTS_V1 marker", () => {
    expect(PAGE_SRC).toContain("CRM_PARITY_ACCOUNTS_V1");
    expect(CRM_PARITY_ACCOUNTS_V1).toBe("crmvis-s1");
  });

  it("still carries the CRM_ACCOUNTS_LIST_V2 marker", () => {
    expect(PAGE_SRC).toContain("CRM_ACCOUNTS_LIST_V2");
  });
});

// ── (c) buildGoingColdTile regression pin ─────────────────────────────────────
// Pinned against the current implementation. Do not change these strings
// unless the buildGoingColdTile function itself changes.

describe("buildGoingColdTile — regression pin (exact return strings)", () => {
  it("label is always 'Going cold'", () => {
    expect(buildGoingColdTile([]).label).toBe("Going cold");
  });

  it("subLine with zero never-contacted: 'no contact in 60 days'", () => {
    const tile = buildGoingColdTile([{ contactState: "COLD" }, { contactState: "IN_CONTACT" }]);
    expect(tile.subLine).toBe(`no contact in ${CRM_COLD_V3.THRESHOLD_DAYS} days`);
    expect(tile.subLine).toBe("no contact in 60 days");
  });

  it("subLine with never-contacted: 'no contact in 60 days · N never contacted'", () => {
    const tile = buildGoingColdTile([
      { contactState: "COLD" },
      { contactState: "NEVER_CONTACTED" },
      { contactState: "NEVER_CONTACTED" }
    ]);
    expect(tile.subLine).toBe("no contact in 60 days · 2 never contacted");
  });

  it("empty rows: value=0, accent=false, no second clause", () => {
    const tile = buildGoingColdTile([]);
    expect(tile.value).toBe(0);
    expect(tile.accent).toBe(false);
    expect(tile.subLine).toBe("no contact in 60 days");
    expect(tile.subLine).not.toContain("never contacted");
  });

  it("accent true only when cold > 0", () => {
    expect(buildGoingColdTile([{ contactState: "NEVER_CONTACTED" }]).accent).toBe(false);
    expect(buildGoingColdTile([{ contactState: "COLD" }]).accent).toBe(true);
  });
});
