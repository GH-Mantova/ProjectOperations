---
premise: '! test -f apps/api/src/modules/crm/lead-intake/lead-intake.service.ts'
premise_means: The CRM multi-source lead front door (capture + triage + lead-to-Account link) that extends leads-collapse does not exist on main.
requires_file_on_main:
  - apps/api/src/modules/crm/accounts/accounts.service.ts
  - docs/plans/crm-leads-collapse-plan.md
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/crm/lead-intake/**
  - apps/api/src/modules/crm/lead-intake/__tests__/lead-intake.service.spec.ts
  - apps/web/src/pages/crm/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/lead-intake/lead-intake.service.ts && test -f apps/api/src/modules/crm/lead-intake/__tests__/lead-intake.service.spec.ts
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive only - nullable accountId FK on Lead/Opportunity (schema.prisma:6390/6429) + capture-source columns. Safe to leave on main, re-run drops nothing. If the run dies mid-flight, drop the added columns/migration or re-apply after code lands; the leads-collapse rows are not destructively mutated.'
---

# CRM-3 (S3) - Lead front door (EXTENDS leads-collapse)

PR title MUST start with `[CRM-PRIORITY]`. First line of the PR body MUST be:
`PRIORITY: CRM program (Marco 2026-08-12) - drive ahead of other open PRs.`

## What to build (see docs/plans/crm-module-plan.md)
- EXTEND the existing leads-collapse (`docs/plans/crm-leads-collapse-plan.md`,
  `apps/api/src/modules/crm/crm.service.ts`). Do NOT rework it.
- Multi-source capture (email/phone/portal/referral): add capture-source fields to
  `Lead`/`Opportunity` (schema.prisma:6390/6429).
- Triage -> Tender Draft OR don't-pursue with a structured reason.
- lead<->Account link: add nullable `accountId` FK; on capture, **auto-create a PROSPECT
  Account** (reuse `apps/api/src/modules/crm/accounts/accounts.service.ts` from CRM-1).
- Additive migration under `apps/api/prisma/migrations/**`.
- New module `apps/api/src/modules/crm/lead-intake/`: `lead-intake.service.ts`,
  `lead-intake.controller.ts`, `lead-intake.module.ts`, plus
  `__tests__/lead-intake.service.spec.ts`.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated map.
- Declare `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body.
- Update any service `*.spec.ts` whose Prisma create/update payload you change.

## Do NOT
- Do NOT rework the leads-collapse models/triage list - EXTEND them.
- Do NOT copy transactional facts. Do NOT create a second identity record (Account wraps Client).
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
