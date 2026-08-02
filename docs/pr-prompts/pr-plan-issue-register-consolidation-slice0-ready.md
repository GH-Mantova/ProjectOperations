---
premise: '! test -f docs/plans/issue-register-consolidation-plan.md'
premise_means: The issue-register consolidation plan does not exist on main yet.
scope:
  - docs/plans/issue-register-consolidation-plan.md
done_when: pnpm lint && test -f docs/plans/issue-register-consolidation-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan: consolidate the three issue registers into ONE (Marco-approved 2026-08-03)

Marco's ruling: Case (schema `Case`), CorrectiveAction, and SafetyIncident(+HazardObservation)
— three parallel registers with the same title/assignee/status/dueAt/close-out shape, three
UIs, three permission families — become ONE issue engine with types. This is a schema-touching
program: PLAN FIRST, nothing irreversible in this PR.

## What to build (docs-only plan, modelled on docs/plans/settings-restructure-plan.md)

Author `docs/plans/issue-register-consolidation-plan.md`:

1. Ground the three models fully (schema blocks, relations, every UI/API/notification/e2e
   consumer — grep with positive controls). Include WHS-compliance constraints: incidents and
   CAPA have Australian WHS audit-trail obligations (sot/01 movement rule: financial/quantity/
   COMPLIANCE state is append-only) — the plan must show how the unified model preserves the
   audit trail and regulatory distinction via a `kind` axis, not by discarding it.
2. Target model proposal: one register entity with kind = CASE | CORRECTIVE_ACTION |
   SAFETY_INCIDENT | HAZARD, per-kind fields strategy (columns vs typed JSON vs child tables),
   permission mapping (cases.* / forms.* / safety.* -> what), and a data-migration strategy
   that is append-only-safe with rollback_strategy per migration slice.
3. Ordered slice list (each <=10 files, plan-chained), redirect/URL map for the three UIs,
   e2e blast radius, risks. Migration slices declare gate_allow: migrations + rollback.
4. An explicit PENDING-MARCO section for anything discovered that changes the shape of his
   ruling (e.g. if WHS constraints argue for keeping SafetyIncident separate, SAY SO with
   evidence — the plan may recommend against full consolidation; Marco decides on review).

## Do NOT
- Do NOT write code, schema, or sot/ edits. Plan only. Code slices come after Marco reviews
  the merged plan.

## VERIFY
- `pnpm lint`; file exists; every consumer of the three models is listed with file:line.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
