---
premise: '! grep -q "model BusinessProcessFlow" apps/api/prisma/schema.prisma'
premise_means: There is no business-process-flow stage-bar engine.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/platform/**
  - apps/web/src/components/**
  - apps/web/src/pages/tendering/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model BusinessProcessFlow" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 BPF stage bar) | MVP: engine + apply to Tender -->
# HOLD — UX: Business Process Flow "stage bar" (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 model-driven-app parity: a step-by-step **stage bar**
pinned to the top of a record that guides staff through a lifecycle and enforces required fields per
stage. MVP = the reusable engine + apply it to ONE entity (Tender). More entities follow later.

## What to build
Branch: `feat/ux-business-process-flow`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `BusinessProcessFlow` (definition: entity/name/active) + `BusinessProcessStage`
   (ordered stages, name, required-field keys JSON) + `BusinessProcessInstance` (per-record: current
   stage, stage history). Config-driven, not hardcoded.
2. API in `platform` (or a new `process` service): read a definition, read/advance an instance
   (validate required fields before advancing), guarded by the record's own permission.
3. Web — a reusable `<ProcessStageBar>` component (horizontal stage chevrons, current highlighted,
   click a stage to see its required fields; advance action). Render it at the top of the **Tender**
   detail; seed a Tender BPF definition (Lead → Qualify → Estimate → Submit → Won/Lost).

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT hardcode stages in code — they are config/seed data. Do NOT apply to every entity in the MVP
  (Tender only). Do NOT touch Azure/prod. If >10 files, split (engine / tender-apply) and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
