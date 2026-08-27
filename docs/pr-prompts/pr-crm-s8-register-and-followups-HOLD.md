---
premise: '! grep -q "CRM_REGISTER_V2" apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: >-
  The CRM register is a read-only subset of the Tendering register — no sort, no export, no bulk action,
  three filters against Tendering's eight, and none of the post-submission columns that would make it the
  richer surface Marco's 2026-08-20 ruling calls for.
scope:
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/crm-api.ts
  - apps/api/src/modules/crm/**
  - apps/web/src/pages/crm/__tests__/**
done_when: >-
  pnpm build && pnpm lint && grep -q "CRM_REGISTER_V2"
  apps/web/src/pages/crm/TendersRegisterPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: crm-build
cluster_order: 8
requires_on_main: apps/api/prisma/schema.prisma :: InteractionChannel
---

# CRM S8 — Register and Follow-ups, one screen and one list

Marco's decision 6: **one list, two tabs, toggleable filters — not two data sources.**

## Do

1. Bring the register up to the Tendering register's capability: column sort, CSV export, and the full
   filter set (`TendersRegisterPage.tsx:27-39` already builds `EMPTY_FILTERS` supporting estimator,
   probability, value range, due-date range, discipline and sort — all hard-coded empty and unexposed.
   **Expose what is already there before adding anything new.**)
2. Add the post-submission columns, sourced from S7's log: **Last interaction** (channel + when + one-line
   summary), **Logged by**, **Next action** (with an overdue chip).
3. A **Log** action on every row, writing an interaction and setting the next action in one step.
4. **Follow-ups is the same list**, with the amber toggles on and "On track" off. Toggle row:
   Overdue · Due soon · No next action · On track, then Submitted tenders · Opportunities · Leads ·
   Won & lost, then Mine only. Turning "Won & lost" on returns the full register.
5. Saved views — "Save this view" keeps whatever combination is set.
6. Mark the file with a `CRM_REGISTER_V2` comment in the existing marker style.

## Do NOT

- **Do NOT create a second data source for Follow-ups.** It is a filter over the register's list. If you
  find yourself writing a second fetch, the design has gone wrong — stop and report.
- Do NOT change the Tendering register (`pages/tendering/TenderingPage.tsx`). This is the CRM view.
- Do NOT let the CRM write a tender's price, scope or outcome. Interactions and next actions only.
- Do NOT retire `/crm/register`.

## Tests

Pure helpers, per `DropReasonAdminPage.test.ts`.
1. The Follow-ups toggle set is a **filter predicate over the same rows** — assert that with all toggles
   on, the Follow-ups row set equals the Register row set. This is the assertion that pins decision 6.
2. Overdue classification: `nextActionAt < now` → overdue; null → "no next action"; future → due soon
   or on track by the threshold. Include the boundary.
3. Sort is stable and matches the DB collation the export relies on — reuse whatever comparator
   `rates-export.service.ts` established rather than `.toLowerCase()`.
4. Log writes an interaction **and** a next action in one payload — assert both keys present.

## STOP AND REPORT

- S7's log cannot be read for a tender row. That is the whole premise; report rather than working around.
- The existing `FiltersForQuery` shape does not support a filter the plan lists.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
