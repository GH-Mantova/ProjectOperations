---
premise: '! ls docs/plans/ | grep -q "roles-permissions-admin-redesign-plan.md"'
premise_means: The Roles & Permissions admin redesign SLICE-0 plan document does not exist on main yet.
scope:
  - docs/plans/**
done_when: test -f docs/plans/roles-permissions-admin-redesign-plan.md && grep -q "SLICE 5" docs/plans/roles-permissions-admin-redesign-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
backfill: false
---

# SLICE-0 PLAN — Roles & Permissions admin redesign (Users + Roles pages)

Write ONE new planning document at `docs/plans/roles-permissions-admin-redesign-plan.md`
that captures the design and the slice breakdown below. This is a docs-only prompt: create the
plan, open the PR, exit. Do NOT write any code, schema, or seed changes in this run — each SLICE
becomes its own armed prompt later.

## Context / problem (state in the plan)

The admin surfaces `/settings/administration/users` (`apps/web/src/pages/admin/AdminUsersTab.tsx`)
and `/settings/administration/roles` (`RolesPermissionsPage` -> `AdminRolesPermissionsTab.tsx`)
need to become the in-app control centre for access. Marco's requirement: **all role management
is done in-app by super-users** — no seed edit for day-to-day changes.

Model decisions (locked with Marco 2026-08-11):
- **Additive multi-role per user.** A user holds several roles; effective access = the UNION of
  their roles' permissions.
- **Selection everywhere is by effective PERMISSION (union), never by role NAME.** This is the
  root-cause fix for the estimator-picker bug.

## GROUNDED facts (verified against origin/main — put these in the plan so slice authors trust them)

- `apps/api/prisma/schema.prisma`: `UserRole` is already a many-to-many join (`@@unique([userId, roleId])`).
  Multi-role is ALREADY supported at the data layer.
- `apps/api/src/modules/users/users.controller.ts`: `POST /users` and `PATCH /users/:id` already
  accept `roleIds[]` ("supplying roleIds replaces the user's role set"). The `/users` list supports
  only a `role` NAME filter (case-insensitive substring) — there is NO `permission` filter.
- `apps/web/src/pages/tendering/teamEstimatorActions.ts`: `loadEstimators()` calls
  `/users?role=estimator` — filters by role NAME. Admins (Marco/Sean/Colin) hold `estimates.manage`
  via the Admin role but NOT the literal "Estimator" role, so they never appear. THIS is the bug.
- `apps/api/src/modules/roles/roles.controller.ts`: `POST /roles` (roles.create) and
  `PATCH /roles/:id` (roles.update) ALREADY EXIST. Per-permission grant/revoke
  (`PUT/DELETE /roles/:roleId/permissions/:permissionId`) exist and are SUPER-USER gated + audited.
  There is NO `DELETE /roles/:id` — role deletion is the lifecycle gap.
- `apps/web/src/pages/admin/AdminUsersTab.tsx` reads `/admin/users` (a DIFFERENT endpoint) which
  returns a SINGLE `role: {id,name}|null`. This duplicates the `/users` module. The plan must
  choose: consolidate the web onto `/users` (multi-role capable) OR extend `/admin/users` to return
  `roles[]`. Recommend consolidating on `/users`.
- `apps/api/prisma/schema.prisma`: `User.lastLoginAt` already exists — a "last active" column is a
  pure web change.
- `apps/api/src/common/permissions/permission-registry.ts` is the code-side permission catalogue
  (~95 codes). New permission CODES are a code change; assigning existing codes to roles is in-app.

## LESSONS to honour (from sot/05 + memory — cite in the plan)

- **Permission-registry guard blind spot:** the CI guard sees only `@RequirePermissions(...)`
  DECORATORS; object-literal permission maps ship false gates CI-green. Every new endpoint MUST use
  the `@RequirePermissions` decorator, never a literal map.
- **Fail-closed gates + `isSuperUser` tier rule:** role-permission edits stay super-user-only,
  server-enforced (a disabled input is not access control).
- **Seed is additive-only (S3-016):** re-seeding roles must NEVER delete a RolePermission an admin
  set in-app; grant missing baselines only.
- **Any schema change** regenerates the data-model map (`build-relationship-map.mjs`), declares
  `GATE-ALLOW: migrations`, and updates affected `*.spec.ts` payload assertions (PROMPT-SCHEMA).

## The slices (each becomes its own armed prompt; enumerate them in the plan with a premise each)

### SLICE 1 — Capability-based user selection (fixes the estimator bug). API + web. size ~5.
Add a `permission` query param to `GET /users` (`apps/api/src/modules/users`) that returns users
whose EFFECTIVE permissions (union across their roles) include the given code. Point
`loadEstimators()` at `/users?permission=estimates.manage`. Keep `role=` for back-compat.
Acceptance: a user holding only the Admin role appears in `/users?permission=estimates.manage`;
the estimator dropdown lists Admins. Unit test the union filter; keep the existing role-filter test.
Premise idea: `! grep -q "permission" apps/api/src/modules/users/dto/list-users-query.dto.ts`.

### SLICE 2 — Multi-role on the user detail page (web-led; API already supports roleIds[]). size ~6.
Rebuild the user surface as a full detail page (mirror `WorkerDetailPage.tsx` conventions) with a
multi-role dropdown/chips that PATCHes `roleIds[]`. Consolidate the web onto `/users` (or extend
`/admin/users` to return `roles[]`) so the list + detail show ALL of a user's roles. Add
last-active (`User.lastLoginAt`) + search/filter/sort to the list.
Premise idea: web still renders a single role — `grep -q "role: { id: string; name: string } | null" apps/web/src/pages/admin/AdminUsersTab.tsx`.

### SLICE 3 — Role lifecycle: DELETE-with-reassign + clone; cards/slider editor. API + web. size ~8.
API: add `DELETE /roles/:id` gated on a NEW `roles.delete` permission code (add it to
`permission-registry.ts`; super-user gated, `@RequirePermissions` decorator) that REQUIRES
reassignment of members to another role before removal, and BLOCKS deleting an `isSystem` role. Optional `POST /roles/:id/clone`. Web: rebuild `AdminRolesPermissionsTab` as the area-cards +
access-slider editor (None/View/Manage/Admin cumulative), grouped into 5 domains, with plain-English
area descriptions + live "what this grants"; separate verbs (submit/approve/receive) as their own
toggles; create/clone/rename/delete controls; system roles protected. Reuse existing grant/revoke
endpoints for cell writes.
Premise idea: `! grep -rq "Delete(\":id\")" apps/api/src/modules/roles/roles.controller.ts`.

### SLICE 4 — Permission-model granularity splits (schema + registry + guards). size ~9. MIGRATION.
Split coarse permissions so agreed policy is expressible:
(a) `projects.admin` -> separate "change contract value" from create-manually/reopen-closed;
(b) `directory.admin` -> separate delete / approve-credit / prequalification;
(c) wire up `forms.admin` enforcement (declared but NOT enforced today).
Add the new codes to `permission-registry.ts`, migrate role grants additively, regen the data-model
map, declare `GATE-ALLOW: migrations`, update specs, add a backfill test or `backfill: false`.
Note `finance.admin` split is deferred (not needed by current six roles).
Premise idea: `! grep -q "projects.changecontractvalue" apps/api/src/common/permissions/permission-registry.ts`.

### SLICE 5 — Re-seed the six job roles to the agreed grants (seed_only; additive). size ~3.
Apply the agreed per-role deltas (from the sign-off matrix) additively in
`apps/api/prisma/seed-initial-services.ts` — verify LIVE DB grants vs seed first. Deltas:
- **Senior Estimator**: + tenderconversion.manage, + finance.view + finance.manage.
- **Project Manager**: + procurement.view/manage/approve, + expenses.view/approve; projects
  create+reopen (NOT change-value) — depends on SLICE 4(a).
- **WHS Officer**: + directory.view/manage/admin, + forms.approve + forms.admin,
  + knowledge.view/manage, + cases.view/manage, + reporting.view.
- **Accounts**: + finance.admin, + expenses.view/manage/approve, + procurement.view/approve,
  + directory.admin (approve credit).
- **Warehouse Manager**: REMOVE resources.view/manage; + forms.view/manage.
- **Field Worker**: + documents.view.
Premise idea: `! grep -q "tenderconversion.manage" <(grep -A40 seniorEstimatorRole apps/api/prisma/seed-initial-services.ts)`.

## Out of scope (state explicitly)
Email-invite onboarding flow (heavier, M365/Graph-touching — separate program). Any Azure / Entra /
SharePoint change. No `/sot/` edits in these slices (if roadmap/status needs updating, that is a
separate doc-reconcile PR).

## Slice ordering / dependencies (state in the plan)
1 -> 2 -> 3 -> 4 -> 5. SLICE 5's PM projects grant depends on SLICE 4(a). Each slice is one PR,
armed one at a time.

---

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Do NOT
- Do NOT write any code, schema, seed, or `/sot/` changes in this run — this prompt produces ONLY
  the plan document under `docs/plans/`.
- Do NOT create the individual SLICE prompts here — they are armed separately.
- Do NOT touch Azure / Entra / SharePoint.

## Guardrails
- One attempt. Never exit silently — if the plan doc already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval — there is no human in this run; open the PR.
- Docs-only PR (only `docs/plans/**`); never mix code or `sot/` (CP-24 fails a mixed PR).
- Read the job log before diagnosing any CI failure.

## VERIFY
- `test -f docs/plans/roles-permissions-admin-redesign-plan.md`
- `grep -q "SLICE 5" docs/plans/roles-permissions-admin-redesign-plan.md`
- PR opened, docs-only diff.
