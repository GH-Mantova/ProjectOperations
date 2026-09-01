---
premise: '! grep -q "TR_SCOPE_CRM" docs/plans/tender-reminders-plan.md'
premise_means: >-
  TR-1..TR-4 target apps/web/src/pages/tendering and apps/api/src/modules/tendering. Marco's 2026-08-20
  ruling puts follow-up and chasing in the CRM, and S7's interaction log is now where next actions come
  from — so all four slices are scoped at the wrong surface and the wrong store.
scope:
  - docs/plans/tender-reminders-plan.md
  - docs/pr-prompts/pr-tr-s1-reminder-policy-HOLD.md
  - docs/pr-prompts/pr-tr-s2-reminder-engine-HOLD.md
  - docs/pr-prompts/pr-tr-s3-manager-escalation-HOLD.md
  - docs/pr-prompts/pr-tr-s4-attention-worklist-HOLD.md
done_when: 'grep -q "TR_SCOPE_CRM" docs/plans/tender-reminders-plan.md'
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: crm-reminders
cluster_order: 1
requires_on_main: apps/api/prisma/schema.prisma :: InteractionChannel
---

# CRM S12 — re-scope the reminder cluster onto the CRM

**Docs and prompts only. No product code in this slice.**

## Why

`docs/plans/tender-reminders-plan.md` (2026-08-13) defines TR-1..TR-4: reminder policy and log,
scheduled engine, manager escalation, "needs attention" worklist. None has been built —
`grep TenderReminder apps/api/prisma/schema.prisma` returns nothing. All four scope the work to the
Tendering surface. Marco's 2026-08-20 ruling reversed that, and S7 has since made the interaction log
the source of next actions.

## Do

1. Add a `TR_SCOPE_CRM` decision block to the plan recording: the cluster targets the **CRM** surface;
   next actions come from S7's interaction log, **not** a separate reminder store; and the worklist is
   the Follow-ups tab S8 built, not a new screen.
2. Update the four TR prompts' `scope`, `premise` and bodies to match. Keep their IDs and cluster order.
3. Re-point each `requires_on_main` at the CRM artefacts that now precede them.
4. Note explicitly what TR still owns that S7/S8 do not: **scheduling** (a job that fires without a user
   present) and **escalation** (routing to a manager when an action stays overdue).

## Do NOT

- **Do NOT write product code.** This is a plan-and-prompt slice.
- **Do NOT delete the TR prompts or the plan.** Re-scope in place; the history is the point.
- Do NOT invent a second reminder store. If the re-scope suggests one, that is a finding for Marco, not
  a decision to take here.
- Do NOT arm any TR prompt.

## STOP AND REPORT

- The re-scope would make a TR slice duplicate S8 outright. Say which, and propose retiring it rather
  than shipping two screens that do the same thing.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
