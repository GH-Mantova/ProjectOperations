---
premise: '! grep -q "model LeaveRequest" apps/api/prisma/schema.prisma'
premise_means: There is no leave-request + approval + self-service (only WorkerLeave/Unavailability data).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/workers/**
  - apps/web/src/pages/field/**
  - apps/web/src/pages/workers/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model LeaveRequest" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | D365 Human Resources (light) parity | leave requests + self-service + org chart -->
# HOLD — Light HR: leave requests + self-service + org chart

STATUS: DRAFTED, STAGED, arm-eligible. D365 HR parity (light). Builds on the existing `WorkerLeave`
/ `WorkerUnavailability` data and the `User.managerId` hierarchy.

## What to build
Branch: `feat/hr-leave-selfservice`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `LeaveRequest` (`workerId`, `type` annual/personal/unpaid/other, `startDate`, `endDate`,
   `hours?`, `reason?`, `status` pending/approved/rejected, `approvedById?`, `approvedAt?`). On
   approval, write the existing `WorkerLeave`/`WorkerUnavailability` so the scheduler already respects it.
2. API in `workers`: submit/approve/reject via the existing **AuthorityService** seam (manager per
   `User.managerId`); guard `workers.manage` / self for own requests.
3. Web — **employee self-service**: on the field/PWA + web, a worker requests leave and sees status +
   balances; a manager approvals surface; and a simple **org chart** view rendered from `managerId`.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT build payroll or full HRIS (out of scope; Xero payroll stays external). Do NOT bypass the
  scheduler by inventing a parallel availability store — write WorkerLeave/Unavailability on approval.
  Do NOT hardcode approvers (AuthorityService/managerId). Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
