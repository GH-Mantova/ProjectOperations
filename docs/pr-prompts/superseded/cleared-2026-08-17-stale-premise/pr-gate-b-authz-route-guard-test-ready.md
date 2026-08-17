---
premise: ! test -f apps/web/src/components/__tests__/route-guards.authz.test.ts
premise_means: Gate B (docs/plans/pipeline-correctness-gates-plan.md SLICE 1, merged #937) is not built — no static test asserts every admin/super-rendering route in App.tsx is guarded or on a reviewed self-guard allowlist. This is the gap that let #922 (unguarded /settings/company route) pass green CI.
scope:
  - apps/web/src/components/__tests__/route-guards.authz.test.ts
done_when: pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test && test -f apps/web/src/components/__tests__/route-guards.authz.test.ts && grep -q "SELF_GUARDED_ROUTES" apps/web/src/components/__tests__/route-guards.authz.test.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# test(web): Gate B — authz route-guard consistency (pipeline-correctness-gates SLICE 1)

Implements Gate B of `docs/plans/pipeline-correctness-gates-plan.md` (merged #937). Closes the #922
class: an admin route that ships with NO route-level guard, invisible to CI (the old e2e only checked
the sidebar label, never direct-URL authz).

## What exists on main
- `apps/web/src/App.tsx` defines the `/settings/*` routes under `SettingsShell`. Administration routes
  are wrapped in `<AdminOnly>` (`/settings/administration/system|users|roles|permissions|audit|platform|
  job-roles`) and `/settings/data-model` in `<SuperUserOnly>`.
- `/settings/ai` is intentionally UNGUARDED at the route — it is mixed-audience (all authenticated users
  reach the personal "My Settings" tab; `canViewAiSettingsPage` / `canViewCompanyTab` grade it
  in-component). `/settings/company` was the #922 gap (guarded by a separate fix).
- Guard components live in `apps/web/src/components/SettingsShell.tsx`: `AdminOnly`, `SuperUserOnly`,
  `RequirePermissions`.
- No test asserts route-guard coverage.

## What to build
Create `apps/web/src/components/__tests__/route-guards.authz.test.ts` — a vitest, logic-only (no browser):
1. Read `App.tsx` source via `fs.readFileSync` (resolve the path relative to the test). Parse the
   `<Route .../>` entries and, for each, the element it renders.
2. Identify ADMIN/SUPER-rendering routes — enumerate by BOTH: (a) path under
   `/settings/administration`, `/settings/company`, `/settings/data-model`; AND (b) any route whose
   rendered page component name matches `/Admin|Platform|Users|Roles|Permissions|Audit|DataModel/`.
   Fold both into one deduplicated set of `{path, elementBlock}`.
3. Assert each such route is EITHER wrapped in `<AdminOnly>` / `<SuperUserOnly>` / `<RequirePermissions>`
   in its element block, OR its path is listed in a `SELF_GUARDED_ROUTES` allowlist constant defined at
   the top of the test. Seed the allowlist with `"/settings/ai"` and a comment naming its in-component
   guard (`canViewAiSettingsPage` / `canViewCompanyTab`).
4. FAIL CLOSED: any matched admin route that is neither wrapped nor allow-listed is a test failure whose
   message names the offending route path. Be tolerant of whitespace/newlines in the element block.

## Do NOT
- Do NOT modify `App.tsx` or any route/guard — this slice only ADDS a test.
- Do NOT guard `/settings/ai` (mixed-audience by design; that is what the allowlist is for).
- Do NOT touch the API, Prisma schema, or CI workflow files.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt; if genuinely impossible, say `NO-OP: <reason>` instead of stopping quietly.
- `pnpm --filter @project-ops/web lint` and `pnpm --filter @project-ops/web test` must both pass before opening the PR.
- Never ask for or wait on approval.
