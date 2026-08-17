---
premise: '! grep -q "model Account {" apps/api/prisma/schema.prisma'
premise_means: The CRM Account spine entity does not exist on main; no Account foundation or Client-360 view has landed.
requires_file_on_main: docs/plans/crm-module-plan.md
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/crm/accounts/**
  - apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts
  - apps/web/src/pages/crm/**
done_when: pnpm build && pnpm lint && grep -q "model Account {" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts
size: 10
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive only - new accounts table + nullable clientId FK. Safe to leave on main, re-run drops nothing. If the run dies mid-flight, drop the accounts table/migration or re-apply after code lands; no existing row is mutated (backfill is insert-only, idempotent on clientId).'
---

# CRM-1 (S1) - Account foundation + Client-360 view

PR title MUST start with `[CRM-PRIORITY]`. First line of the PR body MUST be:
`PRIORITY: CRM program (Marco 2026-08-12) - drive ahead of other open PRs.`

## What to build (see docs/plans/crm-module-plan.md)
- Add `model Account` to `apps/api/prisma/schema.prisma`: `id`, optional 1:1 `clientId` FK to
  `Client` (schema.prisma:673, `@unique`, `onDelete: SetNull`), `lifecycleStatus`
  (PROSPECT/ACTIVE/PAST), `accountType`, `source`, `ownerId`, timestamps, and the archive
  `archivedAt` field reusing the Contract.archivedAt pattern (schema.prisma:3898).
- Additive migration under `apps/api/prisma/migrations/**`. **Backfill one Account per existing
  Client** in the same migration (insert-only, idempotent on clientId).
- New module `apps/api/src/modules/crm/accounts/`: `accounts.service.ts`, `accounts.controller.ts`,
  `accounts.module.ts`, plus `__tests__/accounts.service.spec.ts`. The service aggregates the
  Account's contacts + **read-only roll-ups** of tenders/jobs/contracts (never edit them).
- Client-360 page under `apps/web/src/pages/crm/` (e.g. `AccountDetailPage.tsx`).
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
  `docs/data-model/relationship-map.json` + `relationship-map.md` + `metadata-catalog.json`.
- Declare `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body.
- Update any service `*.spec.ts` whose Prisma create/update payload you change.

## Do NOT
- Do NOT rebuild Client/Contact - Account WRAPS Client 1:1 via clientId FK.
- Do NOT do the Client->Account absorption migration (deferred).
- Do NOT copy transactional facts - tenders/jobs/contracts are read-only roll-ups.
- Do NOT edit `/sot/`. Do NOT exceed the scope above.

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
