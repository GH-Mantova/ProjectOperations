---
premise: grep -q "payroll-export.csv" apps/web/src/pages/timesheets/TimesheetApprovalPage.tsx
premise_means: Timesheet Approval still embeds its own copy of the payroll CSV export that PayrollExportPage owns.
scope:
  - apps/web/src/pages/timesheets/TimesheetApprovalPage.tsx
done_when: pnpm build && pnpm lint && ! grep -q "payroll-export.csv" apps/web/src/pages/timesheets/TimesheetApprovalPage.tsx
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Payroll export dedup: dedicated page keeps it; Timesheet Approval links to it

Marco 2026-08-03: keep `/timesheets/payroll-export` (the dedicated, fully permission-aligned
page) as the one export home; the duplicate CSV export inside Timesheet Approval's "All" tab
(`TimesheetApprovalPage.tsx` ~:423, same endpoint + filename) becomes a router `Link` to
`/timesheets/payroll-export` styled as a secondary button ("Payroll export →").

## What to build

1. Replace the in-tab export download logic with the Link (preserve any filter context the
   page holds only if PayrollExportPage accepts equivalent query params — ground that first;
   if it doesn't, plain link, note it).
2. Remove the now-dead download helper code in that file.

## Do NOT
- Do NOT touch PayrollExportPage or the API.

## VERIFY
- `pnpm build && pnpm lint`; the old endpoint string is gone from TimesheetApprovalPage.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
