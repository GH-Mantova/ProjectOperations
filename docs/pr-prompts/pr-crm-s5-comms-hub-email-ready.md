---
premise: '! test -f apps/api/src/modules/crm/comms/email-log.service.ts'
premise_means: Outlook email auto-logging against Account/Tender via the existing M365/Graph seam does not exist on main.
requires_file_on_main: apps/api/src/modules/crm/comms/comms.service.ts
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/crm/comms/**
  - apps/api/src/modules/crm/comms/__tests__/email-log.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/comms/email-log.service.ts && test -f apps/api/src/modules/crm/comms/__tests__/email-log.service.spec.ts
size: 7
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive only - new email_log link table joining a captured email to Account/Tender. Safe to leave on main, re-run drops nothing. If the run dies mid-flight, drop the new table/migration or re-apply after code lands; no existing data is mutated and no Azure/Entra config is touched.'
---

# CRM-5 (S5) - Comms hub: email integration

PR title MUST start with `[CRM-PRIORITY]`. First line of the PR body MUST be:
`PRIORITY: CRM program (Marco 2026-08-12) - drive ahead of other open PRs.`

WARNING: This slice depends on Marco's Azure/Entra/M365 provisioning - the one hard-stop.
Build it, open the PR, and LEAVE IT UNMERGED for Marco. Do the code; the merge waits on Marco.

## What to build (see docs/plans/crm-module-plan.md)
- Auto-log Outlook email against Account/Tender using ONLY the EXISTING M365 / Microsoft Graph
  seam: `apps/api/src/modules/email/**` (email.service.ts, email-provider.interface.ts,
  email.module.ts). Consume that seam; do NOT re-implement it.
- Add `model EmailLog` (link a captured email to Account/Tender, direction, subject, sentAt,
  graph message id) to `apps/api/prisma/schema.prisma`. Additive migration.
- New service in the comms sub-module: `apps/api/src/modules/crm/comms/email-log.service.ts`
  plus `__tests__/email-log.service.spec.ts`. Keep it inside the decoupled comms boundary
  built in CRM-4 (`comms.service.ts`).
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated map.
- Declare `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body.
- Update any service `*.spec.ts` whose Prisma create/update payload you change.

## Do NOT
- Do NOT create or modify any Azure / Entra / SharePoint config - reuse the existing Graph seam only.
- Do NOT re-implement the email provider. Do NOT copy transactional facts.
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
- This slice `escalates: true` (email/Graph + schema): open the PR and LEAVE IT UNMERGED for Marco.
