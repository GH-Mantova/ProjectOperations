---
premise: '! grep -q "/workers/leave-approvals" apps/web/src/components/ShellLayout.tsx'
premise_means: The LeaveRequest approvals inbox still has no nav entry and the three leave surfaces still disagree — the consolidation has not started.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
  - apps/web/src/pages/workers/WorkerLeaveApprovalsPage.tsx
  - apps/api/src/modules/workers/leave-request.controller.ts
  - apps/api/src/modules/workers/*.spec.ts
done_when: pnpm build && pnpm lint && grep -q "/workers/leave-approvals" apps/web/src/components/ShellLayout.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Leave consolidation slice 1: LeaveRequest is canonical — surface approvals, unify statuses

Marco's ruling 2026-08-03: the canonical flow is field self-service `LeaveRequest` ->
approvals in ONE home; `WorkerLeave` becomes the approved-outcome record only. This slice
surfaces and hardens the canonical path; slice 2 (retiring the duplicate WorkerLeave
approve/decline UI in AvailabilitySection + any data reconciliation) follows separately.

## What to build

1. **Nav:** add "Leave Approvals" to the HR group -> `/workers/leave-approvals`,
   `requiresPermission: "workers.manage"` (mirrors `leave-request.controller.ts:124,135,160`).
   Breadcrumb entry. Nav test updated + run locally.
2. **Page honesty (`WorkerLeaveApprovalsPage.tsx`):** add the standard `NoAccess` gate on
   `workers.manage` (today a raw 403 body dumps into a red div ~:165); readable error states.
3. **Status vocabulary:** the two models disagree (`REJECTED` vs `DECLINED`). Unify the
   USER-FACING vocabulary to one term (pick the one the API enum actually stores for
   LeaveRequest; display the same word everywhere in this page). Do NOT rename enum values
   in the schema here — display-layer only; note the enum split for slice 2.
4. **Specs:** controller spec for the 403 path if missing; keep behaviour otherwise.

## Do NOT
- Do NOT touch AvailabilitySection / WorkerLeave UI (slice 2).
- Do NOT change schema or the approval-creates-WorkerLeave behaviour
  (`leave-request.controller.ts:161`) — it is the bridge until slice 2.
- Do NOT touch FieldLeavePage (already getting its field-nav entry separately).

## VERIFY
- `pnpm build && pnpm lint`; nav entry present + gated; NoAccess renders for non-holders.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
