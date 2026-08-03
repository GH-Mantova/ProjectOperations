# Assets consolidation — one tabbed page for Assets · Inventory · Maintenance · Procurement

**Status:** draft 2026-08-03 (Marco ask; every fact below re-verified against origin/main HEAD
on 2026-08-03 before this plan was written).
**Owner:** Marco / ProjectOperations desktop-shell.
**Rule:** every code slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green.

Marco's ask: the "Assets & Equipment" collapsible sidebar dropdown is not liked. He wants a
single top-level Assets page whose tabs are **Assets · Inventory · Maintenance · Procurement**.
Procurement (today a separate Operations item) folds into the same tabbed page — this is
IA consolidation, not removal.

Nothing here changes underlying behaviour of the four modules unless a slice says so
explicitly. No new features. No schema/migrations. This is a UI/nav restructure only.

---

## 1. Motivation and what this plan replaces

Evidence pinned to files/lines on origin/main 2026-08-03:

1. **"Assets & Equipment" is a collapsible dropdown parent that is not itself a route.**
   `apps/web/src/components/ShellLayout.tsx:242-254` — the parent's `to` is the sentinel
   string `"operations/assets-equipment"`; children (`/assets`, `/inventory`, `/maintenance`)
   are the real destinations. The comment at :242-245 explicitly says "The parent is a toggle
   button, not a route". Marco's issue: an extra click, an extra visual layer, and no page to
   land on when a user clicks the group label itself.
2. **Procurement is a first-class Operations sibling of that dropdown.**
   `apps/web/src/components/ShellLayout.tsx:255` — `{ to: "/procurement", label: "Procurement",
   requiresPermission: "procurement.view" }`. Related workflows (assets ↔ purchase orders ↔
   inventory movements ↔ maintenance parts) live behind two separate top-level nav items
   today. Folding Procurement in reunites them under one heading.
3. **Nav test asserts the current dropdown shape.**
   `apps/web/src/components/__tests__/ShellLayout.nav.test.ts:120-122` asserts the three
   children `("Assets", "/assets"), ("Inventory", "/inventory"), ("Maintenance", "/maintenance")`.
   Any restructure must update this assertion.
4. **sot/01 §9 codifies the current shape.**
   `sot/01-charter-and-architecture.md:360-361` — "Assets & Equipment → Assets | Inventory |
   Maintenance" and "Procurement → /procurement". Section 9 is marked "definitive — do not
   deviate", so the nav change must land via a dedicated sot/01 §9 doc-reconcile slice, not
   inline with a code slice (per the charter-vs-doc-reconcile split rule).
5. **Four page trees, four route roots today** (surfaces the plan must merge):
   - `apps/web/src/pages/assets/AssetsListPage.tsx` (186 LOC), `AssetDetailPage.tsx` (747 LOC).
   - `apps/web/src/pages/inventory/InventoryPage.tsx` (303 LOC).
   - `apps/web/src/pages/maintenance/MaintenancePage.tsx` (564 LOC) +
     `PlantUtilisationReportPage.tsx` mounted at `/maintenance/utilisation`.
   - `apps/web/src/pages/procurement/ProcurementPage.tsx` (306 LOC) +
     `ThreeWayMatchPage.tsx` (422 LOC; NOT currently routed — grepped App.tsx 2026-08-03,
     no route registered).
   Routes registered in `apps/web/src/App.tsx:309-315` (`/assets`, `/assets/:id`,
   `/inventory`, `/procurement`, `/maintenance`, `/maintenance/utilisation`).
6. **Permission codes already exist** — no new codes required.
   `apps/api/src/common/permissions/permission-registry.ts:39-44,95-98` defines
   `assets.view`/`assets.manage`, `inventory.view`/`inventory.manage`,
   `maintenance.view`/`maintenance.manage`, and
   `procurement.view`/`procurement.manage`/`procurement.approve`/`procurement.receive`.
   This plan reuses them 1:1 (mirror the API, not the label — same rule the Workers item
   at `ShellLayout.tsx:265` follows for `resources.view`).

**Already queued elsewhere — this plan does NOT re-plan these:**
Settings restructure (`docs/plans/settings-restructure-plan.md`), Site dissolution
(`docs/plans/site-dissolution-plan.md`), merge liberty+speed. The Assets consolidation is
independent of all three — nav slot is in the Operations group, not Settings, not Sites.

---

## 2. Target information architecture (final state)

**Sidebar Operations group** — the collapsible dropdown disappears; a single top-level entry
replaces it. Procurement is folded in as the fourth tab, so its standalone Operations entry
also disappears. Guard model per tab mirrors the underlying module's view permission (same
policy as today's dropdown children).

```
Operations
├─ Scheduler                            → /scheduler
├─ Live crew map                        → /workers/live-crew
└─ Assets                               → /assets            (gate: OR-of the four view perms)
     Tabs (rendered inside AssetsWorkspacePage):
       Assets        → /assets           (gate: assets.view)          [default]
       Inventory     → /assets/inventory (gate: inventory.view)
       Maintenance   → /assets/maintenance (gate: maintenance.view)
       Procurement   → /assets/procurement (gate: procurement.view)
```

**Route model — deep-linkable sub-routes (preferred).**
The single-route-with-tab-state alternative (`/assets?tab=inventory`) was rejected on the
same grounds the Settings restructure landed sub-routes: preserving bookmark/link semantics,
enabling per-tab e2e specs, and letting per-tab permission gates run at the router boundary
rather than inside the component. So:

- `/assets` — Assets tab (list). Also the group entry point (redirected to first
  accessible tab if the caller lacks `assets.view`; NoAccess if none accessible).
- `/assets/inventory` — Inventory tab.
- `/assets/maintenance` — Maintenance tab.
- `/assets/procurement` — Procurement tab.

**Detail pages keep deep-linkable routes outside the tabbed shell** (they render full-page,
not inside a tab strip):
- `/assets/:id` — `AssetDetailPage` (unchanged). Back nav returns to `/assets`.
- `/maintenance/utilisation` — `PlantUtilisationReportPage` moves to
  `/assets/maintenance/utilisation` so it lives under the tab it belongs to; a Navigate
  redirect preserves the old URL.
- Any Procurement sub-page a slice discovers (three-way match, etc.) gets the same
  treatment: `/assets/procurement/...`. `ThreeWayMatchPage.tsx` exists but is not routed
  today — SLICE 5 audits Procurement sub-routes before moving anything.

**Nav group-level gate (`OR-of the four view perms`)** is a real code change, not a slogan.
The current sidebar filter (`ShellLayout.tsx`) supports per-item `requiresPermission` (single
code) but not `requiresAnyPermission` (any-of). SLICE 1 adds `requiresAnyPermission?: string[]`
to `NavItem` and threads it through the existing `filterNavItems` path. Only after SLICE 1
does the group parent get an accurate gate — until then it stays gated on `assets.view` alone
(same gate as today's first child), which is stricter than target but not broken.

**Component shape:** new `apps/web/src/pages/assets/AssetsWorkspacePage.tsx` renders the tab
strip + `<Outlet />`. Each existing page (`AssetsListPage`, `InventoryPage`,
`MaintenancePage`, `ProcurementPage`) becomes a child route. Zero rewrites — a page is
either rendered under the workspace `<Outlet />` or (for detail pages) as its own route,
same component either way.

**Guard model unification (call out):** every tab route is gated on its own module's
view permission. Group-level parent uses the new any-of gate. No `AdminOnly` involved
(there was none to begin with in Operations).

---

## 3. Slice list (ordered, independently shippable)

Each slice ≤ ~10 files. Dependency edges expressed as `requires_merged`. All slices are
docs-and-code (never mixed with `/sot/` edits). One dedicated sot/01 §9 doc-reconcile slice
sits at the end.

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/assets-equipment-tabs-plan.md`.
- **Gate/CI:** `pnpm lint`.
- **Requires:** nothing.
- **Notes:** binds every slice below.

### SLICE 1 — add `requiresAnyPermission` to NavItem + filter path `size:4`
- **Files:** `apps/web/src/components/ShellLayout.tsx` (extend the `NavItem` type; teach
  `filterNavItems`/the visibility path to honour it; leaves existing `requiresPermission`
  unchanged); `apps/web/src/components/__tests__/ShellLayout.nav.test.ts` (unit assertions
  for any-of behaviour, both allow and deny).
- **Non-goal:** no callers switched in this slice — nav shape unchanged, only capability
  added. Callers land in SLICE 3.
- **Requires:** SLICE 0.
- **Blocks:** SLICE 3 (needs the any-of gate to gate the workspace group).

### SLICE 2 — create `AssetsWorkspacePage` + tabbed shell (no children yet) `size:5`
- **Files:** new `apps/web/src/pages/assets/AssetsWorkspacePage.tsx` (tab strip + `<Outlet />`,
  pattern-matched off `apps/web/src/components/SettingsShell.tsx` and `MasterDataWorkspacePage`
  if the latter exists — SLICE author picks the closer prior art and cites it in the PR body);
  new `apps/web/src/pages/assets/__tests__/AssetsWorkspacePage.test.tsx` (renders each tab
  label, hides tabs the caller lacks permission for, redirects when landing tab is gated);
  no route wiring yet (App.tsx unchanged).
- **Non-goal:** don't touch nav; don't move the existing pages. Just ship a shell no route
  uses.
- **Requires:** SLICE 0.

### SLICE 3 — wire Assets, Inventory, Maintenance under `/assets` tabs; keep Procurement standalone `size:6`
- **Files:** `apps/web/src/App.tsx` — `/assets` becomes an outlet route rendering
  `AssetsWorkspacePage`; children `index → AssetsListPage`, `"inventory" → InventoryPage`,
  `"maintenance" → MaintenanceDashboardPage`. `/assets/:id → AssetDetailPage` stays outside
  the outlet (full-page). Add `Navigate replace` redirects: `/inventory → /assets/inventory`,
  `/maintenance → /assets/maintenance`, `/maintenance/utilisation → /assets/maintenance/utilisation`.
  `apps/web/src/components/ShellLayout.tsx` — collapse the "Assets & Equipment" group into a
  single item `{ to: "/assets", label: "Assets", icon: ICON_ASSETS, requiresAnyPermission:
  ["assets.view","inventory.view","maintenance.view"] }`. Update
  `apps/web/src/components/__tests__/ShellLayout.nav.test.ts` (no longer three children;
  one item with any-of gate). Add or extend an e2e spec asserting `/assets` tab navigation
  works and old URLs redirect.
- **Non-goal:** Procurement stays at its old sidebar slot and `/procurement` URL until
  SLICE 5 confirms sub-route inventory.
- **Requires:** SLICES 1, 2.

### SLICE 4 — retarget in-app links to the new URLs (grep sweep) `size:5`
- **Files:** any component that hard-codes `/inventory`, `/maintenance`, or
  `/maintenance/utilisation` (e.g. QuickCreate, CommandPalette, search.service, dashboard
  cards). SLICE author greps for those literals and retargets to the `/assets/*` equivalents.
  The old-URL redirects from SLICE 3 keep everything working before this slice lands — this
  slice is the tidy-up, not a correctness prerequisite for SLICE 3.
- **Requires:** SLICE 3.

### SLICE 5 — Procurement sub-route audit report `size:2`
- **Files:** new `docs/audits/procurement-subroutes-audit.md` (docs-only report).
- **Purpose:** enumerate every Procurement URL surface actually reachable today
  (`/procurement`, any nested route registered in App.tsx, any component navigating to
  Procurement sub-paths). `ThreeWayMatchPage.tsx` exists in the tree at
  `apps/web/src/pages/procurement/ThreeWayMatchPage.tsx` but grepped App.tsx 2026-08-03 shows
  no route registered — the audit says whether that page is dead code, an unreachable draft,
  or a route the SLICE author needs to add before the move.
- **Requires:** SLICE 0 (informational; can run in parallel with 1-4, but must finish
  before SLICE 6 opens).
- **Blocks:** SLICE 6.

### SLICE 6 — fold Procurement into the Assets tabs `size:6`
- **Files:** `apps/web/src/App.tsx` — add `"procurement" → ProcurementPage` as a fourth
  child route under `/assets`; add `Navigate replace` from `/procurement → /assets/procurement`
  (and from any sub-route the SLICE 5 audit surfaced); remove the standalone `/procurement`
  route (or leave as the redirect only). `apps/web/src/components/ShellLayout.tsx` — remove
  the standalone Procurement Operations item; broaden the Assets item's `requiresAnyPermission`
  to include `procurement.view`. `AssetsWorkspacePage.tsx` — add the Procurement tab
  (gated on `procurement.view`). Update `ShellLayout.nav.test.ts` (no more Procurement item).
  Update the e2e spec added in SLICE 3 to cover the fourth tab and the `/procurement`
  redirect. If SLICE 5 flagged `ThreeWayMatchPage` (or others) as reachable, register the
  corresponding `/assets/procurement/...` route(s) here.
- **Requires:** SLICES 3, 5.

### SLICE 7 — in-app link sweep for `/procurement` `size:4`
- **Files:** grep for `"/procurement"` literals across `apps/web/src` and retarget to
  `/assets/procurement`. Same shape as SLICE 4 for the first three modules.
- **Requires:** SLICE 6.

### SLICE 8 — icon and label polish `size:2`
- **Files:** `apps/web/src/components/ShellLayout.tsx` (final icon choice for the single
  "Assets" nav item — `ICON_ASSETS` is used by three of the four modules today; SLICE
  author confirms with Marco or ships as-is); tab labels in `AssetsWorkspacePage.tsx`
  (Marco confirms "Assets · Inventory · Maintenance · Procurement" is final or edits).
- **Non-goal:** no functional change.
- **Requires:** SLICE 6.

### SLICE 9 — sot/01 §9 nav-IA doc-reconcile `size:1`
- **Files:** `sot/01-charter-and-architecture.md` §9 (lines 357-362) — collapse
  "Assets & Equipment → Assets | Inventory | Maintenance" and the separate "Procurement"
  row into "Assets → Assets | Inventory | Maintenance | Procurement (tabs at /assets/*)".
- **Docs-only PR, never mixed with code (CP-24 sot-purity gate blocks the mix).**
- **Requires:** every code slice merged (1-8).

---

## 4. Redirect map (old URL → new home)

Every URL currently registered in `App.tsx` for the four modules gets an explicit
disposition. Preferred: `Navigate replace` to preserve bookmarks. No 404s planned — every
old URL has a live destination.

| Old URL                       | Disposition | New URL                                | Slice |
|-------------------------------|-------------|----------------------------------------|-------|
| `/assets`                     | keep        | `/assets` (Assets tab, tab index)      | 3     |
| `/assets/:id`                 | keep        | `/assets/:id` (detail page, full-page) | 3     |
| `/inventory`                  | redirect    | `/assets/inventory`                    | 3     |
| `/maintenance`                | redirect    | `/assets/maintenance`                  | 3     |
| `/maintenance/utilisation`    | redirect    | `/assets/maintenance/utilisation`      | 3     |
| `/procurement`                | redirect    | `/assets/procurement`                  | 6     |
| (any procurement sub-route SLICE 5 finds) | redirect | `/assets/procurement/...`      | 6     |

Rule (same as settings restructure): every legacy redirect stays for at least one release
cycle after the last slice lands. Removing them is a separate housekeeping slice (not
planned here).

---

## 5. Risks

### 5.1 e2e specs that assert current nav labels or paths
Grepped `tests/e2e/**` 2026-08-03 for `/assets|/inventory|/maintenance|/procurement`:
zero matches (`batch6-scheduler.spec.ts` matches "Assets" as a Scheduler resource-kind
label, unrelated to nav). No existing e2e spec asserts the old dropdown shape. **Adding**
a spec is a SLICE 3 responsibility; there is nothing to update.

`apps/web/src/components/__tests__/ShellLayout.nav.test.ts:120-122` DOES assert the current
dropdown children — SLICE 3 must update it. This unit test runs in CI via `pnpm test:web`
(post-SETTINGS-restructure-SLICE 2 wiring landed on origin/main; verify before shipping
SLICE 3 that vitest is actually running in CI).

### 5.2 Losing the "Procurement" sidebar affordance
Marco has explicitly asked for Procurement folded into Assets, so this is intended IA.
Risk lands on user discoverability — anyone bookmarking `/procurement` is fine (redirect);
anyone scanning the sidebar for "Procurement" no longer sees a top-level label. Mitigations:
(a) tab strip labels the Procurement tab clearly; (b) redirect from `/procurement` means
external links and email templates still work; (c) call this out in the SLICE 6 PR body so
Marco can veto if he changes his mind.

### 5.3 Any-of permission gate is a new code path
SLICE 1 introduces `requiresAnyPermission` to the nav-item filter. Bug in the OR reduction
would either hide the Assets item from users who should see it (usability regression), or
show it to users who lack every underlying permission (they'd land on NoAccess). Mitigation:
unit tests in SLICE 1 cover both allow and deny paths explicitly.

### 5.4 Detail-page back-nav to a tab
`AssetDetailPage.tsx` back nav currently returns to `/assets`. When `/assets` becomes a
tab index, that still lands on the Assets tab — no regression. Maintenance sub-page
`PlantUtilisationReportPage` moves; its own back-nav must retarget to
`/assets/maintenance` (SLICE 3 responsibility). Slice PR must eyeball each detail page's
back-nav literal.

### 5.5 sot/01 §9 drift window
Between SLICE 3 merging and SLICE 9 landing, the code and sot/01 §9 disagree on nav shape.
This is the standard doc-reconcile split (per sot/README.md); the gap closes when SLICE 9
merges. Reviewers should not treat the temporary gap as a blocker for SLICES 3-8.

### 5.6 Merge order pins on SLICE 3
Every restructure slice depends on SLICE 3 (route change from three routes to a tabbed
workspace). If SLICE 3 revert is ever needed, revert order is reverse-of-merge; the plan
intentionally keeps SLICE 3 confined to the wiring so revert is cheap and doesn't undo the
`AssetsWorkspacePage` component or the nav-filter change.

---

## 6. Out of scope

- Any behaviour change to the underlying modules (asset register logic, inventory movements,
  maintenance events, procurement approval workflow). This plan relocates and folds nav; it
  does not rewrite.
- Schema/migrations. This is UI/nav only.
- Cross-module data joins (e.g. surfacing procurement lines on an asset detail, or inventory
  reservations on a maintenance event). Those are legitimate future features but not part of
  the IA consolidation.
- Re-skin of any of the four pages onto s7 tokens. Existing off-schema styling is inherited
  as-is (re-skins land in their own PRs per "never move AND re-skin in one PR" rule).
- FIELD-side navigation (Marco: "FIELD nav is untouched", same posture as the settings
  restructure plan).
- Cleanup of legacy redirect routes (post-release housekeeping, not in this plan).
- Any change to the Scheduler or Live crew map Operations items (they stay put).

---

## 7. Verification of this document

- [x] `test -f docs/plans/assets-equipment-tabs-plan.md`
- [x] Every route in the current App.tsx for the four modules has an explicit disposition
      in §4 (keep / move / redirect).
- [x] Every audit finding in §1 is pinned to a file:line seen on origin/main 2026-08-03.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
