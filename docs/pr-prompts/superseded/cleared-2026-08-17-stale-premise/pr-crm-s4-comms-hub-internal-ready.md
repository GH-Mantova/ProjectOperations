---
premise: '! test -f apps/api/src/modules/crm/comms/comms.service.ts'
premise_means: The CRM comms hub internal threads + To-Do decoupled sub-module does not exist on main.
requires_file_on_main: apps/api/src/modules/crm/accounts/accounts.service.ts
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/crm/comms/**
  - apps/api/src/modules/crm/comms/__tests__/comms.service.spec.ts
  - apps/web/src/pages/crm/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/comms/comms.service.ts && test -f apps/api/src/modules/crm/comms/__tests__/comms.service.spec.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive only - new comm_threads / comm_messages / comm_tasks tables with a polymorphic link. Safe to leave on main, re-run drops nothing. If the run dies mid-flight, drop the new tables/migration or re-apply after code lands; no existing data is mutated.'
---

# CRM-4 (S4) - Comms hub: internal threads + To-Do (decoupled sub-module)

PR title MUST start with `[CRM-PRIORITY]`. First line of the PR body MUST be:
`PRIORITY: CRM program (Marco 2026-08-12) - drive ahead of other open PRs.`

## What to build (see docs/plans/crm-module-plan.md)
- Add `model CommThread`, `model CommMessage`, `model CommTask` to
  `apps/api/prisma/schema.prisma` with a **polymorphic link** (entityType/entityId) to
  Account/Tender/Job/Contract. Support @mention, assignment, and due date on tasks.
- Ship WITHOUT Azure - internal threads + To-Do only. Keep it a **self-contained sub-module**
  (own models + service boundary) so it can branch into its own product later.
- Additive migration under `apps/api/prisma/migrations/**`.
- New module `apps/api/src/modules/crm/comms/`: `comms.service.ts`, `comms.controller.ts`,
  `comms.module.ts`, plus `__tests__/comms.service.spec.ts`.
- Comms surface under `apps/web/src/pages/crm/`.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated map.
- Declare `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body.
- Update any service `*.spec.ts` whose Prisma create/update payload you change.

## Do NOT
- Do NOT touch Azure/Entra/SharePoint config - email is CRM-5, this ships without it.
- Do NOT couple comms into the CRM core - keep it a decoupled sub-module.
- Do NOT copy transactional facts. Do NOT edit `/sot/`. Do NOT exceed the scope above.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Never exit silently - if this is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for a go/no-go. The go was given when this prompt was armed.
- Read the CI job log before diagnosing a failure. `pnpm build` and `pnpm lint` must pass.
- This slice `escalates: true` (schema/migration): open the PR and LEAVE IT UNMERGED for Marco.
