# Settings Home + search — binding slice plan

**Status:** awaiting Marco approval (plan-only PR; code slices do not open until this is merged).
**Owner:** Marco / ProjectOperations desktop-shell.
**Rule:** every code slice chains behind this document via `requires_merged`. Slices ship
independently, each <= ~7 files, each CI-green.

Nothing in the code slices changes underlying settings behaviour or existing page internals
unless a slice says so explicitly. No schema or migrations anywhere in this plan.

---

## 1. Motivation and what this plan replaces

There is currently **no Settings landing page**. The `/settings` index route (App.tsx:395-396)
redirects immediately to `account`:

```
<Route path="/settings" element={<SettingsShell />}>
  <Route index element={<Navigate to="account" replace />} />   // App.tsx:396
```

A user landing on `/settings` (e.g. from a "Go to Settings" link in a notification) is dumped
into the Account page with no overview of what else Settings contains. For an ordinary staff
member who has access to exactly 3 of the 20 settings pages, there is no affordance that shows
them which 3 those are.

Two further gaps block the planned Home and search surfaces:

1. **No `description` on any nav item.** `SettingsShell.tsx` carries zero occurrences of
   `description` on `SettingsNavItem`. Without descriptions, a search surface returns labels
   only — too sparse to be useful, and misses D44.

2. **No central tab declaration.** Tabs live inside individual pages. There are roughly 26 tabs
   across the 20 top-level pages (Company profile: 7, Admin settings: 6, Reference data and
   Lists: 5, and others). Without tab entries the search surface misrepresents Settings as
   20 destinations when it is really approximately 47.

This plan fills the hole. It does not replace any existing page or component.

---

## 2. Approved decisions

| # | Decision |
|---|---|
| D43 | Settings Home is **flat by default, with a Grouped toggle**. |
| D44 | Search covers **name + description + tab name**, and deep-links to the tab. |
| D45 | Permission-locked settings are **shown, not hidden** — greyed, with a lock icon, the permission code they need, and a working **Request access** button. |
| D46 | Locked settings are grouped at the **BOTTOM** under a `Needs access — N` divider, in **BOTH** flat and grouped views. Header count reads "N settings you can open". |
| D47 | Descriptions are drafted from the code for Marco's single review pass, with guesses flagged via `// GUESS —` comments. |

These decisions are final. The code slices must implement them, not re-open them.

---

## 3. Verified grounding (files and line numbers, re-verified 2026-08-18)

### 3.1 No Settings landing page

`apps/web/src/App.tsx:395` — `<Route path="/settings" element={<SettingsShell />}>`.
`apps/web/src/App.tsx:396` — `<Route index element={<Navigate to="account" replace />} />`.
This plan replaces the Navigate redirect with `SettingsHomePage`. It fills a hole; it
replaces nothing of substance.

### 3.2 Precedent landing page to mirror

`apps/web/src/pages/administration/AdministrationLandingPage.tsx` (62 lines).

- Imports `ADMINISTRATION_ITEMS` and `filterSettingsNavItems` from `SettingsShell`.
- Calls `filterSettingsNavItems(ADMINISTRATION_ITEMS, user)` to get visible items.
- Falls back to `<NoAccess>` when no items are visible.
- Renders a grid of `<Link>` cards using `var(--border)`, `var(--surface)`,
  `var(--text-primary)` tokens.

`SettingsHomePage` **must mirror this structure and its design tokens**. A second card-grid
pattern must not be invented.

### 3.3 The declarative nav model

`apps/web/src/components/SettingsShell.tsx`:

- `SettingsNavItem` type: `{ to, label, requiresPermission?, requiresAnyPermission?, superUserOnly? }` (lines 15-30).
- Three `SECTIONS` (Personal / Company / Administration), const at line 86.
- `ADMINISTRATION_ITEMS` exported at line 41 (10 items).
- `filterSettingsNavItems(items, user)` exported at line 74 — **HIDES locked items**.

`SettingsHomePage` and search **must be generated from `SECTIONS` and `ADMINISTRATION_ITEMS`**.
A second hand-maintained list of settings pages is forbidden; it will drift.

### 3.4 Verified item inventory (counted directly from SettingsShell.tsx, 2026-08-18)

**Personal** (3 items, 0 locked):
| Label | Route | Gate |
|---|---|---|
| Account | `/settings/account` | none |
| Notification preferences | `/settings/notifications` | none |
| Calendar sync | `/settings/calendar-sync` | none |

**Company** (7 items, 7 locked):
| Label | Route | Gate |
|---|---|---|
| Company | `/settings/company` | `requiresPermission: "platform.admin"` |
| AI settings | `/settings/ai` | `requiresPermission: "platform.admin"` |
| Reference data & Lists | `/settings/reference-data` | `requiresAnyPermission: ["rates.manage","lists.manage"]` |
| Handover template | `/settings/handover-template` | `requiresPermission: "handovertemplate.manage"` |
| Data model | `/settings/data-model` | `superUserOnly: true` |
| Field definitions | `/settings/field-definitions` | `superUserOnly: true` |
| Companies | `/settings/companies` | `superUserOnly: true` |

**Administration** (10 items, all 10 locked):
| Label | Route | Gate |
|---|---|---|
| Admin settings | `/settings/administration/system` | `requiresPermission: "system.manage"` |
| Users | `/settings/administration/users` | `requiresPermission: "users.view"` |
| Roles & Permissions | `/settings/administration/roles` | `requiresPermission: "roles.view"` |
| Audit | `/settings/administration/audit` | `requiresPermission: "audit.view"` |
| Platform | `/settings/administration/platform` | `requiresPermission: "sharepoint.view"` |
| Automations | `/settings/administration/automations` | `requiresPermission: "automations.view"` |
| Client versions | `/settings/administration/client-versions` | `requiresPermission: "system.manage"` |
| Map locations | `/settings/administration/map-locations` | `requiresPermission: "system.manage"` |
| Xero file exchange | `/settings/administration/xero-exchange` | `requiresPermission: "platform.admin"` |
| CRM drop reasons | `/settings/administration/crm-drop-reasons` | `requiresPermission: "crm.manage"` |

**Total: 20 top-level pages, 17 locked.** (The original brief and the prompt file both cited
21 — that was stale. The count above was verified directly from `SettingsShell.tsx` on
2026-08-18. Do not back-patch to 21.)

For a typical ordinary staff member (no special permissions, not super-user): **17 of 20 cards
are locked**. Only Account, Notification preferences, and Calendar sync are open. SLICE 2 must
call this out prominently — it is deliberate under D45/D46, but it should not arrive
unannounced.

### 3.5 What the model does NOT carry today — both are required

- **`description`**: zero occurrences in `SettingsShell.tsx` (grepped 2026-08-18).
- **`tabs`**: not declared anywhere centrally. Tabs live inside individual page components.
  Roughly 26 tabs are spread across the 20 pages. SLICE 1 adds both fields to
  `SettingsNavItem` and populates every entry.

### 3.6 Why a new partition function is mandatory

`filterSettingsNavItems` (SettingsShell.tsx:74-84) **removes** locked items from the returned
array. `AdministrationLandingPage` (line 12) depends on that behaviour — a user with no
administration permissions sees the NoAccess fallback, not a grid of locked cards.

D45/D46 require the **opposite** for Settings Home: show locked items greyed, at the bottom.

SLICE 1 must therefore add `partitionSettingsNavItems(items, user) → { open, locked }` and
**leave `filterSettingsNavItems` completely untouched**. Any caller that currently uses
`filterSettingsNavItems` (including `AdministrationLandingPage`) must not be affected.

### 3.7 Request access endpoint

`apps/api/src/modules/access-requests/access-requests.controller.ts:19` — `@Post("request-access")`.
Admin approve/deny endpoints are alongside it. D45's Request access button has a real
endpoint; no new API work is needed.

### 3.8 No collision with queued work

No `settings-home-*` or `settings-search-*` prompt exists in `docs/pr-prompts/` (root) beyond
the arming prompt `pr-settings-home-slice0-ready.md` that triggered this plan.
No such file exists in HOLD or superseded either (checked 2026-08-18).

### 3.9 Adjacent BACKLOG item ordering

`settings-restructure-sot-nav-reconcile` (SLICE 20 of `docs/plans/settings-restructure-plan.md`,
`sot/01` §9 nav-IA doc-reconcile) is gate-passed and READY. Settings Home changes the nav IA
(`/settings` gets a real landing page; the item model gains `description` and `tabs`). The
reconcile slice **must run AFTER** these three settings-home slices merge, not before.

---

## 4. Slice breakdown

Each slice is independently shippable. Each declares `requires_merged` on the previous slice.
The watcher opens them one at a time — it will not open SLICE 2 until SLICE 1 has merged.

### SLICE 1 — extend the nav model (data and pure functions, no UI)

**requires_merged:** `docs/plans/settings-home-plan.md` (this document, once merged).

**Scope:**

1. Add `description: string` and `tabs?: { id: string; label: string; description: string }[]`
   to `SettingsNavItem` in `apps/web/src/components/SettingsShell.tsx`.

2. Populate `description` and `tabs` for **every one of the 20 top-level pages** and all
   approximately 26 tabs. Where the author is inferring intent from the code rather than
   from a written spec, mark it with a `// GUESS —` comment in the TS source (D47). Marco
   performs a single review pass in the PR and approves or corrects guesses. No description
   may be left as an empty string or a placeholder — the coverage test (see below) will fail.

3. Add `partitionSettingsNavItems(items, user): { open: SettingsNavItem[]; locked: SettingsNavItem[] }`.
   - `open` = items the user can access (mirrors the logic inside `filterSettingsNavItems`).
   - `locked` = items the user cannot access.
   - Do **not** change `filterSettingsNavItems`. Do not change `AdministrationLandingPage`.
   - Export the new function from `SettingsShell.tsx` alongside the existing exports.

4. **Unit tests** for `partitionSettingsNavItems`:
   - Super-user sees no locked items.
   - User with no permissions sees 17 locked, 3 open.
   - User with `users.view` sees the Users item in `open`.
   - Items with `requiresAnyPermission` land in `open` when the user holds any of the codes.

5. **Coverage test** — this is non-negotiable. A test that asserts:
   - Every item in every section has a non-empty `description`.
   - Every item in every section has a `tabs` array (may be empty only if the page genuinely
     has no tabs — the test must enumerate the expected-empty set explicitly, not allow blanket
     empty arrays).
   This test fails the moment a future contributor adds a new settings page without a
   description or tab list, which is the exact rot the coverage test prevents.

**No component is touched in SLICE 1.** The `SECTIONS` array and `ADMINISTRATION_ITEMS`
array gain new fields; no import changes are needed in existing components because the new
fields are additive and optional in the type (except `description`, which is required — the
TypeScript compiler will flag any object literal missing it).

**File count estimate: <= 5** (SettingsShell.tsx + 2 test files + possibly an extracted
`settings-nav-items.ts` if the populated array becomes too large for the shell file +
one test helper if needed).

---

### SLICE 2 — `SettingsHomePage`

**requires_merged:** SLICE 1.

**Scope:**

1. Create `apps/web/src/pages/settings/SettingsHomePage.tsx`.
   - Uses `SECTIONS` and `partitionSettingsNavItems` (from SLICE 1) to build the full card set.
   - Flat view by default; Grouped toggle switches between flat and grouped (D43).
     - Flat: all open cards in alphabetical or declaration order, followed by the locked divider.
     - Grouped: cards grouped under "Personal", "Company", "Administration" section headings,
       locked cards still moved to the bottom of the full list under `Needs access — N` (D46).
   - Header reads: **"N settings you can open"** where N = `open.length` (D46).
   - Locked partition rendered below a `Needs access — N` divider in both views (D46).
   - Locked cards: greyed, lock icon, permission code label, and a **Request access** button
     wired to `POST /request-access` (access-requests.controller.ts:19) (D45).
   - Mirror `AdministrationLandingPage`'s card grid structure and design tokens (`var(--border)`,
     `var(--surface)`, `var(--text-primary)`, `var(--text-muted)`, `s7-type-page-heading`).
     Do not invent a new card pattern.

2. In `apps/web/src/App.tsx:396`, replace:
   ```
   <Route index element={<Navigate to="account" replace />} />
   ```
   with:
   ```
   <Route index element={<SettingsHomePage />} />
   ```

3. **Visible-change call-out (required in the SLICE 2 PR body):** For a typical ordinary staff
   member, 17 of the 20 settings cards will appear greyed with lock icons. This is deliberate
   under D45 and D46. The PR body must say so explicitly so Marco and reviewers are not
   surprised. The change does not affect what users can actually navigate to — it only changes
   the landing page they see at `/settings`.

4. Tests:
   - Renders the correct header count for a mocked user with 3 open items.
   - Locked cards render the lock icon and Request access button.
   - Grouped toggle changes the layout.
   - Flat view renders locked items at the bottom regardless of their section.

**File count estimate: <= 7** (SettingsHomePage.tsx + App.tsx + 2-3 test files +
possibly a `LockedSettingCard.tsx` sub-component if the locked-card markup is non-trivial).

---

### SLICE 3 — search

**requires_merged:** SLICE 2.

**Scope:**

1. Add a search input to `SettingsHomePage` (or as a standalone component it imports).
   - Search covers `item.label`, `item.description`, and each `tab.label` + `tab.description`
     for every item in the full set (open and locked), across all three sections (D44).
   - Results show both open and locked items. Locked results still show greyed with the lock
     and Request access button (D45/D46 apply inside search too).
   - When the query is empty, the full Home view renders (no search results shown).

2. **Tab deep-linking.** A tab hit links to the parent route with the tab pre-selected.
   Mechanism: query parameter `?tab=<id>`. This is chosen over a URL hash because:
   - React Router's `useSearchParams` cleanly reads and forwards query parameters.
   - Tab ids are stable strings already present in the `tabs[].id` field defined in SLICE 1.
   - Hashes would require the target page to read `window.location.hash` and activate the
     tab on mount — more coupling, harder to test.
   Each tab-result card links to `<parentRoute>?tab=<tab.id>`. The target page is responsible
   for reading `?tab` and activating the correct tab on mount. **SLICE 3 does not modify any
   tab-bearing page** — it links correctly. Wiring the individual pages to respond to `?tab`
   is deferred to per-page follow-up work (or the page author's next slice).

3. The search input respects the current flat/grouped toggle: results display in the same
   layout the user had before typing (flat or grouped), with the locked partition maintained.

4. Tests:
   - Typing a label surfaces the matching card.
   - Typing a tab name surfaces the parent page card with a deep-link href containing `?tab=`.
   - Typing a description fragment surfaces the matching card.
   - Locked items appear in search results greyed with Request access.
   - Empty query shows the full home view.

**File count estimate: <= 5** (search logic + updated SettingsHomePage.tsx + test files).

---

## 5. What this plan must NOT do

These are hard constraints. Any code slice that violates one must be rejected.

- **No component, route, or nav-model code in this SLICE 0 (plan) PR.** Plan only.
- **Do not change menu positions or Settings sub-nav ordering.** D40: themes and restructures
  never move menu positions without a decision that says so. The `SECTIONS` order is unchanged.
- **Do not touch `filterSettingsNavItems` or `AdministrationLandingPage`.** Either change
  silently breaks the Administration landing page for ordinary users.
- **Do not edit anything under `/sot/`.** The nav-IA reconcile (`settings-restructure-sot-nav-reconcile`,
  SLICE 20 of settings-restructure-plan.md) is a separate docs-only PR that runs AFTER these
  three slices merge. CP-24 hard-fails any PR that mixes code with `sot/` edits.
- **Do not draft the 20 page + 26 tab descriptions in this SLICE 0.** Descriptions are SLICE 1's
  payload, written from the code, flagged with `// GUESS —`, and reviewed by Marco in the SLICE 1
  PR. This plan file does not enumerate them.
- **No new API endpoints.** The Request access backend exists at
  `access-requests.controller.ts:19`. SLICE 2 wires to it as-is.
- **No schema or migrations in any slice of this plan.**

---

## 6. Ordering relative to adjacent plans

- **Settings restructure SLICE 20** (`settings-restructure-sot-nav-reconcile`) is READY in
  BACKLOG but must wait. It reconciles `sot/01` §9 nav-IA with the current tree. Settings Home
  changes that nav IA (adds a real `/settings` landing, adds `description`/`tabs` to the model).
  The reconcile must run **after** all three settings-home slices have merged.
- **Settings restructure slices 1-17** are independent and may proceed in parallel; they touch
  the nav model in additive ways that do not conflict with adding `description` and `tabs`.

---

## 7. Verification / done-when

For this SLICE 0 (plan) PR:

- `test -f docs/plans/settings-home-plan.md`
- `grep -q "SLICE 1" docs/plans/settings-home-plan.md`
- `grep -q "SLICE 2" docs/plans/settings-home-plan.md`
- `grep -q "SLICE 3" docs/plans/settings-home-plan.md`
- `pnpm lint` passes (docs-only, trivially green).

For SLICE 1:
- TypeScript compiles cleanly with `description: string` required on `SettingsNavItem`.
- All 20 items have non-empty `description` and a `tabs` array.
- Unit tests for `partitionSettingsNavItems` pass.
- Coverage test fails if any item is added without a description.
- `filterSettingsNavItems` is byte-for-byte unchanged from its pre-SLICE-1 state.

For SLICE 2:
- `/settings` renders `SettingsHomePage` (not the Account redirect).
- Header count matches the user's accessible item count.
- Locked cards render with lock icon and Request access button.
- Grouped toggle works in both views.
- `AdministrationLandingPage` is untouched and its tests still pass.

For SLICE 3:
- Searching "Account" returns the Account card.
- Searching a tab label returns the parent page card with a `?tab=<id>` href.
- Locked items appear in search results with their locked state preserved.
- Empty query renders the full Home view.
