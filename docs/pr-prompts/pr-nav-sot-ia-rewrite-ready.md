---
premise: grep -qx "DIRECTORY" sot/01-charter-and-architecture.md
premise_means: sot/01 SECTION 9 still carries the old drifted sidebar nav (old top-level group header "DIRECTORY" present).
scope:
  - sot/01-charter-and-architecture.md
done_when: '! grep -qx "DIRECTORY" sot/01-charter-and-architecture.md'
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# DOC-RECONCILE (sot-only): rewrite sot/01 SECTION 9 to the approved 7-group nav IA

This is a **sot-only doc-reconcile** change. Touch ONLY `sot/01-charter-and-architecture.md`.
No code. CP-24 requires the PR not mix code and `sot/`.

Marco approved this nav IA on 2026-07-17. Replace the SECTION 9 nav block with the tree below
(keep the FIELD mobile bottom-nav sub-section as-is; only the desktop groups change):

```
1. DASHBOARDS
   Home            -> /
2. ESTIMATING
   Tenders         -> /tenders
   Contracts       -> /contracts
   Tender Settings -> /tenders/settings
   Directory       -> /directory   (tabs: Clients | Subcontractors & Suppliers | Contacts)
   Rates & Lists   -> /admin/rates-lists
   Reports         -> /tenders/reports
   Variations      -> (future)
3. PROJECTS
   Jobs            -> /jobs   (merged Jobs+Projects; label "Jobs")
   Sites           -> /sites
4. OPERATIONS
   Scheduler       -> /scheduler   (Board | Grid | Availability view tabs)
   Assets & Equipment -> Assets | Inventory | Maintenance
   Procurement     -> /procurement
5. HR
   Workers         -> /workers   (absorbs /resources)
   Payroll Export  -> /timesheets/payroll-export
   Timesheet Approval -> /timesheets/approval
6. SAFETY & COMPLIANCE
   Safety          -> /safety
   Compliance      -> /compliance
   Forms           -> /forms
   Documents       -> /documents   (Archived tab folds /archive)
7. SETTINGS  (role-gated)
   Personal:       Account | Notifications | Calendar sync
   Company:        Company | AI Settings | Data Model
   Administration (admin/super only): Users | Roles | Permissions | Audit | Platform | Job Roles
```

Note under the block: implementation is staged separately; deletions (/tenders/dashboard, the two
seeded dashboards, /admin/estimate-rates) are tracked as follow-ups.

## Do NOT
- Do NOT touch any file outside `sot/`. Do NOT edit code, routes, or components in this PR.
- Do NOT change the FIELD (mobile) sub-section.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for
approval before starting", and it does not mean "do the work then ask permission to push". There
is no human in this run. Finishing the work and then asking for permission is indistinguishable
from failing.

## Guardrails
One attempt. Never exit silently — if the premise is already satisfied say `NO-OP: <reason>`.
Never ask a question or stand by for approval. sot-only; keep the PR a clean doc-reconcile.
