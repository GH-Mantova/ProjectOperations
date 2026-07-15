---
premise: '! grep -q "defaultDashboardId" apps/api/prisma/schema.prisma'
premise_means: No per-user default-dashboard field exists on the User model yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seed*.ts
  - apps/api/src/**
done_when: pnpm build && pnpm lint && grep -q "defaultDashboardId" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: true
---

# Per-user default dashboard (backend + data)

Marco's decision (2026-07-15): the default-dashboard model is **per USER**, not per role and not
per module. Every user starts on ONE global default dashboard called **"Home"**; each user can then
change their own default to any dashboard they can see. There is NO RoleDefaultDashboard table.

## What to build

1. **Schema**: add `defaultDashboardId String?` to `model User` (schema.prisma, User starts ~line 19),
   as a nullable FK to `Dashboard` with `onDelete: SetNull`. Nullable = "user has not overridden the
   global default yet".
2. **Migration**: add the column. In the SAME migration, ensure a single global **"Home"** dashboard
   exists (create it if absent; make it the system/global default all users fall back to). Then
   **remove the two generic seed dashboards "Operations" and "Tendering"** — delete ONLY those two
   seeded generic dashboards (match by their seeded name/slug), never any user-created dashboard.
3. **Seed**: update the seed files that create the "Operations"/"Tendering" dashboards
   (seed-initial-services.ts, seed-reference.ts, seed.ts, seed-reference-run.ts) to seed "Home"
   instead. Do NOT re-introduce Operations/Tendering.
4. **Resolver + API** (locate the dashboards controller/service under apps/api/src): an endpoint for
   a user to set their OWN default (`PATCH /users/me/default-dashboard` or the module's convention),
   and a resolver that returns the user's `defaultDashboardId` if set, else the global "Home". Guard:
   a user may only set their own default, and only to a dashboard they can access.

## Do NOT

- Do NOT add any RoleDefaultDashboard / per-role / per-module mapping. That was the SUPERSEDED design.
- Do NOT delete any user-created dashboard. Only the two seeded generic ones.
- Do NOT build the frontend here (that is pr-user-default-dashboard-ui, staged separately).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: true` (it deletes existing dashboard rows in prod): build it, open the PR,
and LEAVE IT UNMERGED for Marco's review of the rendered diff.

## Guardrails

- One attempt. Never exit silently -- if the work is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval -- there is no human in this run.
- Read the CI job log before diagnosing any failure. `pnpm build` + `pnpm lint` must pass.
