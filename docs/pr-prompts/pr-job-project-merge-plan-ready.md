---
premise: '! test -f docs/architecture/drafts/job-project-merge-slice-plan.md'
premise_means: The Job-canonical merge slice plan has not been written yet.
scope:
  - docs/architecture/drafts/**
done_when: pnpm build && pnpm lint && test -f docs/architecture/drafts/job-project-merge-slice-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Job/Project merge (B-P0a) — SLICE 0: write the ordered slice plan (Job is canonical)

Marco confirmed (2026-07-16): **JOB is canonical. Everything relevant folds into Job. Project is
dropped last.** ⚠️ This REVERSES the shipped Phase-A direction: #500 built **Project** as the survivor
(`Project.legacyJobId` / `Project.jobNumber` / `Project.sourceJob`; `Job.survivingProjectId`; relation
`JobSurvivingProject`), and `sot/02` still says "survivor Project" — that is now WRONG and must be
reconciled by `05-sot-keeper`. Because this is a spine reversal on production data, SLICE 0 is a
**plan only** — no schema or code changes — so every later slice is a small, reviewable PR.

## Deliverable: `docs/architecture/drafts/job-project-merge-slice-plan.md`

Produce it with:
1. **Decision header** — Job canonical (Marco 2026-07-16); everything relevant folds into Job; Project
   dropped last. Note that `sot/02` "survivor Project" and BACKLOG-DECISIONS must end up consistent
   (Job) — flag the `sot/02` reconcile for `05-sot-keeper`.
2. **Full inventory** (grep, don't guess): every field + relation on `model Project`; everything that
   points AT Project (`git grep -nE "projectId|Project\\?|Project @relation|references:"`); every code
   consumer (services, controllers, web, scheduler/allocation).
3. **Fold map** — each relevant Project field/relation → where it lands on `Job` (add if missing,
   resolve name collisions), and which Project-only concerns are dropped.
4. **Unwind list** — the Phase-A links to reverse/re-point: `Project.sourceJobId/legacyJobId/jobNumber`,
   `Job.survivingProjectId`, relations `ProjectSourceJob` / `JobSurvivingProject`.
5. **Ordered slices** — each ≤10 files, independently shippable: additive → backfill → re-point FKs →
   drop Project LAST. For each: the data migration, the rollback, and "regen the data-model map in-PR".
   Mark which slices are `escalates` (prod-data/destructive).
6. **Risks** — prod data, `siteId`, scheduler/allocation consumers, FK cycles, order-of-operations.

## Do NOT
- Do NOT change `schema.prisma`, add a migration, or touch any application code in this PR. **Plan only.**
- Do NOT touch `sot/` (CP-24) — just flag the sot/02 reconcile in the plan for 05-sot-keeper.
- Do NOT start B-P0b (Worker/WorkerProfile) — it is a separate workstream and must NEVER run
  concurrently with this one (both regenerate the data-model map).

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
