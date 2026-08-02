---
premise: '! test -f docs/plans/model-merge-plan.md'
premise_means: The Job/Project + Worker/WorkerProfile model-merge plan does not exist on main yet.
scope:
  - docs/plans/model-merge-plan.md
done_when: pnpm lint && test -f docs/plans/model-merge-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan: the B-P0 model merges — Job<->Project first, then Worker<->WorkerProfile

Marco's ruling (2026-08-03): PRIORITISE the Job<->Project model merge (root cause of the
/projects orphan, the scheduler dual resourcing model, and the Site jobs/projects split);
Worker<->WorkerProfile sequences BEHIND it in the same program. Standing rule (sot + memory):
these merges run STRICTLY ONE AT A TIME.

## What to build (docs-only plan)

Author `docs/plans/model-merge-plan.md`:

1. Ground the current state: Job and Project schemas (incl. the in-flight merge pointers
   `Job.survivingProjectId` / `Project.sourceJobId` and both `sourceTenderId` uniques), every
   consumer of each (UI, API, scheduler Shift->Job vs ScheduleAllocation->Project, widgets,
   e2e), and the charter's specified end state (sot/01 SECTION on the Job/Project spine +
   sot/04). The existing `pr-nav-jobs-projects-merge-HOLD.md` prompt and its B-P0a gate are
   prior art — reconcile with them, don't duplicate.
2. Phase A slices: Job<->Project — data-reconciliation strategy (which survives, how existing
   rows pair/merge, append-only-safe migrations with rollback_strategy), API/UI cutover
   slices, scheduler unification (one resourcing model), nav + redirect map, e2e blast radius.
3. Phase B slices: Worker<->WorkerProfile — same treatment; explicitly gated on Phase A
   completion (`requires` the last Phase A slice).
4. PENDING-MARCO section for irreversible calls: which entity name survives user-facing,
   any data that cannot be merged losslessly, and the production-data migration window.
   Migrations here are near-certainly `escalates: true` at the code-slice level — say so.

## Do NOT
- Do NOT write code, schema, or sot/ edits. Plan only.
- Do NOT arm or modify pr-nav-jobs-projects-merge-HOLD — it stays HOLD until this plan's
  Phase A reaches its gate.

## VERIFY
- `pnpm lint`; file exists; both phases sliced; every consumer listed with file:line.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
