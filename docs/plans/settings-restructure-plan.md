# Settings restructure — binding slice plan

**Status:** approved 2026-07-31 (Marco) after a grounded audit; every audit finding below was
re-verified against origin/main HEAD on 2026-07-31 before this plan was written.
**Owner:** Marco / ProjectOperations desktop-shell.
**Rule:** every code slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green.

Nothing here changes underlying behaviour of admin functions unless a slice says so explicitly.
No new features except the notification-preferences screen Marco approved. No schema/migrations
except where a slice declares `gate_allow: schema` with a rollback strategy.

---

## 1. Motivation and what this plan replaces

Verified defects on the current tree (evidence pinned to files/lines to keep future readers
honest):

1. **Sidebar Settings group is admin-only.** `apps/web/src/components/ShellLayout.tsx:324-334`
   — `id: "settings", label: "Settings", adminOnly: true`. Filter at line 507 hides it from
   non-admins. Non-admins reach `/settings/account` only through the topbar avatar; they have
   no menu affordance for their own account, notification-preferences, or calendar-sync.
2. **Company-wide Lists rendered inside personal Account.**
   `apps/web/src/pages/account/UserProfilePage.tsx:25` mounts `<GlobalListsSection />`; the
   same section is the "Lists" tab of `/admin/rates-lists`
   (`apps/web/src/pages/admin/RatesListsAdminPage.tsx`). Two entry points for the same
   admin surface, one of them mis-shelved as "personal".
3. **`/settings/notifications` is a triage inbox, not a settings screen.**
   `apps/web/src/pages/NotificationsPage.tsx` is 766 lines of follow-up triage
   (`SharedFollowUpItem` shapes, ACK/WATCH state, urgency labels). Zero files matched
   `*notification*preference*` — the preferences screen does not exist.
4. **AdminSettingsPage is a 13-tab mega-page duplicating first-class routes.**
   `apps/web/src/pages/AdminSettingsPage.tsx:42-56`:
   `notifications, email, operations, users, access-requests, ai, integrations, platform,
   geofences, permissions, client-versions, map-locations, audit`.
   - `AdminUsersTab` (richer) vs `/settings/administration/users` → `UsersPage.tsx` (weaker).
   - `AdminRolesPermissionsTab` (editable matrix) vs `RolesPage.tsx` + `PermissionsPage.tsx`
     (read-only).
   - `audit` tab is a `StubCard` ("Coming soon", line 125) while `AuditLogsPage.tsx` works.
5. **Orphan routes without a nav entry.**
   `apps/web/src/App.tsx:412` → `/admin/automations` → `AutomationsPage` (596 lines, rules
   engine); zero occurrences of "automations" in `ShellLayout.tsx`.
   `apps/web/src/App.tsx:410` → `/admin/estimate-rates` (`EstimateRatesAdminPage`, gate
   `estimates.admin`) writes to the same rate tables as
   `/admin/rates-lists` (`RatesListsAdminPage`, gate `rates.manage`) — two doorways, two
   permissions, one dataset.
6. **`/settings/administration` route missing.** Sub-paths (`/settings/administration/users`
   etc.) exist in `App.tsx:346-393`; the bare `/settings/administration` path is not
   registered → generic breadcrumb, 404 on direct hit.
7. **Ungated nav entries dead-ending at NoAccess.** No `requiresPermission` on:
   - `apps/web/src/components/ShellLayout.tsx:210` — sidebar "Rates & Lists".
   - `apps/web/src/components/SettingsShell.tsx:40` — settings sub-nav "Company".
   - `apps/web/src/components/SettingsShell.tsx:41` — settings sub-nav "AI settings".
8. **`JobRolesPage` filed under Administration collides with RBAC "Roles".**
   `apps/web/src/components/SettingsShell.tsx:56` — "Job roles" is the scheduler competency
   bundle, not a security role.
9. **Commercial config split three ways.** `AdminCompanyPage.tsx:344,509` "Commercial
   defaults" tab; `AdminSettingsPage.tsx:45,98,588` "Operations"/fuel tab;
   `RatesListsAdminPage.tsx` also touches commercial rate tables.
10. **SharePoint config split two ways.** `AdminSettingsPage.tsx:109-120` Platform tab hosts
    `SharePointTestPanel` + `SharePointFolderMappingsPanel`; `PlatformPage.tsx:33+` also owns
    SharePoint folder management.
11. **Off-schema pages (worst first).**
    `AdminCompanyPage.tsx` — 97 `style={` occurrences, 46 raw hex color literals.
    `JobRolesPage.tsx`, `AutomationsPage.tsx`, `CalendarSyncPage.tsx`, `PlatformPage.tsx`
    also carry inline styling / non-DS patterns.
    Zero-DS legacy cluster (no import from `@project-ops/ds`): `UsersPage.tsx`,
    `RolesPage.tsx`, `PermissionsPage.tsx`, `AuditLogsPage.tsx`, `NotificationsPage.tsx`.
12. **Admin guard is role-name-string based.** `apps/web/src/auth/permissions.ts:12-14`
    `isAdminUser()` = `user.isSuperUser === true || user.roles?.some((r) => r.name === "Admin")`.
    Renaming or deleting the seeded "Admin" role silently unguards eight routes.

**Already queued elsewhere — this plan does NOT re-plan these:**
Tender Settings deletion + CRM tab (`pr-tenders-fold-crm-settings-nav`), list-item
`masterdata.manage` guards (PR #838 merged), AI-key single write path (PR #829 merged).

---

## 2. Target information architecture (final state)

**Sidebar top level** — "Settings" group is visible to ALL users (drops `adminOnly`).
Sub-nav items inside the SettingsShell are gated per-item on permission codes (not on
`isAdminUser`). SuperUser bypass in `can()` remains authoritative.

```
Settings   (sidebar group; visible to all; item requiresPermission gates the entries)
├─ Personal
│    Account                  — /settings/account            (no gate; self-service)
│    Notification preferences — /settings/notifications      (no gate; self-service — NEW screen)
│    Calendar sync            — /settings/calendar-sync      (no gate; self-service)
├─ Company
│    Company profile          — /settings/company            (gate: company.manage)
│    Reference data & Lists   — /settings/reference-data     (gate: rates.manage OR lists.manage)
│    AI settings              — /settings/ai                 (gate: ai.manage)
│    Data model               — /settings/data-model         (gate: super-user only, unchanged)
└─ Administration
     Users                    — /settings/administration/users        (gate: users.view)
     Roles & Permissions      — /settings/administration/roles        (gate: roles.manage)
     Audit log                — /settings/administration/audit        (gate: audit.view)
     Platform / Integrations  — /settings/administration/platform     (gate: platform.manage)
     Automations              — /settings/administration/automations  (gate: automations.manage)
```

**Moved OUT of Settings**

- **Notifications inbox** → **new top-level `/inbox`** (renamed from `/notifications`).
  Topbar bell points to `/inbox`. Reuses `NotificationsPage.tsx` renamed to `InboxPage.tsx`;
  behaviour unchanged.
- **Job roles** (scheduler competency bundles) → HR/Workers area, at
  `/hr/job-roles` (or the existing `/workers/job-roles` if a Workers sub-nav already exists —
  the retargeting slice picks the closer of the two).

**Guard model unification (call this out — it is a policy shift):**
Every settings-area entry moves off `AdminOnly` (role-name check) onto `RequirePermissions`
(permission-code check via `can()`), except:
- `/settings/data-model` stays `SuperUserOnly` (super-user is a distinct axis).
- `AdminOnly` itself stays as a component but is only used where a route is truly
  role-scoped (none, once this plan lands — slate to delete after last caller migrated).

**Permission codes** used above — most already exist in the permission catalogue; the two
that need Marco confirmation are called out in **§4 slice 0** (`company.manage`,
`automations.manage`). Do NOT invent new codes silently.

---

## 3. Slice list (ordered, independently shippable)

Each slice ≤ ~10 files. Dependency edges expressed as `requires_merged`. All slices are
docs-and-code (never mixed with `/sot/` edits). One dedicated sot/01 §9 doc-reconcile slice
sits at the end.

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/settings-restructure-plan.md`
- **Gate/CI:** `pnpm lint`.
- **Requires:** nothing.
- **Notes:** binds every slice below.

### SLICE 1 — permission-code inventory + Marco decisions on new codes `size:2`
- **Files:** `docs/plans/settings-restructure-permission-map.md` (docs-only).
- **Purpose:** list every entry in §2's target IA against the current permission catalogue
  (`apps/api/src/common/auth/permissions.ts` or equivalent). For any code that does not
  exist (candidates: `company.manage`, `automations.manage`, `audit.view`,
  `platform.manage`, `ai.manage`), propose the new code and ask Marco to sign off in a
  block called `PENDING-MARCO`.
- **Gate:** `pnpm lint`.
- **Requires:** SLICE 0.

### SLICE 2 — CI blind-spot fix: wire vitest into `pnpm test:web:logic` `size:2`
- **Files:** `apps/web/package.json`, possibly `.github/workflows/ci.yml`.
- **Problem:** `apps/web/src/components/__tests__/ShellLayout.nav.test.ts` never runs in
  CI. `package.json:20` maps `test:web:logic` → `pnpm --filter @project-ops/web test:logic`
  and `apps/web/package.json:13` `test:logic` is a Tendering smoke only. `apps/web/package.json:12`
  has a real `test` script (`vitest run`). CI (`.github/workflows/ci.yml:115`) invokes
  `test:web:logic`, not `test`.
- **Fix:** make `test:web:logic` run vitest as well (keep the Tendering smoke; chain both), or
  add a second CI step `pnpm --filter @project-ops/web test`.
- **Verify:** ShellLayout.nav.test.ts must fail CI if a subsequent slice breaks it (add a
  temporary asserting test that the current sidebar has "Settings" adminOnly-true, watch
  CI go red, revert; then continue with the restructure slices that legitimately change it).
- **Requires:** SLICE 0. **Blocks:** SLICES 3-12 (any slice that touches nav).

### SLICE 3 — Settings group visible to all + per-item permission gates `size:4`
- **Files:** `apps/web/src/components/ShellLayout.tsx` (drop `adminOnly` from settings group;
  add `requiresPermission` per item; add ungated "Settings" landing);
  `apps/web/src/components/SettingsShell.tsx` (drop `AdminOnly` gate on Administration
  section, replace with per-item `RequirePermissions`; add "Company" and "AI settings" gates
  called out in finding 7); `apps/web/src/components/__tests__/ShellLayout.nav.test.ts`
  (update assertions); one e2e spec if any hard-asserts "Settings hidden for non-admin".
- **Requires:** SLICES 1, 2.

### SLICE 4 — Move Notifications inbox out to `/inbox`; wire topbar bell `size:5`
- **Files:** rename `apps/web/src/pages/NotificationsPage.tsx` → `apps/web/src/pages/InboxPage.tsx`
  (no behavioural change); `apps/web/src/App.tsx` (new `/inbox` route; `/notifications` and
  `/settings/notifications` become `Navigate` redirects to `/inbox`); topbar bell in
  `ShellLayout.tsx` retargeted to `/inbox`; e2e spec updates in
  `tests/e2e/pr-acceptance/batch1-auth-shell.spec.ts` (bell target/label).
- **Non-goal:** don't refactor the inbox internals in this slice.
- **Requires:** SLICE 3.

### SLICE 5 — New `NotificationPreferencesPage` at `/settings/notifications` `size:5`
- **Files:** new `apps/web/src/pages/settings/NotificationPreferencesPage.tsx` (minimal:
  per-channel opt-in list backed by an existing preferences endpoint if one exists; else
  ship a UI-only stub with clear TODO for the API slice); `App.tsx` route swap; SettingsShell
  label "Notifications" → "Notification preferences"; e2e spec assertion swap in
  `tests/e2e/pr-acceptance/batch1-auth-shell.spec.ts`. If backing API does not exist, split
  into 5a (UI stub) and 5b (API).
- **Requires:** SLICE 4 (so `/settings/notifications` is free of the inbox first).

### SLICE 6 — Lists off UserProfilePage; single home under Company `size:4`
- **Files:** `apps/web/src/pages/account/UserProfilePage.tsx` (remove `<GlobalListsSection />`);
  new route `/settings/reference-data` in `App.tsx` rendering the existing
  `RatesListsAdminPage` (or a thin wrapper); SettingsShell "Reference data & Lists" item
  with gate; e2e updates.
- **Note:** the section stays admin-shape internally — this slice moves it, does NOT
  rework it. The `/admin/rates-lists` route becomes a redirect (see §4 redirect map).
- **Requires:** SLICE 3.

### SLICE 7 — Consolidate Users: keep `AdminUsersTab`; delete `UsersPage.tsx` `size:5`
- **Files:** replace `UsersPage.tsx` with a thin route wrapper that renders the
  `AdminUsersTab` component at `/settings/administration/users`; delete the standalone
  `UsersPage.tsx`; remove the `users` tab entry from `AdminSettingsPage.tsx` TABS; update
  imports in `AdminSettingsPage.tsx`; update `ShellLayout.nav.test.ts` if it asserts a
  Users nav entry; e2e updates in `batch8-admin-portal.spec.ts`.
- **Behaviour:** unchanged — richer capabilities win, weaker page dies.
- **Requires:** SLICE 3.

### SLICE 8 — Consolidate Roles/Permissions into one editable page `size:6`
- **Files:** new `apps/web/src/pages/administration/RolesPermissionsPage.tsx` reusing the
  existing `AdminRolesPermissionsTab` component; `App.tsx` route
  `/settings/administration/roles` renders the new page; delete `RolesPage.tsx` +
  `PermissionsPage.tsx`; delete SettingsShell entry "Permissions" (fold into
  "Roles & Permissions"); remove `permissions` tab from `AdminSettingsPage.tsx` TABS.
- **Requires:** SLICES 3, 7 (keep the users-page shape stable while this lands).

### SLICE 9 — Delete Audit stub; keep working AuditLogsPage `size:3`
- **Files:** remove the `audit` tab from `AdminSettingsPage.tsx` TABS + the StubCard render
  at line 125; SettingsShell "Audit" entry keeps pointing at `/settings/administration/audit`
  (already the real page).
- **Requires:** SLICE 3.

### SLICE 10 — Adopt Automations into nav under Administration `size:3`
- **Files:** `SettingsShell.tsx` add "Automations" item with `RequirePermissions`;
  `App.tsx` add `/settings/administration/automations` route (Navigate `AutomationsPage`),
  keep `/admin/automations` as a Navigate redirect; e2e update.
- **Non-goal:** no rewrite of the rules engine; only nav plumbing.
- **Requires:** SLICE 3.

### SLICE 11 — Retire `/admin/estimate-rates` (parity check first) `size:4`
- **Two-step:**
  - 11a — **audit-only report** committed to `docs/audits/estimate-rates-parity.md`:
    diff every write path of `EstimateRatesAdminPage.tsx` against `RatesListsAdminPage.tsx`;
    if parity holds → delete slice; if not, enumerate the gaps as slice 11b tasks.
  - 11b — either delete `EstimateRatesAdminPage.tsx` + the route + the `estimates.admin`
    references, or backfill the gaps into RatesListsAdminPage first, then delete.
- **Requires:** SLICES 1 (permission map), 6 (Lists is at its new home).

### SLICE 12 — Merge SharePoint config into Platform page `size:4`
- **Files:** move `SharePointTestPanel` and `SharePointFolderMappingsPanel` invocations from
  `AdminSettingsPage.tsx:109-120` into `PlatformPage.tsx`; delete the `platform` tab of
  AdminSettingsPage; e2e updates.
- **Requires:** SLICE 3.

### SLICE 13 — Consolidate commercial defaults under Company profile `size:5`
- **Files:** move the `OperationsTab`/fuel content from `AdminSettingsPage.tsx` into
  `AdminCompanyPage.tsx` "Commercial defaults" section; delete the operations tab; e2e updates.
- **Non-goal:** no re-skin here (finding 11 is a separate slice — 18a).
- **Requires:** SLICE 3.

### SLICE 14 — Dissolve remaining AdminSettingsPage tabs into homes `size:6`
- **Files:** at this point only the low-traffic tabs remain (notifications, email,
  access-requests, ai, integrations, geofences, client-versions, map-locations). Route each
  to its natural home under `/settings/administration/*` (e.g. Geofences → Sites area,
  Access requests → its own page, Notifications-admin-templates → next to preferences), then
  delete `AdminSettingsPage.tsx` and its route.
- **Note:** this is the biggest single slice — split into 14a/14b if any file count exceeds ten.
- **Requires:** SLICES 7, 8, 9, 10, 12, 13.

### SLICE 15 — Move Job roles to HR/Workers area `size:4`
- **Files:** `SettingsShell.tsx` remove Administration "Job roles"; register
  `/hr/job-roles` (or `/workers/job-roles`) in `App.tsx`; add a Navigate from
  `/settings/administration/job-roles` and `/admin/job-roles`; add a Workers-area nav entry;
  e2e updates.
- **Requires:** SLICE 3.

### SLICE 16 — Register `/settings/administration` landing page `size:2`
- **Files:** `App.tsx` add a route rendering a small hub (`AdministrationLandingPage`) that
  lists the Administration sub-nav items the caller has access to; SettingsShell already
  handles the sub-nav, this fixes the direct-hit 404.
- **Requires:** SLICE 3.

### SLICE 17 — Guard-model unification (`AdminOnly` deletion) `size:4`
- **Files:** replace remaining `AdminOnly` wrappers in `App.tsx` (routes 338-393) with
  `<RequirePermissions perms={[...]}>` using the permission codes from SLICE 1; delete
  `AdminOnly` export from `SettingsShell.tsx` once uncalled; add an ESLint rule
  (or a `ShellLayout.nav.test.ts` assertion) that forbids new usages.
- **Note:** intentional last-code slice; every earlier slice already switched its own routes.
- **Requires:** SLICES 3-16.

### SLICE 18a — Re-skin: `AdminCompanyPage.tsx` onto s7 tokens `size:6`
- **Scope:** style only. Zero behaviour change. Replaces the 97 inline `style={` +
  46 raw hex literals with s7 tokens / classes. This is a re-skin PR, never mixed with a
  move/merge PR (per rule "never move AND re-skin in one PR").
- **Requires:** SLICE 13.

### SLICE 18b — Re-skin: `JobRolesPage.tsx` `size:3`
- **Requires:** SLICE 15.

### SLICE 18c — Re-skin: `AutomationsPage.tsx` `size:4`
- **Requires:** SLICE 10.

### SLICE 18d — Re-skin: `CalendarSyncPage.tsx` `size:3`
- **Requires:** SLICE 3.

### SLICE 18e — Re-skin: `PlatformPage.tsx` (post-SharePoint merge) `size:4`
- **Requires:** SLICE 12.

### SLICE 19a-e — Legacy DS uplift (zero-DS pages) `size:3 each`
- One slice per file: `UsersPage.tsx` (or its replacement wrapper),
  `RolesPage.tsx`/`PermissionsPage.tsx` (their replacement), `AuditLogsPage.tsx`,
  `InboxPage.tsx` (ex-NotificationsPage). If a file has already been deleted by an earlier
  slice, drop the re-skin slice.
- **Requires:** SLICE 7/8/9/4 respectively.

### SLICE 20 — sot/01 §9 nav-IA doc-reconcile `size:1`
- **Files:** `sot/01-charter-and-architecture.md` §9 (nav / IA) only.
- **Docs-only PR, never mixed with code (CP-24 sot-purity gate blocks the mix).**
- **Requires:** every code slice merged.

---

## 4. Redirect map (old URL → new home)

Every URL currently in `App.tsx` gets an explicit disposition. Preferred: 301-style
`Navigate replace` to preserve bookmarks. Only outright deletion (404) where the surface
itself goes away.

| Old URL                          | Disposition | New URL / notes                                 | Slice |
|----------------------------------|-------------|-------------------------------------------------|-------|
| `/notifications`                 | redirect    | `/inbox`                                        | 4     |
| `/settings/notifications`        | redirect    | `/inbox` (then re-used for preferences)         | 4, 5  |
| `/admin/users`                   | redirect    | `/settings/administration/users`                | (already) |
| `/admin/roles`                   | redirect    | `/settings/administration/roles`                | (already) |
| `/admin/permissions`             | redirect    | `/settings/administration/roles` (merged page)  | 8     |
| `/admin/audit`                   | redirect    | `/settings/administration/audit`                | (already) |
| `/admin/platform`                | redirect    | `/settings/administration/platform`             | (already) |
| `/admin/settings`                | redirect    | `/settings/administration` (landing)            | 16    |
| `/admin/company`                 | redirect    | `/settings/company`                             | (already) |
| `/admin/data-model`              | redirect    | `/settings/data-model`                          | (already) |
| `/admin/ai-settings`             | redirect    | `/settings/ai`                                  | (already) |
| `/admin/estimate-rates`          | delete OR redirect | → `/settings/reference-data` if parity holds; 404 with helpful message if gaps blocked deletion | 11 |
| `/admin/rates-lists`             | redirect    | `/settings/reference-data`                      | 6     |
| `/admin/automations`             | redirect    | `/settings/administration/automations`          | 10    |
| `/admin/job-roles`               | redirect    | `/hr/job-roles` (or `/workers/job-roles`)       | 15    |
| `/settings/administration/job-roles` | redirect | `/hr/job-roles`                                 | 15    |
| `/account`                       | keep        | `/settings/account` (already redirects)         | —     |
| `/settings/administration`       | keep (new)  | `AdministrationLandingPage`                     | 16    |

Rule: every legacy redirect stays for at least one release cycle after the last slice
lands. Removing them is a separate housekeeping slice (not planned here).

---

## 5. Risks

### 5.1 e2e specs that assert current nav labels or paths
Slices touching nav/labels MUST update these files (grepped 2026-07-31, found 24 hits across
6 files):

- `tests/e2e/pr-acceptance/batch1-auth-shell.spec.ts` — sidebar labels, avatar/topbar,
  bell target. Affected by SLICES 3, 4, 5.
- `tests/e2e/pr-acceptance/batch8-admin-portal.spec.ts` — Admin portal breadcrumbs,
  AdminSettingsPage tabs, Users/Roles/Permissions pages. Affected by SLICES 7, 8, 9, 10,
  12, 13, 14, 15, 16.
- `tests/e2e/pr-acceptance/batch8-misc.spec.ts` — settings-adjacent misc. Affected by
  SLICES 6, 11.
- `tests/e2e/pr-acceptance/batch2-tendering.spec.ts` — has ONE match; verify it's not
  nav-shape assertion. Likely no update needed.
- `tests/e2e/pr-acceptance/batch3-scope-cutting.spec.ts` — same, ONE match.
- `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — ONE match.

Each slice's PR body must list the specs it touches and the assertions it changed.

### 5.2 CI blind spot on ShellLayout.nav.test.ts (SLICE 2)
`.github/workflows/ci.yml:115` runs `pnpm test:web:logic`, which via
`apps/web/package.json:13` is a Tendering smoke only. `apps/web/package.json:12`'s vitest
`test` script never runs in CI. Every subsequent nav-touching slice MUST land after SLICE 2
or run the vitest suite locally with proof pasted in the PR body.

### 5.3 Guard unification changes NoAccess semantics
Slice 17 replaces `AdminOnly` with `RequirePermissions`. Users who currently hit
NoAccess because they are non-Admin will start hitting NoAccess because they lack
`platform.manage` (etc.) — same result today, but the audit trail message changes. If
CS/Support has runbooks referring to the "role:Admin required" NoAccess string, update
them; if not, no action.

### 5.4 Renaming the seeded "Admin" role today unguards eight routes
Finding 12: `isAdminUser` matches on role name string. This plan fixes it via SLICE 17,
but the tree is exposed until SLICE 17 merges. If a Marco-driven rename lands mid-plan,
freeze the rename until SLICE 17 is in.

### 5.5 Automations page never had a nav entry
Its user base is admin-only-by-URL; adopting it into Administration nav in SLICE 10 will
increase discovery — verify with Marco whether that is desired before merging SLICE 10, in
case any current usage assumes obscurity.

### 5.6 Merge order pins on SLICE 3
Every restructure slice depends on SLICE 3 (Settings group visible + per-item gates). If
SLICE 3 revert is ever needed, revert order is reverse-of-merge; the plan intentionally
keeps SLICE 3 tiny to make revert cheap.

---

## 6. Out of scope

- Any behaviour change to underlying admin functions (Users management logic, Automations
  rules engine, Rates & Lists writes, Audit log query, SharePoint sync). This plan
  relocates and re-skins; it does not rewrite.
- Schema/migrations. If a slice needs one (unlikely — this is a UI/nav restructure), that
  slice declares `gate_allow: schema` and a rollback strategy in its own front-matter; do
  not slip a schema change into a nav slice.
- Tender Settings deletion / CRM tab (queued as `pr-tenders-fold-crm-settings-nav`).
- List-item `masterdata.manage` guards (shipped in PR #838).
- AI-key single write path (shipped in PR #829).
- Cleanup of legacy redirect routes (post-release housekeeping, not in this plan).
- ShellLayout main sidebar restructuring beyond the Settings group's visibility flag
  (other groups are not in scope).
- Any Field/mobile-side navigation (Marco: "FIELD nav is untouched").

---

## 7. Verification of this document

- [x] `test -f docs/plans/settings-restructure-plan.md`
- [x] Every route in the current App.tsx settings/admin block has an explicit disposition
      in §4 (keep / move / merge / delete / redirect).
- [x] Every audit finding in §1 is pinned to a file:line seen on origin/main 2026-07-31.
- [ ] `pnpm lint` (run at PR-open time).
