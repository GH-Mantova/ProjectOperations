---
premise: '! grep -q "model BillingMilestone" apps/api/prisma/schema.prisma'
premise_means: Contracts have progress claims but no milestone billing / pro-forma / revenue-recognition rigor.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/contracts/**
  - apps/web/src/pages/contracts/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model BillingMilestone" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | D365-parity Tier 3 (Project Ops billing) | ENHANCE contracts -->
# HOLD — Billing rigor: milestones + pro-forma + revenue recognition

STATUS: DRAFTED, STAGED, arm-eligible. Tier 3. Enhances the existing Contracts module
(`Contract`, `Variation`, `ProgressClaim`, `ClaimLineItem`, retention) toward D365 Project Operations
billing rigor. Keep it construction-shaped (AU progress claims stay the spine).

## What to build
Branch: `feat/billing-rigor`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. `BillingMilestone` model on a Contract: named milestones with a trigger (date / % complete / event),
   amount or % of contract, and status (pending / due / claimed) — a claim can be raised from a due
   milestone (alongside the existing progress-claim flow, not replacing it).
2. **Pro-forma / draft claim**: generate a draft (pro-forma) claim for review before it's issued.
3. Basic **revenue recognition** view: recognised-to-date vs billed-to-date vs contract value per
   contract (no GL posting — that's Xero's job; this is the operational view + the number the Xero push
   uses).
4. Web: milestones tab on the contract, pro-forma preview, a rev-rec summary.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT post to a general ledger (Xero owns the ledger). Do NOT remove/replace the existing
  progress-claim flow. Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
