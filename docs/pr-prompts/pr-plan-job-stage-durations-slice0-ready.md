---
premise: '! test -f docs/plans/job-stage-durations-plan.md'
premise_means: No plan exists yet for editable job/stage durations feeding the scheduler; today JobStage has start/end dates but no editable duration surface, Job has neither, and the scheduler cannot allocate resources off a duration.
scope:
  - docs/plans/**
done_when: pnpm build && pnpm lint && test -f docs/plans/job-stage-durations-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan: editable job & stage durations that drive scheduler resource allocation

Author `docs/plans/job-stage-durations-plan.md` (house style of docs/plans/settings-restructure-plan.md).
This slice is the PLAN ONLY — it is schema/scheduler-touching, so nothing irreversible here.

Marco's need: each Job needs a duration and/or per-stage durations, and right now he cannot enter,
edit, or delete any of it. The duration must let him allocate resources on the scheduler.

## Ground first (cite file:line)
- Schema: `model Job` (~1351), `model JobStage` (~1416: has `startDate`/`endDate`, `stageOrder`, no
  duration), `model JobActivity`, and the scheduler models `Shift` (~1587), `ShiftWorkerAssignment`,
  `ShiftAssetAssignment`, `ScheduleAllocation` (~2832) — how does the scheduler currently decide the
  window/resources for a job?
- UI: the Job detail "Stages & Activities" tab (JobDetailPage / stages component) and the Scheduler
  pages. Establish exactly what is/ isn't editable today.
- sot/01 Job spine + sot/04 (Job↔Project); note the in-flight Job↔Project model merge
  (`docs/plans/model-merge-plan.md` if present / `pr-nav-jobs-projects-merge-HOLD`) — durations must
  not conflict with that program; sequence around it.

## The plan must decide/cover
1. **Model:** derive duration from `startDate`/`endDate`, or store an explicit `durationDays` (append
   an additive nullable column — respect sot/01 append-only movement rule; regen the data-model map).
   Justify the choice. Cover Job-level duration vs per-stage durations and how they roll up.
2. **CRUD:** enter/edit/delete for job + stage durations (API + UI in the Stages & Activities tab),
   with validation (non-negative, stage sum vs job window).
3. **Scheduler wiring:** how a duration becomes resource allocation on the scheduler (Shift /
   ScheduleAllocation) — the actual value Marco is after.
4. **Ordered slices** (each ≤ ~10 files, `requires_merged` edges, rollback notes; any migration slice
   carries `gate_allow: migrations` + `rollback_strategy`), and a risks section (scheduler double-count,
   Job↔Project merge collision).

## Do NOT
- Do NOT write schema/API/UI code in this slice — plan document only (`scope` is `docs/plans/**`).
- Do NOT edit `/sot/` — decisions land via a doc-reconcile slice.
- Do NOT duplicate or fight the Job↔Project model-merge plan — reconcile with it.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f docs/plans/job-stage-durations-plan.md`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
