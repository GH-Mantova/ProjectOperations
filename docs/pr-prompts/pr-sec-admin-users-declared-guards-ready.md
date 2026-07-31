---
premise: '! grep -q "PermissionsGuard" apps/api/src/modules/admin-users/admin-users.controller.ts'
premise_means: The admin-users controller still carries JwtAuthGuard only — user create/update/deactivate/password-reset endpoints have no declared permission gate.
scope:
  - apps/api/src/modules/admin-users/**
  - apps/api/src/modules/**/admin-access-requests.controller.ts
done_when: pnpm build && pnpm lint && grep -q "PermissionsGuard" apps/api/src/modules/admin-users/admin-users.controller.ts
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# SECURITY: declare permission guards on admin-users + access-requests mutations

## The defect (system audit 2026-07-31, verified on origin/main)

- `apps/api/src/modules/admin-users/admin-users.controller.ts:30` — `@UseGuards(JwtAuthGuard)`
  ONLY. `POST /admin/users` (:44), `PATCH :userId` (:54), `DELETE :userId` (:68),
  `POST :userId/reset-password` (:75) have NO `PermissionsGuard` and NO `@RequirePermissions`.
  Enforcement lives solely in imperative service code (`admin-users.service.ts` `tierOf()`).
- Same pattern on the access-requests controller (`admin-access-requests.controller.ts`):
  `POST :id/approve` and `POST :id/deny` — service-side check only.

These are user creation, deactivation, password reset and access approval — one refactor away
from an open privilege-escalation endpoint. Fail-closed is the rule (sot/01 SECTION 6). Note the
known blind spot: static guards that exist only in service code are invisible to the
permission-registry CI guard.

## What to build

1. Add `PermissionsGuard` to both controllers' `@UseGuards(...)` and `@RequirePermissions(...)`
   decorators to every mutating endpoint. Ground the correct permission code yourself: read how
   the sibling admin surfaces (roles/permissions/platform controllers) declare user-management
   authority (e.g. `users.manage` / `platform.admin`) and apply the same code consistently. Do
   NOT invent a new permission string.
2. KEEP the existing `tierOf()` / service-side checks — defence in depth; the decorator is the
   declared primary gate.
3. Update the affected `*.spec.ts`: without the permission → 403; with it → existing behaviour
   unchanged (existing happy-path specs must keep passing — if they construct callers without
   permissions, give the test actors the required code).

## Do NOT

- Do NOT change endpoint behaviour, DTOs, or the tier logic.
- Do NOT touch schema, migrations, seeds, or the frontend.
- Do NOT weaken or remove any existing check.

## VERIFY

- `pnpm build && pnpm lint`
- `grep -q "PermissionsGuard" apps/api/src/modules/admin-users/admin-users.controller.ts`
- Every `@Post`/`@Patch`/`@Delete` in both controllers has a `@RequirePermissions` within 2 lines.
- API unit tests for both modules pass.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
