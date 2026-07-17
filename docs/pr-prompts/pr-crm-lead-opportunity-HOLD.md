---
premise: '! grep -q "model Opportunity" apps/api/prisma/schema.prisma'
premise_means: There is no distinct lead/opportunity CRM object (the tender kanban is the only pipeline).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/crm/**
  - apps/web/src/pages/crm/**
  - apps/web/src/App.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model Opportunity" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | D365-parity Tier 4 (Sales CRM) | OPTIONAL — arm on Marco's go -->
# HOLD — CRM: lead → opportunity layer (Tier 4, optional)

STATUS: DRAFTED, STAGED, **OPTIONAL / DO NOT ARM without Marco's go.** Tier 4. Today the tender
kanban + rich `Client` model is the de-facto pipeline; this adds a distinct pre-tender Lead →
Opportunity object for early-stage sales that aren't yet formal tenders. Only build if the sales
motion warrants it — Marco decides.

## What to build (when armed)
Branch: `feat/crm-lead-opportunity`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. `Lead` and `Opportunity` models linked to `Client`/`Contact`: stage (new→qualified→quoting→won/
   lost), estimated value, probability, source, owner, next-action/follow-up, and a **convert-to-Tender**
   action (an opportunity becomes a Tender when it firms up — no data re-keying).
2. A light **forecast** view (weighted pipeline by stage/probability) — reuse the dashboard widget
   patterns, do not build a new charting system.
3. API `crm` module (guarded `crm.view`/`.manage`); web CRM board + opportunity detail.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT duplicate or replace Tendering — Opportunity sits BEFORE a Tender and converts into one.
  Do NOT build marketing/campaigns (out of scope). Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
