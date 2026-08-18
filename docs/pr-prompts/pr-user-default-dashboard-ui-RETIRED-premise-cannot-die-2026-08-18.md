---
premise: '! grep -rq "defaultDashboardId" apps/web/src'
premise_means: The web app does not reference the new per-user defaultDashboardId field yet.
scope:
  - apps/web/src/pages/dashboards/**
  - apps/web/src/pages/settings/**
  - apps/web/src/pages/dashboards/__tests__/**
done_when: pnpm build && pnpm lint && grep -rq "defaultDashboardId" apps/web/src/pages/dashboards
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# Per-user default dashboard (frontend)

GATED: stage-only. Do NOT arm until `pr-user-default-dashboard` (backend) is merged -- this needs the
`User.defaultDashboardId` field and the resolver/set endpoint to exist on main first. If armed early
the premise/build will fail. The lint premise above only checks the web side; a human must confirm
the backend shipped before arming.

## What to build

1. A control in the user's own settings (My Account / profile area) to **set their default dashboard**
   to any dashboard they can access, calling the backend endpoint from `pr-user-default-dashboard`.
2. **Landing logic**: on login / dashboard entry, route the user to their `defaultDashboardId` if set,
   otherwise the global "Home" dashboard (via the resolver). Graceful fallback if the saved default
   was deleted (resolver returns Home).

## Do NOT

- Do NOT add any admin/role/module mapping UI. Per-user only.
- Do NOT change backend schema or endpoints -- consume what `pr-user-default-dashboard` shipped.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. Never exit silently -- if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.

## Backend dependency - CLEARED 2026-08-17

The earlier `GATED: stage-only` note in this prompt is DISCHARGED. `defaultDashboardId` is on
main in `apps/api/prisma/schema.prisma` and is read in `apps/api/src/modules/users/users.service.ts`.
That gate lived only in prose, which is why this prompt sat armed while it was still blocked - the
fix is the strengthened `done_when` above, which now fails unless the web side actually references
the field.

Scope was narrowed from `apps/web/src/**` (the entire frontend) on 2026-08-17. If the work needs a
file outside the three scoped globs, NO-OP and say which file - do not widen the scope yourself.
