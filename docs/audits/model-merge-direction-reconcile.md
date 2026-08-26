# Model-merge direction reconcile — B-P0a (Job/Project) & B-P0b (Worker/WorkerProfile)

**Author:** Station 05 (SoT-Keeper)
**Date:** 2026-08-26
**Measured against:** `origin/main` at commit `019c757968d1b94ab94cd9d9e0e2156578aab221`
(sot/04-data-model.md sha256 as generated `49b774e989af`).

## What this audit records

`sot/04-data-model.md` §"Job / Project Consolidation — Survivor-Spine Design (B-P0a)"
was authored **Project-canonical** on 2026-07-02 (line 3712 in that snapshot:
`Project survives as the delivery spine. Job is folded into it and retired.`).

That direction was **re-decided in the opposite direction on 2026-07-14** and
has been re-confirmed twice since:

- `docs/pr-prompts/BACKLOG-DECISIONS.md` §1 (Marco, 2026-07-14):
  **"Job / Project merge (B-P0a) — `Job` IS CANONICAL. Merge `Project` into
  `Job`. Restart the workstream."**
- `docs/architecture/drafts/job-project-merge-slice-plan.md` (Marco,
  2026-07-16): the operational slice plan, Job-canonical throughout, owning
  the per-slice PR sequencing and the Phase-A unwind list (§4 there).
- Marco re-confirmed on 2026-08-20.

`sot/04` §B-P0a was the last document still pointing the wrong direction. This
PR reverses it so all three sources agree.

## What was changed in this PR

**File:** `sot/04-data-model.md`

1. **§B-P0a (whole section)** was re-authored from Project-canonical to
   Job-canonical. The load-bearing sentence at what was line 3712 —
   `Project survives as the delivery spine. Job is folded into it and retired.`
   — is now `Job is the surviving delivery entity. Project is folded into it
   and retired.`
2. **Direction-independent mechanics are preserved**, not rewritten:
   - Expand -> backfill -> switch reads -> switch writes -> contract shape.
   - **14-digit `YYYYMMDDHHMMSS_` migration timestamp rule** (R3).
   - **Multi-role regression guard** on `schedule_alloc_worker_uniq` (§5) —
     re-scoped from `projectId` to `jobId` in slice -7 but the 4-column arity
     and `jobRoleId` membership are unchanged.
   - **Risk register R1–R9** re-pointed; not dropped, not renumbered.
3. **Per-slice content reversed, slice numbers kept.** B-P0b cross-references
   B-P0a-7 and B-P0a-9 by number; those references remain valid. Every
   "add column to Project / backfill Project.x / drop jobs" now reads as its
   mirror image on Job, and slice -8 drops `projects` instead of `jobs`.
4. **Section pointer added** at the top of §B-P0a stating that
   `docs/architecture/drafts/job-project-merge-slice-plan.md` is the
   operational slice plan and this section is the data-model design behind
   it. The **Phase-A unwind list** (`Project.legacyJobId`,
   `Project.jobNumber` on Project, `Project.sourceJobId` +
   `ProjectSourceJob` relation, `Job.survivingProjectId` +
   `JobSurvivingProject` relation, and their indexes) is **not re-derived
   here** — §B-P0a defers to the slice plan §4 for the authoritative
   per-link disposition, which is folded into the -1 / -8 slices.
5. **§B-P0b (WorkerProfile-canonical)** is **not touched**. It was already
   correct. Its cross-references to `B-P0a-7` and `B-P0a-9` remain valid —
   only the *contents* of those slices reversed.

**Sweep — other references in `sot/04` that pointed the wrong way, all
reversed in this PR:**

- `Job/Project ownership` table row for `Job + children` — was `Deferred to
  B-P0a — folded into Project`; now `OK — the surviving spine ... collapses
  Project onto Job`.
- Same table row for `Project + children` — was `OK — the surviving spine`;
  now `Deferred to B-P0a — folded into Job`.
- Sidebar rewrite ("Jobs -> /projects (B-P0a: Project spine, 'Job' label)")
  — now `Jobs -> /jobs (B-P0a: Job spine, "Job" label; /projects
  308-redirects to /jobs after slice -8)`.
- 3.3 Rationale bullet "Jobs/Projects become one item — B-P0a section 1:
  Project survives" — now `Job survives, UX label stays "Job". Nav shows one
  item pointing at /jobs; /projects becomes a 308-redirect to /jobs in slice -8`.
- §5.3 `[SoT reconcile]` note — was `the LOCKED design and the committed
  schema use projectId (Project is the surviving spine — B-P0a)`; now records
  that the shipped keys still use `projectId` and are re-issued to `jobId`
  in **B-P0a slice -7**, with the multi-role guard preserved.

## What this audit does NOT change

- **`sot/02` is untouched.** It was already correct and out of scope.
- **No `schema.prisma`, migrations, or application code** are touched. This
  PR is `sot/` + this audit page only. CP-24 (`sot-purity`) enforces the
  purity at CI.
- **No downstream slice prompts are written.** They belong to
  `docs/architecture/drafts/job-project-merge-slice-plan.md` and to future
  per-slice PR prompts under `docs/pr-prompts/`.
- **The B-P0b §7 Q6 supersede notes** (freeze-with-banner -> 308-redirect
  `/resources` -> `/workers`) further down `sot/04` are unrelated and
  untouched.

## Backlog gate

Backlog item `model-merge-slices-rehomed` gates on this file existing at
`docs/audits/model-merge-direction-reconcile.md`. That gate is satisfied by
this PR.

## Provenance

- `[MEASURED]` `git rev-parse origin/main` = `019c757968d1b94ab94cd9d9e0e2156578aab221`.
- `[MEASURED]` `grep -q "survives as the delivery spine" sot/04-data-model.md`
  returns non-zero (string absent) on the branch tip of this PR.
- `[MEASURED]` `test -f docs/audits/model-merge-direction-reconcile.md`
  returns 0 on the branch tip of this PR (this file).
- `[INFERRED]` The three cited decision sources (BACKLOG-DECISIONS §1,
  the slice plan header, Marco's 2026-08-20 re-confirmation) collectively
  set the Job-canonical direction; §B-P0a and its sweep hits in `sot/04`
  were the only places still pointing the other way.
