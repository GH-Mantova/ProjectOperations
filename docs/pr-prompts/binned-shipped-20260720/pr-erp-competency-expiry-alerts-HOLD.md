---
premise: '! grep -rqi "expiryDigest\|expiringCompetenc\|competencyExpiryAlert\|expiring-tickets" apps/api/src'
premise_means: Ticket/licence expiry data and scheduling-gate exist, but nothing proactively alerts before a competency expires.
scope:
  - apps/api/src/modules/compliance/**
  - apps/api/src/modules/workers/**
  - apps/api/src/modules/email/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "expiryDigest\|expiringCompetenc\|competencyExpiryAlert" apps/api/src
size: 9
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap D/WHS | proactive competency-expiry alerting -->
# ERP gap — proactive ticket/licence expiry alerting + register

STATUS: DRAFTED, STAGED, arm-eligible. NOTE (forensic): `WorkerCompetency.expiresAt` + `JobRoleRequirement`
+ competency-gated scheduling ALREADY exist. The gap is PROACTIVE alerting — nothing warns before a ticket
lapses. Safety-critical: an expired asbestos/demolition-supervisor ticket must nag well ahead of expiry.

## What to build
Branch: `feat/erp-competency-expiry-alerts`. Reviewer: `GH-Mantova`. No migration expected.
1. API in `compliance`/`workers` — an "expiring competencies" query (configurable horizon, e.g. 30/60/90
   days) over `WorkerCompetency.expiresAt`; a scheduled digest that emails the WHS officer / managers a list
   of expiring + expired tickets; per-worker flags. Reuse the existing `email` module. Make the horizon a
   configurable setting (not hardcoded — route through the authorization/config seam).
2. Web — an "Expiring credentials" register/dashboard widget (filter by worker/competency/horizon) with
   overdue highlighting.

## Do NOT
- Do NOT rebuild the competency register or the scheduling gate (they exist). Do NOT hardcode the alert
  horizon or recipients. Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
