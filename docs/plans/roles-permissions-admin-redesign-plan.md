# Roles & Permissions admin redesign — SLICE-0 plan

**Status:** SLICE-0 planning. Docs-only. Each SLICE below becomes its own armed
prompt and its own PR, executed one at a time in the order given.

**Scope:** The admin surfaces `/settings/administration/users`
(`apps/web/src/pages/admin/AdminUsersTab.tsx`) and `/settings/administration/roles`
(`RolesPermissionsPage` -> `apps/web/src/pages/admin/AdminRolesPermissionsTab.tsx`)
become the in-app control centre for access. Super-users manage roles and
per-user role assignments through the app; seed edits are reserved for baseline
role deltas only (SLICE 5 is the only seed change in this program).

**Out of scope (state explicitly):**
- Email-invite / onboarding flow (heavier, M365/Graph-touching — separate program).
- Any Azure / Entra / SharePoint change.
- Any `/sot/` edit. If the roadmap or status changes are needed, they land in a
  separate doc-reconcile PR (CP-24 forbids mixed PRs).

---

## Model decisions (locked with Marco 2026-08-11)

1. **Additive multi-role per user.** A user holds several roles at once;
   effective access = the UNION of that user's roles' permissions. The data
   layer already supports this (see grounded facts).
2. **Selection everywhere is by effective PERMISSION (union), never by role
   NAME.** This is the root-cause fix for the estimator-picker bug: any code
   that today asks "who is an Estimator" must instead ask "who effectively
   holds `estimates.manage`".

---

## GROUNDED facts (verified against `origin/main` — trust these when arming slices)

- `apps/api/prisma/schema.prisma`: `UserRole` is already a many-to-many join
  (`@@unique([userId, roleId])`). **Multi-role is already supported at the
  data layer.** No schema change is needed to hold multiple roles per user.
- `apps/api/src/modules/users/users.controller.ts`: `POST /users` and
  `PATCH /users/:id` already accept `roleIds[]` ("supplying roleIds replaces
  the user's role set"). The `/users` list supports only a `role` NAME filter
  (case-insensitive substring) — there is **NO** `permission` filter today.
- `apps/web/src/pages/tendering/teamEstimatorActions.ts`: `loadEstimators()`
  calls `/users?role=estimator` — filters by role NAME. Admins (Marco / Sean /
  Colin) hold `estimates.manage` via the Admin role but NOT the literal
  "Estimator" role, so they never appear. **This is the bug SLICE 1 fixes.**
- `apps/api/src/modules/roles/roles.controller.ts`: `POST /roles` (roles.create)
  and `PATCH /roles/:id` (roles.update) **already exist**. Per-permission
  grant/revoke (`PUT/DELETE /roles/:roleId/permissions/:permissionId`) exist
  and are super-user gated + audited. There is **NO** `DELETE /roles/:id` —
  role deletion is the lifecycle gap SLICE 3 closes.
- `apps/web/src/pages/admin/AdminUsersTab.tsx` reads `/admin/users` (a
  DIFFERENT endpoint) which returns a SINGLE `role: {id,name}|null`. This
  duplicates the `/users` module. SLICE 2 must choose one of:
  1. **Recommended:** consolidate the web onto `/users` (which is multi-role
     capable) and retire the `/admin/users` list; OR
  2. Extend `/admin/users` to return `roles[]` (leaves duplication in place).
  The plan recommends option 1.
- `apps/api/prisma/schema.prisma`: `User.lastLoginAt` **already exists**. A
  "last active" column in the users list is a pure web change.
- `apps/api/src/common/permissions/permission-registry.ts` is the code-side
  permission catalogue (~95 codes). **New permission CODES are a code
  change**; assigning existing codes to roles is an in-app action.

## LESSONS to honour (cite when arming each slice)

- **Permission-registry guard blind spot** (sot/05, S3-016 family): the CI guard
  sees only `@RequirePermissions(...)` DECORATORS; object-literal permission
  maps ship false gates CI-green. Every new endpoint MUST use the
  `@RequirePermissions` decorator, never a literal map.
- **Fail-closed gates + `isSuperUser` tier rule:** role-permission edits stay
  super-user-only, server-enforced (a disabled input is NOT access control).
- **Seed is additive-only (S3-016):** re-seeding roles must NEVER delete a
  `RolePermission` an admin set in-app; grant missing baselines only. SLICE 5
  is additive.
- **PROMPT-SCHEMA:** any schema change regenerates the data-model map
  (`build-relationship-map.mjs`), declares `GATE-ALLOW: migrations`, and
  updates affected `*.spec.ts` payload assertions.

---

## SLICES

Each slice is one PR, armed one at a time. Every slice must:

- Add or update tests to prove the behaviour (unit + a smoke integration where
  the module already has one).
- Pass `pnpm build` + `pnpm lint`.
- Use `@RequirePermissions(...)` decorators on any new endpoint (never a
  literal map).
- Keep super-user server-side enforcement for role/permission mutations.

### SLICE 1 — Capability-based user selection (fixes the estimator bug)
**Size:** ~5. **Areas:** API + web. **Depends on:** none.

**API (`apps/api/src/modules/users`):**
- Add a `permission` query param to `GET /users` in `list-users-query.dto.ts`
  and `users.service.ts`. It returns users whose EFFECTIVE permissions (union
  across every role in `UserRole`) include the given code.
- Keep `role=` (NAME) for back-compat; the two params may compose (AND).
- Unit-test the union filter (users with multiple roles; users with role but
  no matching permission; super-user path if applicable).

**Web:**
- Point `loadEstimators()` in
  `apps/web/src/pages/tendering/teamEstimatorActions.ts` at
  `/users?permission=estimates.manage`.
- Sweep other name-filter uses (`grep -r "role=" apps/web/src/pages`) for
  places where the intent is "who can do X" and switch them to `permission=`.

**Acceptance:**
- A user holding ONLY the Admin role (no "Estimator" role) appears in the
  response for `GET /users?permission=estimates.manage`.
- The estimator dropdown in the tendering UI lists Admins.
- Existing role-name-filter tests still pass.

**Premise idea:**
`! grep -q "permission" apps/api/src/modules/users/dto/list-users-query.dto.ts`

---

### SLICE 2 — Multi-role user detail page + list consolidation
**Size:** ~6. **Areas:** web-led (API already supports `roleIds[]`).
**Depends on:** SLICE 1 (so the list can filter by permission too).

**Web:**
- Rebuild the user surface as a full detail page (mirror
  `apps/web/src/pages/directory/WorkerDetailPage.tsx` conventions) with:
  - A multi-role dropdown/chips control that PATCHes `roleIds[]` via
    `PATCH /users/:id`.
  - Read-only summary chips of effective permissions (grouped by domain).
  - Last-active (`User.lastLoginAt`) rendered in the list and detail header.
  - Search / filter (by role NAME, by permission CODE) / sort in the list.
- Consolidate the web onto `/users` (retire the `/admin/users` read path in
  `AdminUsersTab.tsx`) so both list and detail see ALL of a user's roles.
  Alternative: extend `/admin/users` to return `roles[]`, but this leaves
  duplication in place — the recommended path is consolidation.

**API (if any):**
- No new endpoints expected. If the list needs `lastLoginAt` in the response
  shape, add it to the `/users` DTO (already stored in the model).

**Acceptance:**
- Assigning a second role via the UI PATCHes `roleIds[]` and the list shows
  both role chips.
- Last-active column populates from `User.lastLoginAt`.
- The `/admin/users`-fed single-role view is gone (or clearly deprecated).

**Premise idea (choose the one that still holds at arm time):**
`grep -q "role: { id: string; name: string } | null" apps/web/src/pages/admin/AdminUsersTab.tsx`

---

### SLICE 3 — Role lifecycle: DELETE-with-reassign + clone; cards/slider editor
**Size:** ~8. **Areas:** API + web. **Depends on:** SLICE 2 (users detail
already multi-role capable, so reassignment is coherent).

**API (`apps/api/src/modules/roles`):**
- Add `DELETE /roles/:id` — super-user gated via `@RequirePermissions(...)`,
  audited. Contract:
  - REQUIRES a `reassignToRoleId` in the request body; every member of the
    role being deleted has that role removed and the reassign role added
    (idempotent — no-op if they already hold it).
  - Runs inside a transaction with the delete of the role itself.
  - **BLOCKS** deleting an `isSystem` role (400).
  - Reuse either the existing roles.update permission code or a new
    `roles.delete` code — decide at arm time; either way document the choice.
- Optional `POST /roles/:id/clone` — clones a role's permission set into a new
  role (name required, description optional). Super-user gated + audited.

**Web (`apps/web/src/pages/admin/AdminRolesPermissionsTab.tsx`):**
- Rebuild the editor as **area cards + access slider**:
  - 5 domain groupings (Tendering, Projects, Directory, Finance, Admin — final
    grouping decided at arm time against `permission-registry.ts`).
  - Per-area cumulative access slider: **None / View / Manage / Admin** — each
    step is a superset of the previous (this is a presentation-only mapping
    over the underlying permission grants; write via existing PUT/DELETE
    per-permission endpoints).
  - Separate toggles for VERB-only permissions (submit / approve / receive)
    that don't fit the slider.
  - Plain-English area description + live "what this grants" preview.
  - Create / clone / rename / delete controls; system roles protected in the
    UI (server enforces the truth).

**Acceptance:**
- Deleting a role without a reassignment target returns 400.
- Deleting an `isSystem` role returns 400.
- After a successful delete, every ex-member holds the reassign role.
- Slider changes issue the correct PUT/DELETE permission calls and are
  reflected on reload.

**Premise idea:**
`! grep -q "@Delete('':id'')" apps/api/src/modules/roles/roles.controller.ts`
(escape the quotes as appropriate for the shell used to check.)

---

### SLICE 4 — Permission-model granularity splits (schema + registry + guards)
**Size:** ~9. **Areas:** schema (additive) + registry + guards + web copy.
**Depends on:** SLICE 3 (editor can now show new codes).
**GATE-ALLOW:** `migrations` (declare at arm time; PROMPT-SCHEMA applies).

Split coarse permissions so agreed policy is expressible:

(a) **`projects.admin` split** — separate:
  - `projects.changecontractvalue` — change contract value on an existing project.
  - `projects.createmanual` — create a project outside the tender-conversion flow.
  - `projects.reopenclosed` — reopen a closed project.
  Existing `projects.admin` grants BACKFILL into all three additively.

(b) **`directory.admin` split** — separate:
  - `directory.delete` — hard-delete a directory entry.
  - `directory.approvecredit` — approve credit / credit limits.
  - `directory.prequalification` — manage prequalification records.
  Existing `directory.admin` grants BACKFILL into all three additively.

(c) **`forms.admin` enforcement** — the code is declared in
    `permission-registry.ts` but not enforced today; add
    `@RequirePermissions('forms.admin')` to the correct endpoints in
    `apps/api/src/modules/forms/*`. Guard tests updated.

**Deferred (not in this slice):** `finance.admin` split — not required by any
of the six current job roles' agreed grants.

**Work:**
- Add new codes to `apps/api/src/common/permissions/permission-registry.ts`.
- Add additive migration under `apps/api/prisma/migrations` that BACKFILLS the
  existing coarse grants into each new code (per role and per user override,
  if any). No-op if a role already holds the new code.
- Regenerate the data-model map (`build-relationship-map.mjs`) and commit
  `metadata-catalog.json`.
- Update `@RequirePermissions(...)` decorators on any endpoint that previously
  demanded the coarse code but should demand one of the new specific codes.
- Update affected `*.spec.ts` payload assertions.
- Backfill test proves an admin who held `projects.admin` before the migration
  still has all three new codes after. If a full backfill test is impractical,
  set `backfill: false` in the prompt frontmatter and justify.

**Premise idea:**
`! grep -q "projects.changecontractvalue" apps/api/src/common/permissions/permission-registry.ts`

---

### SLICE 5 — Re-seed the six job roles to the agreed grants (additive)
**Size:** ~3. **Areas:** seed only. **Depends on:** SLICE 4(a) for PM projects
grants; the rest are usable without SLICE 4.
**seed_only:** true.

Before writing seed deltas, DUMP LIVE DB grants for each of the six roles and
diff against the current seed — every delta below must be additive against
LIVE state (never remove a `RolePermission` a super-user added via the UI).
The only exception is **Warehouse Manager**, which explicitly REMOVES two
grants; call this out in the PR body and confirm with Marco before pushing
the destructive lines.

Deltas (from Marco's sign-off matrix, 2026-08-11):

- **Senior Estimator:**
  `+ tenderconversion.manage`, `+ finance.view`, `+ finance.manage`.
- **Project Manager:**
  `+ procurement.view`, `+ procurement.manage`, `+ procurement.approve`,
  `+ expenses.view`, `+ expenses.approve`,
  `+ projects.createmanual`, `+ projects.reopenclosed`
  (NOT `projects.changecontractvalue`) — projects deltas require SLICE 4(a).
- **WHS Officer:**
  `+ directory.view`, `+ directory.manage`, `+ directory.admin`,
  `+ forms.approve`, `+ forms.admin`,
  `+ knowledge.view`, `+ knowledge.manage`,
  `+ cases.view`, `+ cases.manage`, `+ reporting.view`.
- **Accounts:**
  `+ finance.admin`,
  `+ expenses.view`, `+ expenses.manage`, `+ expenses.approve`,
  `+ procurement.view`, `+ procurement.approve`,
  `+ directory.approvecredit` (from SLICE 4(b); fall back to `directory.admin`
  if SLICE 4 is not yet merged when this slice is armed).
- **Warehouse Manager:**
  **REMOVES** `resources.view`, `resources.manage`;
  `+ forms.view`, `+ forms.manage`.
- **Field Worker:**
  `+ documents.view`.

**Acceptance:**
- Reseeding on a fresh DB gives every role the agreed grants.
- Reseeding on an existing DB does NOT remove any admin-added `RolePermission`
  except the explicit Warehouse Manager removals.
- Six per-role assertion tests (one per role) prove the effective permission
  set matches the delta table above.

**Premise idea:**
`! grep -q "tenderconversion.manage" apps/api/prisma/seed-initial-services.ts`

---

## Slice ordering / dependencies (summary)

```
SLICE 1 (permission filter)
   -> SLICE 2 (multi-role user detail + list consolidation)
      -> SLICE 3 (role lifecycle + cards/slider editor)
         -> SLICE 4 (granularity splits — migration)
            -> SLICE 5 (seed deltas; PM projects grants depend on SLICE 4(a))
```

Each slice is one PR, armed one at a time. SLICE 4 declares
`GATE-ALLOW: migrations`; SLICE 5 declares `seed_only: true`. No slice mixes
`sot/` edits with code (CP-24).

---

## What this plan does NOT do

- Does not itself write any code, schema, seed, registry, or `/sot/` change.
- Does not arm the individual SLICE prompts — each SLICE is armed as its own
  prompt with its own premise, verified before it runs.
- Does not change onboarding, email-invite, or any Microsoft 365 / Entra /
  SharePoint surface.
