---
premise: '! test -f docs/architecture/drafts/worker-workerprofile-merge-slice-plan.md'
premise_means: The Worker/WorkerProfile (WorkerProfile-canonical) merge slice plan has not been written yet.
scope:
  - docs/architecture/drafts/**
done_when: pnpm build && pnpm lint && test -f docs/architecture/drafts/worker-workerprofile-merge-slice-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Worker/WorkerProfile merge (B-P0b) - SLICE 0: write the ordered slice plan (WorkerProfile is canonical)

Marco confirmed (2026-07-17): **RESTART B-P0b. WorkerProfile is canonical. Everything relevant folds
into WorkerProfile. Worker is dropped last.** Because this is a spine change on production data,
SLICE 0 is a **plan only** - no schema or code - so every later slice is a small, reviewable PR.

## HARD SEQUENCING (read this first)

The **code slices** of this workstream MUST NOT run concurrently with **B-P0a (Job/Project merge)**.
Both regenerate the data-model map, and two concurrent spine reworks corrupt it. This SLICE-0 plan
doc is safe to write now (it is a doc, it does not touch the schema or the map), but the plan itself
MUST state, at the top, that Track-code slice 1 is not to be armed until B-P0a has fully merged.

## Deliverable: `docs/architecture/drafts/worker-workerprofile-merge-slice-plan.md`

Produce it with:
1. **Decision header** - WorkerProfile canonical (Marco 2026-07-17); everything relevant folds into
   WorkerProfile; Worker dropped last. State the B-P0a sequencing lock (above).
2. **Full inventory** (grep, don't guess): every field + relation on `model Worker` and
   `model WorkerProfile`; everything that points AT either
   (`git grep -nE "workerId|workerProfileId|Worker \@relation|WorkerProfile \@relation|references:"`);
   every code consumer (services, controllers, web, scheduler/allocation).
3. **Fold map** - each relevant Worker field/relation -> where it lands on `WorkerProfile` (add if
   missing, resolve name collisions), and which Worker-only concerns are dropped.
4. **Ordered slices** - each <=10 files, independently shippable: additive -> backfill -> re-point FKs
   -> drop Worker LAST. For each: the data migration, the rollback, and "regen the data-model map
   in-PR" (`node scripts/data-model/build-relationship-map.mjs`, commit `docs/data-model/**`,
   declare `GATE-ALLOW: migrations`). Mark which slices are `escalates` (prod-data/destructive).
5. **Risks** - prod data, scheduler/allocation consumers, FK cycles, order-of-operations, and the
   `sot/` reconcile (flag for 05-sot-keeper; do not edit sot here).

## Do NOT
- Do NOT change `schema.prisma`, add a migration, or touch any application code in this PR. **Plan only.**
- Do NOT touch `sot/` (CP-24) - just flag the sot reconcile in the plan for 05-sot-keeper.
- Do NOT start any B-P0b code slice, and do NOT run while B-P0a code slices are in flight.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- if the plan doc already exists, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
