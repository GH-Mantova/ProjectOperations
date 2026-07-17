---
premise: '! grep -rq "Safety & Compliance" apps/web/src'
premise_means: The sidebar has not been reorganised into the 7 approved groups (the "Safety & Compliance" group label does not exist in the web app yet).
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && grep -rq "Safety & Compliance" apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Sidebar: reorganise into the 7 approved groups (structure + labels only)

Reorganise the desktop sidebar nav into the 7 groups approved by Marco 2026-07-17. This PR changes
ONLY the sidebar structure/labels/ordering + role-gating. Do NOT move or merge any pages/routes yet
(those are separate staged PRs) — every existing route keeps working; only the menu changes.

Groups and items (see sot/01 SECTION 9 for the canonical tree once its doc-reconcile lands):
1. Dashboards: Home (/)
2. Estimating: Tenders, Contracts, Tender Settings, Directory, Rates & Lists, Reports
3. Projects: Jobs, Sites
4. Operations: Scheduler, Assets & Equipment (Assets/Inventory/Maintenance as a collapsible sub-group), Procurement
5. HR: Workers, Payroll Export, Timesheet Approval
6. Safety & Compliance: Safety, Compliance, Forms, Documents
7. Settings (role-gated): a single entry that opens the Settings shell; Administration items admin/super only

Point each item at its CURRENT route for now (e.g. Directory -> /master-data, Jobs -> /jobs). Later
PRs repoint them. Remove sidebar entries for /tenders/dashboard and the two seeded dashboards.

## Do NOT
- Do NOT change routes, merge pages, or delete page components in this PR.
- Do NOT alter the FIELD (mobile) bottom nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. Read the CI job log
before diagnosing any failure. `pnpm build` + `pnpm lint` must pass.
