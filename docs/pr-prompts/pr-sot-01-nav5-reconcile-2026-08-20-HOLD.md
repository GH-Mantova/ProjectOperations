---
premise: 'grep -q "^2\. ESTIMATING" sot/01-charter-and-architecture.md'
premise_means: sot/01 SECTION 9 still names group 2 "ESTIMATING" and carries no CRM group. NAV-1 renamed that group "Tendering" and inserted a top-level CRM group on 2026-08-14; NAV-1..NAV-4 are all merged. The charter describes a sidebar that no longer exists.
scope:
  - sot/01-charter-and-architecture.md
done_when: pnpm lint && ! grep -q "^2\. ESTIMATING" sot/01-charter-and-architecture.md && grep -q "Comms hub" sot/01-charter-and-architecture.md && grep -q "^2\. TENDERING" sot/01-charter-and-architecture.md
size: 1
gate_allow: none
seed_only: false
escalates: true
---

# Doc-reconcile NAV-5: `sot/01` SECTION 9 sidebar navigation

Branch: `docs/sot-01-nav5-reconcile-2026-08-20`. New PR.
**SoT governance doc — Marco reviews the rendered diff.**

## Standing rule

A doc-reconcile PR touches **only** `sot/` and `docs/`. Nothing else. CP-24 (`sot-purity`) enforces
this — verified today at `scripts/pr-gates/pr-gates.mjs:327`:
`codeRe = /^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/` — **no
`docs/`**, so `sot/ + docs/` in one PR is permitted.

**This PR touches exactly one file: `sot/01-charter-and-architecture.md`.**

## Why this PR exists

[MEASURED at `origin/main f4bbb62f`, 2026-08-20T01:5xZ, in a clean `git archive origin/main` tree.]

NAV-1…NAV-4 are all merged — markers present in shipped code
(`ShellLayout.tsx`, `App.tsx`, `pages/crm/*`); `NAV-5` has **zero** markers because NAV-5 *is* this
doc-reconcile. `ShellLayout.tsx:163-166` states the shipped structure in its own words:

> "Sidebar structure — NAV-1 (2026-08-14): **8 groups total** (Dashboards is rendered inline in
> ShellLayout and is not in NAV_GROUPS). The 'Estimating' group has been **renamed 'Tendering'**; a
> new top-level **'CRM'** group has been inserted between Tendering and Projects."

`sot/01` SECTION 9 still describes the pre-NAV-1 sidebar.

### ⚠️ Correction to the Station-00 handover's drift numbers

The handover reported `'CRM' in sot/01 : 1` and `'Accounts' : 3`. Both counts reproduce exactly —
**but every one of those hits is OUTSIDE SECTION 9** (§9 spans lines 338-393):

- `'CRM'` → line **84**, `"SiteDocs + AssetTiger + Monday CRM + Pipedrive"` — competitor tooling in
  SECTION 1 (COMPANY).
- `'Accounts'` → lines **66**, **75** (Amy Russian, accounts payable — SECTION 1) and **712**
  (`isAccountsContact` — SECTION 13 module registry).

**SECTION 9 contains zero references to CRM, Accounts, Comms hub or Leads.** Do not run a
find/replace on those strings — it will corrupt SECTION 1 and SECTION 13. Replace the fenced block
as a whole, as specified below.

## The edit — replace the fenced code block in SECTION 9

FIND the fenced block that begins with the line `1. DASHBOARDS` and ends with the line
`  Safety             → /field/safety` (immediately before the closing ```` ``` ````), and replace
its entire contents with:

```
1. DASHBOARDS
   Home                 → /
                          (custom user dashboards render inline under this group;
                           they are not part of NAV_GROUPS)

2. TENDERING            (renamed from "Estimating" — NAV-1, 2026-08-14)
   Leads & opportunities → /tenders/leads
   Tenders               → /tenders
   Pipeline              → /crm/pipeline
   Schedule of Rates     → /admin/schedule-of-rates
   Contracts             → /contracts
   Reports               → /reports

3. CRM                  (new top-level group — NAV-1, 2026-08-14; gate: crm.view)
   Accounts              → /crm/accounts
   Tenders register      → /crm/register
   Comms hub             → /crm/comms

4. PROJECTS
   Jobs                  → /jobs   (merged Jobs+Projects; label "Jobs")
   Sites                 → /sites

5. OPERATIONS
   Scheduler             → /scheduler
                           (view tabs: Board | Grid | Availability)
   Live crew map         → /workers/live-crew
   Assets & Equipment    → operations/assets-equipment
                           (Assets | Inventory | Maintenance)
   Procurement           → /procurement

6. HR
   Workers               → /workers   (absorbs /resources)
   Leave Approvals       → /workers/leave-approvals
   Job roles             → /workers/job-roles
   Payroll Export        → /timesheets/payroll-export
   Timesheet Approval    → /timesheets/approval
   Dockets               → /dockets
   Expenses              → /expenses

7. SAFETY & COMPLIANCE
   Safety                → /safety
   Cases                 → /cases
   Knowledge Base        → /knowledge
   Compliance            → /compliance
   Forms                 → /forms
   Documents             → /documents   (Archived tab folds /archive)

8. SETTINGS  (role-gated)
   Personal:            Account | Notifications | Calendar sync
   Company:             Company | AI Settings | Data Model
   Administration (admin/super only):
                        Users | Roles | Permissions | Audit | Platform | Job Roles

FIELD (FieldLayout, mobile only — bottom nav)
  Allocations        → /field/allocations
  Pre-start          → /field/pre-start
  Timesheet          → /field/timesheet
  Safety             → /field/safety
```

Leave the `> Implementation is staged separately…` note that follows the block **unchanged**.

## Deliberately NOT changed by this PR

1. **Group 8 (SETTINGS) is left exactly as-is.** The settings restructure (`SLICE 20`) is a separate
   reconcile and **its precondition is not met** — see the note below. Do not touch group 8 here.
2. **The `Directory → /directory` line is removed** from group 2 because `label: "Directory"` returns
   **0** in `ShellLayout.tsx` — it is already gone from the shipped sidebar. Where Directory
   *functionality* lands is the directory-decommission chain's question, not §9's. **Flag for Marco:**
   if he considers the Directory line to be surviving *intent* rather than stale fact, restore it and
   say so in review.
3. **`Rates & Lists`, `Tender Settings` and `Variations (future)`** are likewise removed — all three
   return 0 shipped labels.

## Observation for a development chat (not this PR)

`ShellLayout.tsx:134` sets `to: "operations/assets-equipment"` — **no leading slash**, unlike every
other entry. That is a relative path and is very likely a defect. Out of scope for a doc-reconcile;
recorded so it is not lost. The block above documents it verbatim rather than silently "fixing" it,
because §9 must describe what ships.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
