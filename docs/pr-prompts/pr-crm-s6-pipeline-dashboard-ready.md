---
premise: '! test -f apps/api/src/modules/crm/pipeline/pipeline-dashboard.service.ts'
premise_means: The CRM pipeline + win/loss dashboard (read/aggregation over win/loss capture and Account roll-ups) does not exist on main.
requires_file_on_main: apps/api/src/modules/crm/accounts/accounts.service.ts
scope:
  - apps/api/src/modules/crm/pipeline/**
  - apps/web/src/pages/crm/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/pipeline/pipeline-dashboard.service.ts && test -f apps/api/src/modules/crm/pipeline/__tests__/pipeline-dashboard.service.spec.ts
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# CRM-6 (S6) - Pipeline + win/loss dashboard

PR title MUST start with `[CRM-PRIORITY]`. First line of the PR body MUST be:
`PRIORITY: CRM program (Marco 2026-08-12) - drive ahead of other open PRs.`

## What to build (see docs/plans/crm-module-plan.md)
- Read/aggregation ONLY - no schema change, no migration. Aggregate over the EXISTING win/loss
  capture (`model TenderOutcome` schema.prisma:1362 - resultType/reason/tenderValue/ourPrice/
  competitorOrWinner; `model Opportunity` schema.prisma:6429 - stage/won/lost) and the Account
  roll-ups from CRM-1 (`apps/api/src/modules/crm/accounts/accounts.service.ts`).
- Surface: pipeline by stage, win rate by client/sector/source/estimator, stalled-opportunity
  flags, relationship coverage.
- New module `apps/api/src/modules/crm/pipeline/`: `pipeline-dashboard.service.ts`,
  `pipeline-dashboard.controller.ts`, `pipeline-dashboard.module.ts`, plus
  `__tests__/pipeline-dashboard.service.spec.ts`.
- Dashboard page under `apps/web/src/pages/crm/`.

## Do NOT
- Do NOT change `apps/api/prisma/schema.prisma` - this slice is read/aggregation only.
- Do NOT copy or edit transactional facts - roll them up read-only.
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
- This slice is non-escalating: open the PR (the pipeline may merge it after green CI).
