---
premise: 'grep -q "survives as the delivery spine" sot/04-data-model.md'
premise_means: sot/04 section B-P0a still declares Project the surviving spine, which contradicts the Job-canonical decision recorded in BACKLOG-DECISIONS.md and in the shipped SLICE-0 slice plan. Any slice prompt written from sot/04 today would build the direction Marco cancelled.
scope:
  - sot/04-data-model.md
  - docs/audits/model-merge-direction-reconcile.md
done_when: pnpm lint && ! grep -q "survives as the delivery spine" sot/04-data-model.md && test -f docs/audits/model-merge-direction-reconcile.md
size: 2
gate_allow: none
seed_only: false
escalates: true
---

# Doc-reconcile: sot/04 section B-P0a is authored in the CANCELLED direction

Branch: `docs/sot-04-bp0a-job-canonical`. New PR. **STATION 05 (SoT-KEEPER) WORK.**

## Standing rule

A doc-reconcile PR touches **only** `sot/` and `docs/`. Nothing else. No code, no scripts, no
workflows, no package manifests. CP-24 (`sot-purity`) enforces this at the CI layer.

**This PR touches exactly two files: `sot/04-data-model.md` and a new marker doc.**

## Why this PR exists

The Job/Project merge (B-P0a) has **two plans of record pointing in opposite directions**, and that
contradiction is why twelve unbuilt slices have sat untouched since July.

| Source | Direction | Date |
|---|---|---|
| `sot/04-data-model.md` section B-P0a (line 3699+) | **Project survives, Job folds in** | authored 2026-07-02 |
| `docs/pr-prompts/BACKLOG-DECISIONS.md` section 1 | **Job IS CANONICAL** | Marco 2026-07-14 |
| `docs/architecture/drafts/job-project-merge-slice-plan.md` section 1 | **Job is canonical** | Marco 2026-07-16 |

**Marco re-confirmed on 2026-08-20: JOB IS CANONICAL.** The later decision stands. `sot/04` is the
stale one and is what must change.

This is not a new discovery. The shipped SLICE-0 plan **already filed this exact action item**:

> **05-sot-keeper action item:** open a `doc-reconcile` PR that fixes `sot/02` line 100 and
> re-authors `sot/04` section 3004+. Do NOT touch `sot/` from this workstream — CP-24 forbids it.

It was never picked up. Note that the `sot/02` half is **already done** — `sot/02` no longer says
"survivor Project" anywhere; its three remaining B-P0a references are direction-neutral. Do **not**
touch `sot/02`. Only `sot/04` is still wrong.

## The target section

`sot/04-data-model.md` lines **3699 – 3958** — `## Job / Project Consolidation — Survivor-Spine
Design (B-P0a)`, ending where `## Worker / WorkerProfile Consolidation — Survivor-Spine Design
(B-P0b)` begins at 3959.

**Re-grep these line numbers before editing.** They were measured at `origin/main` 16402f22 and this
file has drifted badly before: the SLICE-0 plan cites this same section as "3004–3239", and a
2026-08-20 handover cited it as "3155–3413". Both are stale. Anchor on the heading text, never the
number.

The single load-bearing line is **3712**:

```
**`Project` survives as the delivery spine. `Job` is folded into it and retired.**
```

## What to do

1. **Re-author the section Job-canonical.** `Job` survives as the delivery spine; `Project` folds
   into it and is dropped last. Reverse the direction of the per-slice table (currently 3907–3915,
   B-P0a-1 … -9): every "add column to `Project` / backfill `Project.x` / drop `jobs`" becomes its
   mirror image on `Job`, and the final contract slice drops `projects`.
2. **Keep the mechanics.** The expand → backfill → switch → contract shape, the 14-digit migration
   timestamp rule, the multi-role regression guard, and the risk register (R1–R9) are all still
   correct and direction-independent. Re-point them; do not rewrite them from scratch and do not
   drop the risk register.
3. **Unwind list.** The section must name the Phase-A links that now point the wrong way and must be
   reversed — `Project.legacyJobId`, `Project.jobNumber`, `Project.sourceJobId`, the
   `ProjectSourceJob` relation, `Job.survivingProjectId`, and the `JobSurvivingProject` relation.
   `docs/architecture/drafts/job-project-merge-slice-plan.md` section 4 already enumerates these —
   defer to it rather than re-deriving.

4. **Add a pointer, not a duplicate.** State plainly at the top of the section that
   `docs/architecture/drafts/job-project-merge-slice-plan.md` is the operational slice plan and that
   this section is the data-model design behind it. Two plans of record is what caused this bug;
   do not create a third.
5. **Sweep the rest of `sot/04` for the same reversal.** The wrong direction leaked outside the
   section. At minimum re-point these (re-grep, do not trust the numbers):
   - line **5011** — "`Project` survives, `Job` folds in, UX label stays 'Job'"
   - line **4353** — "`Job` + children … **Deferred to B-P0a** — folded into Project"
   - line **4474** — "Jobs -> /projects (B-P0a: Project spine, 'Job' label)"
   - line **4510** — "Jobs/Projects become one item — B-P0a section 1: Project survives"
   - line **4920** — "committed schema use `projectId` (Project is the surviving spine — B-P0a)"
   Search `git grep -n "Project" sot/04-data-model.md | grep -iE "surviv|spine|folded"` and fix
   every hit. **A half-reversed document is worse than the current one** — it would read as
   deliberate rather than stale.
6. **Do NOT touch the B-P0b section (3959+).** WorkerProfile-canonical is correct and unchanged.
   Where B-P0b cross-references B-P0a slice numbers (B-P0a-7, -9), those slice NUMBERS stay valid —
   only their contents reverse. Leave the cross-references intact.
7. **Drop the marker** `docs/audits/model-merge-direction-reconcile.md`: one page recording what was
   reversed, the commit measured, and the decision trail (BACKLOG-DECISIONS 2026-07-14, Marco
   2026-07-16, Marco re-confirmed 2026-08-20). The backlog item `model-merge-slices-rehomed` gates
   on this file existing.

## Do NOT

- Do NOT touch `sot/02` — already correct.
- Do NOT touch `schema.prisma`, any migration, or any application code. **Document only.**
- Do NOT write the downstream slice prompts. This PR unblocks them; it does not stage them. They run
  **one at a time, Marco-present**, Phase A strictly before Phase B.
- Do NOT re-decide the direction. It is decided. If the evidence in the file looks like it argues
  the other way, that is the stale text you are here to replace.

## Guardrails

- One attempt. If the section already reads Job-canonical, say `NO-OP: <reason>` and exit.
- `pnpm lint` must pass. CP-24 will fail the PR if anything outside `sot/` and `docs/` is touched.
- **`escalates: true`** — open the PR and LEAVE IT UNMERGED for Marco.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
