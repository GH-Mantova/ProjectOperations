---
premise: 'test "$(grep -c "requiresPermission" apps/web/src/components/ShellLayout.tsx)" -lt 12'
premise_means: Most sidebar items still carry no permission gate while their APIs require view permissions — non-holders see a menu full of entries that 403.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
  - apps/web/src/auth/permissions.ts
done_when: pnpm build && pnpm lint && test "$(grep -c "requiresPermission" apps/web/src/components/ShellLayout.tsx)" -ge 20
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Gate every sidebar item on its API's view permission + fix the breadcrumb gaps

## The defect (system audit 2026-07-31, verified on origin/main)

16 of 24 sidebar items in `ShellLayout.tsx` NAV_GROUPS have NO `requiresPermission` while their
backing API requires a `*.view` permission: Tenders, Contracts, Directory(/master-data), Jobs,
Sites, Scheduler, Assets, Inventory, Maintenance, Procurement, Workers, Timesheet Approval,
Safety, Compliance, Forms, Documents. Non-holders see the full menu and every click 403s. Also:
the safety/compliance badge pollers fire for every user (silent 403 every 5 min), and 8 live
routes have no BREADCRUMBS key (topbar shows "Workspace"), while 15 of 51 keys point at
redirect-only routes.

## ⚠️ STEP 0 — the super-user blind spot (do this FIRST or you lock Marco out)

Known lesson: `user.permissions` is NEVER expanded for super-users. Read
`apps/web/src/auth/permissions.ts` and PROVE (with the file open, cite lines in the PR body) that
`can(user, code)` returns true when `user.isSuperUser === true`. If it does not, fix `can()` to
short-circuit on `isSuperUser` in this PR — otherwise every gate you add hides the entire
sidebar from super-users. This check is non-negotiable.

## What to build

1. **Per-item gates:** for each ungated item, open the page's PRIMARY API controller and mirror
   the exact permission it requires (do not guess from the label — e.g. Contracts' API gates on
   `finance.view`; Sites' list API may gate on `masterdata.view` rather than `sites.view` —
   VERIFY per controller and mirror reality, noting surprises in the PR body). Timesheet
   Approval mirrors Payroll Export (`field.manage` — the page already renders NoAccess on it).
2. **Badge hygiene:** `SidebarSafetyBadge` / `SidebarComplianceBadge` skip their polling entirely
   when the user lacks the respective view permission.
3. **Breadcrumbs:** add keys for `/sites`, `/safety`, `/compliance`, `/dockets`, `/archive`,
   `/surveys/capture`, `/surveys/satisfaction`, `/admin/automations`, `/admin/ai-settings`.
   Remove keys whose routes are pure redirects that never render (the `/admin/*`, `/account*`,
   `/notifications`, `/dashboards`, `/crm`, `/tenders/contacts` stale set) — EXCEPT any key that
   still resolves for a real rendered path by prefix.
4. **Nav test:** update `ShellLayout.nav.test.ts` to assert the new gates (item → permission
   map), and RUN it (`npx vitest run` on the file) — CI does not reliably execute it.

## Do NOT

- Do NOT change any route, page, or API permission — nav mirror only.
- Do NOT touch the mobile tab-bar logic or the Dashboards group (separate decisions).
- Do NOT gate items whose API is genuinely open.
- Do NOT touch the Settings group's adminOnly gate (its rework is the settings-restructure plan).

## VERIFY

- `pnpm build && pnpm lint`
- `test "$(grep -c "requiresPermission" apps/web/src/components/ShellLayout.tsx)" -ge 20`
- `npx vitest run apps/web/src/components/__tests__/ShellLayout.nav.test.ts` passes.
- PR body cites the `can()`/isSuperUser proof (STEP 0).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
