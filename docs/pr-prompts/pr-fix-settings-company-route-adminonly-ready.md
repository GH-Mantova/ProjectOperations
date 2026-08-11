---
premise: grep -qF 'path="company" element={<AdminCompanyPage />}' apps/web/src/App.tsx
premise_means: The /settings/company route (apps/web/src/App.tsx) renders <AdminCompanyPage /> with NO route-level guard, unlike every sibling Administration route (wrapped in <AdminOnly>) and /settings/data-model (<SuperUserOnly>). Access is enforced only inside the page component today; the route layer does not enforce it.
scope:
  - apps/web/src/App.tsx
done_when: pnpm --filter @project-ops/web build && pnpm --filter @project-ops/web lint && ! grep -qF 'path="company" element={<AdminCompanyPage />}' apps/web/src/App.tsx && grep -qzP '<AdminOnly>\s*<AdminCompanyPage' apps/web/src/App.tsx
size: 2
seed_only: false
escalates: false
rollback_strategy: Revert the single App.tsx hunk (unwrap <AdminCompanyPage /> back to the bare <Route path="company" ... /> one-liner). Pure additive route guard; no schema, data, or API change.
---

# fix(web): guard /settings/company route with <AdminOnly> (defence-in-depth)

## What exists on main

- `apps/web/src/App.tsx` defines the `/settings/*` routes under `SettingsShell`. Every Administration
  route is wrapped in `<AdminOnly>` (`administration/system|users|roles|permissions|audit|platform|
  job-roles`) and `/settings/data-model` in `<SuperUserOnly>`.
- `<Route path="company" element={<AdminCompanyPage />} />` is NOT wrapped.
- `AdminCompanyPage` is admin-only: it already renders `<NoAccess required="role:Admin" />` in-component
  for non-admins and its APIs reject non-admins server-side, so there is no live data exposure. But it
  is the only admin page whose route does not also enforce — a defence-in-depth gap. A later refactor
  that drops the in-component check (assuming the route guards it, like its siblings) would silently
  open it.
- `AdminOnly` is ALREADY imported in App.tsx (`import { SettingsShell, AdminOnly, SuperUserOnly } from
  "./components/SettingsShell";`) — no new import needed.

## What to build

Wrap ONLY the `/settings/company` route element in `<AdminOnly>`, matching the sibling pattern:

    <Route
      path="company"
      element={
        <AdminOnly>
          <AdminCompanyPage />
        </AdminOnly>
      }
    />

That is the entire change — one route element.

## Do NOT

- Do NOT touch `/settings/ai` — it is mixed-audience BY DESIGN (all authenticated users reach the
  personal "My Settings" tab; the page grades its own content via canViewAiSettingsPage /
  canViewCompanyTab). Guarding it with <AdminOnly> would break valid access.
- Do NOT change `AdminCompanyPage`, `AdminOnly`, or any other route.
- Do NOT add an import (AdminOnly is already imported).
- Do NOT touch the server/API, Prisma schema, or any migration.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run. Finishing the work and then asking for permission is indistinguishable
> from failing — the work is discarded either way.

## Guardrails

- One attempt; if genuinely impossible, say `NO-OP: <reason>` instead of stopping quietly.
- `pnpm --filter @project-ops/web build` and `pnpm --filter @project-ops/web lint` must both pass
  before opening the PR.
- Never ask for or wait on approval.
