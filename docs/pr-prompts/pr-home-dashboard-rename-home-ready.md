---
premise: grep -q "Operations Overview" tests/e2e/pr-acceptance/helpers.ts
premise_means: The e2e login helper still asserts the old "Operations Overview" heading, so the Home rename has not shipped.
scope:
  - apps/api/src/modules/platform/user-dashboards.service.ts
  - apps/api/src/modules/platform/user-dashboards.service.spec.ts
  - apps/web/src/pages/DashboardPlaceholderPage.tsx
  - tests/e2e/pr-acceptance/helpers.ts
  - tests/e2e/pr-acceptance/batch1-auth-shell.spec.ts
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
  - tests/e2e/pr-acceptance/batch7-field.spec.ts
  - scripts/pipeline/visual-smoke.mjs
done_when: pnpm build && pnpm lint && ! grep -q "Operations Overview" tests/e2e/pr-acceptance/helpers.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Rename the Home dashboard heading "Operations Overview" -> "Home"

**HOLD — ARM ONLY after the `pr-home-dashboard-system-default` PR is MERGED to main.**
Verification before arming: `grep -q "ensureSystemDefault" apps/api/src/modules/platform/user-dashboards.service.ts`
must succeed on origin/main. This prompt edits the server-side ensure logic that PR introduces;
armed early it will fail or half-apply.

## Context

After the system-default PR, Home (`/`) renders the per-user SYSTEM dashboard whose name comes from
the DB row (default "Operations Overview"). The sidebar entry says "Home"; the page heading says
"Operations Overview". Marco wants them aligned: the heading should say **Home**.

## What to build

1. **apps/api/src/modules/platform/user-dashboards.service.ts** — in the operations-slug ensure
   logic: change the default CREATE name to `"Home"`, and lazily migrate existing rows: when the
   ensured system row's name is exactly `"Operations Overview"` (the old default), update it to
   `"Home"`. Do NOT touch rows an admin renamed to anything else.
2. **apps/api/src/modules/platform/user-dashboards.service.spec.ts** — update/add specs: create
   uses "Home"; a system row named "Operations Overview" is renamed to "Home"; a system row with a
   custom name is left alone.
3. **apps/web/src/pages/DashboardPlaceholderPage.tsx** — `title="Home"` (fallback heading only).
4. **Test assertions** — replace the exact heading assertion `"Operations Overview"` with `"Home"`
   in: `tests/e2e/pr-acceptance/helpers.ts` (both occurrences), `batch1-auth-shell.spec.ts`,
   `batch1-dashboards.spec.ts`, `batch7-field.spec.ts`, and `scripts/pipeline/visual-smoke.mjs`.
   Grep the whole of `tests/e2e/pr-acceptance/**` for any other heading assertion of that string
   you may have missed and update it in the SAME PR (LL from pr-fix-page-title-nav-alignment:
   title changes and their e2e assertions must land together or tendering-e2e goes red).

## Do NOT

- Do NOT rename anything else (test *titles*/describe strings mentioning "operations dashboard"
  are fine to leave; only the asserted heading string changes).
- Do NOT touch schema, migrations, seeds, ShellLayout, or the slug ("operations" stays the slug).
- Do NOT add a data migration — the lazy rename in ensure covers existing rows.

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "Operations Overview" tests/e2e/pr-acceptance/helpers.ts`
- `grep -q "\"Home\"" apps/web/src/pages/DashboardPlaceholderPage.tsx`

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
