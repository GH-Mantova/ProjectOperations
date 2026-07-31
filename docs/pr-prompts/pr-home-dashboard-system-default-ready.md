---
premise: grep -q "Could not create default dashboard." apps/web/src/dashboards/DashboardCanvas.tsx
premise_means: The web client still auto-creates a deletable, sidebar-listed "Operations Overview" dashboard whenever GET /user-dashboards?slug=operations returns empty — so deleting it resurrects it with a new id on every Home visit.
scope:
  - apps/api/src/modules/platform/user-dashboards.service.ts
  - apps/api/src/modules/platform/user-dashboards.service.spec.ts
  - apps/web/src/dashboards/DashboardCanvas.tsx
  - apps/web/src/pages/DashboardPlaceholderPage.tsx
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
done_when: pnpm build && pnpm lint && ! grep -q "Could not create default dashboard." apps/web/src/dashboards/DashboardCanvas.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Home dashboard: server-owned SYSTEM default — kill the "Operations Overview" resurrection loop

## The defect (verified on origin/main 2026-07-31)

`DashboardCanvas.loadBySlug` (apps/web/src/dashboards/DashboardCanvas.tsx): when
`GET /user-dashboards?slug=operations` returns `[]`, the CLIENT POSTs a new dashboard named
"Operations Overview". `UserDashboardsService.create` hard-codes `isSystem: false`, so the row is
deletable AND is listed in the sidebar (`ShellLayout` lists all `!isSystem` dashboards). Marco
deletes it; the next visit to `/` recreates it under a fresh UUID. Endless loop, by construction.

## What to build

**1. Server-side idempotent ensure (apps/api/src/modules/platform/user-dashboards.service.ts):**

In `list(userId, slug)` — only when `slug === "operations"` — before returning:

- Fetch the user's rows for that slug.
- If a row with `isSystem: true` exists → return as normal.
- Else if one or more non-system rows exist → PROMOTE one to `isSystem: true` (prefer
  `isDefault: true`, else oldest `createdAt`) via `update`. This preserves the layout the user
  already customised and makes the existing stray row vanish from the sidebar lazily — no
  migration, no seed change.
- Else (no rows at all) → CREATE `{ isSystem: true, isDefault: false, name: "Operations Overview",
  slug: "operations", config: UserDashboardsService.defaultOperationsConfig() }` (the factory
  already exists in this service).
- Race safety: wrap the promote/create in try/catch on P2002 (the `@@unique([userId, slug,
  isSystem])` constraint is the arbiter, same pattern as `create()` — see PR #803/#804); on P2002,
  re-read and return. Never check-then-create without the catch.
- Audit-log the provisioning (`userDashboards.ensureSystemDefault`) like the other mutations.

**2. Remove the client-side create fallback (apps/web/src/dashboards/DashboardCanvas.tsx):**

- In `loadBySlug`, delete the entire `else if (defaultConfig)` POST branch (the one whose error
  string is "Could not create default dashboard."). If the list comes back empty, set an error
  state ("Unable to load dashboards.") — with the server ensure in place this is unreachable in
  practice.
- Drop the now-dead `defaultConfig` / `defaultName` props from the component's Props type and
  destructuring.

**3. Simplify apps/web/src/pages/DashboardPlaceholderPage.tsx:**

- Delete `DEFAULT_OPERATIONS_CONFIG` and the `defaultName`/`defaultConfig` props; render
  `<DashboardCanvas mode="by-slug" dashboardSlug="operations" title="Operations Overview" />`.

**4. Unit specs (apps/api/src/modules/platform/user-dashboards.service.spec.ts):**

- list with existing system row → no writes.
- list with only a non-system operations row → that row is promoted (update called with
  `isSystem: true`), not a new create.
- list with no rows → create called with `isSystem: true` and the default operations config.
- P2002 on promote/create → re-reads and returns, does not throw.

**5. e2e (tests/e2e/pr-acceptance/batch1-dashboards.spec.ts):**

- On `/` (Home): the "Operations Overview" heading is visible AND the Delete button
  (`data-testid="delete-dashboard-button"`) is DISABLED (system dashboard).
- The sidebar Dashboards group does NOT contain a nav link named "Operations Overview" (Home is
  the only entry unless the user created custom dashboards).
- Wait for POSITIVE end states (visible heading, disabled button) — never for a spinner to vanish.

## Do NOT

- Do NOT rename the dashboard or its heading — `tests/e2e/pr-acceptance/helpers.ts`, batch1/batch7
  specs and `scripts/pipeline/visual-smoke.mjs` all assert the exact string "Operations Overview".
  Renaming to "Home" is a separate, deliberate PR if Marco wants it.
- Do NOT touch `apps/api/prisma/schema.prisma`, migrations, or seed files (`seed.ts`'s legacy
  `prisma.dashboard` "seed-admin-dashboard" block is a different, older model — leave it).
- Do NOT touch `ShellLayout.tsx` — its `!isSystem` filter already does the right thing once the
  row is system.
- Do NOT generalise the ensure to other slugs (tendering etc.) — "operations" only, this PR.
- Do NOT add any admin UI for system dashboards.

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "Could not create default dashboard." apps/web/src/dashboards/DashboardCanvas.tsx`
- `grep -q "ensureSystemDefault\|isSystem: true" apps/api/src/modules/platform/user-dashboards.service.ts`

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
