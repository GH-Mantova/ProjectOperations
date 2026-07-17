---
premise: '! grep -q "workers.manage" apps/api/src/common/permissions/permission-registry.ts'
premise_means: The permission code "workers.manage" — required by the shipped leave-request controller/service — is NOT in permission-registry.ts, so it is a permanently-false gate.
scope:
  - apps/api/src/common/permissions/permission-registry.ts
  - apps/api/src/common/permissions/module-registry.ts
  - apps/api/src/modules/permissions/**
done_when: pnpm --filter @apps/api build && grep -q "workers.manage" apps/api/src/common/permissions/permission-registry.ts && pnpm --filter @apps/api test -- permissions
size: 3
gate_allow: none
seed_only: false
escalates: true
---

# Register the `workers.manage` permission code (permanently-false gate shipped by #658)

## The defect (found by 04-scanner, Part 0 (b) permission-code integrity, 2026-07-17)

PR #658 (HR self-service leave requests + manager approvals + org chart) shipped three backend
endpoints in `apps/api/src/modules/workers/leave-request.controller.ts` gated on
`@RequirePermissions("workers.manage")`:

- line ~124 — `GET /workers/leave-requests/pending` (list all pending)
- line ~135 — `GET /workers/leave-requests/org-chart`
- line ~160 — `PATCH /workers/leave-requests/:id/decide` (approve / reject)

and `leave-request.service.ts:~190` computes
`const canManageAll = actor.isSuperUser || actor.permissions.includes("workers.manage")`.

**But `workers.manage` is not in `apps/api/src/common/permissions/permission-registry.ts`, and there
is no `"workers"` module in `module-registry.ts`.** Worker-related codes today live under the
`resources` and `field` modules; nothing in the `workers.*` namespace is registered.

`PermissionsGuard` (`apps/api/src/common/auth/permissions.guard.ts`) is **fail-closed**: for a
non-super-user it throws `ForbiddenException` on any required code the user does not hold. A code that
is absent from the registry can never be upserted (`PermissionsService` upserts *only* registry
entries) and therefore can never be granted to any role. **Result: only super-users can list pending
leave, view the org chart, or approve/reject leave.** The "manager approvals" half of the feature is
inaccessible to the managers it was built for. (Self-service — `GET`/`POST` on own requests — has no
`@RequirePermissions` and works fine.)

Positive control that this is an omission, not a design choice: the SAME #658 commit correctly added
the `cases` module to `module-registry.ts` and `cases.view`/`cases.manage` to `permission-registry.ts`
for the sibling #653 work, and `procurement.view/manage/approve/receive` all resolve. The registration
mechanism works; `workers.manage` was simply left out.

## What to build

1. In `apps/api/src/common/permissions/module-registry.ts`, add a module:
   `{ name: "workers", label: "Workers and leave" }` (append to the array, matching the existing
   comma/format — mirror how the `cases` module was added).
2. In `apps/api/src/common/permissions/permission-registry.ts`, add — next to a sensible neighbour
   (e.g. after the `resources.*` or `field.*` block, or the cases block), matching the exact object
   shape used by every other entry:
   `{ code: "workers.manage", module: "workers", label: "Manage worker leave and org structure", description: "List all leave requests, view the org chart, and approve or reject leave" }`
   Use the label/description wording above (or clearer equivalents); every registry entry MUST carry
   both a `label` and a `description` — the `permissions.service.spec.ts` "registry entries all have a
   module and description" test enforces it.
3. Run the permissions unit suite (`apps/api/src/modules/permissions/__tests__/permissions.service.spec.ts`)
   and fix any assertion that breaks from the new entry (the suite is data-driven over the registry, so
   it should pass as-is, but confirm — do NOT skip it).

Confirm at the end: `grep -q "workers.manage" apps/api/src/common/permissions/permission-registry.ts`
returns 0, and `pnpm --filter @apps/api build` + the permissions test both pass.

## Do NOT

- Do NOT change `leave-request.controller.ts` / `leave-request.service.ts` — the code they require is
  correct; the registry is what is missing. (If you instead retargeted them to an existing code you
  would change the intended access model — out of scope.)
- Do NOT grant `workers.manage` to any role or seed any role→permission assignment. Registering the
  code makes it *assignable*; who gets it is Marco's call. This PR only closes the permanently-false
  gate.
- Do NOT add a `workers.view` code — the self-service endpoints intentionally require no permission.
- Do NOT touch migrations, seeds, `.env`, Azure/Entra/SharePoint, or any file outside `scope`.
- Do NOT regenerate the data-model map (no `schema.prisma` change here).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

This is `escalates: true` (an authorization-registry change): open the PR and LEAVE IT UNMERGED for
Marco to review. That is the whole instruction — it does not mean stop before opening the PR.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` — never exit silently, never "stand by" for approval.
- Read the CI job log before diagnosing any red check (never from the diff alone).
- The completion test: is there a PR number in your output? If not because the work was already on
  `main`, say `NO-OP`. If not because you are waiting for someone — WRONG, there is nobody; open the PR.
