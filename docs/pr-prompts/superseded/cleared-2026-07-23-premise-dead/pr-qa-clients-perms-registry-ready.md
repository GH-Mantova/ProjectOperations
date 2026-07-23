---
premise: '! grep -q "clients.manage" apps/api/src/common/permissions/permission-registry.ts'
premise_means: The permission codes "clients.manage" / "clients.view" — required by the shipped surveys/customer-voice controller — are NOT in permission-registry.ts, so they are permanently-false gates.
scope:
  - apps/api/src/common/permissions/permission-registry.ts
  - apps/api/src/common/permissions/module-registry.ts
  - apps/api/src/modules/permissions/**
done_when: pnpm --filter @apps/api build && grep -q "clients.manage" apps/api/src/common/permissions/permission-registry.ts && grep -q "clients.view" apps/api/src/common/permissions/permission-registry.ts && pnpm --filter @apps/api test -- permissions
size: 3
gate_allow: none
seed_only: false
escalates: true
---

# Register the `clients.view` / `clients.manage` permission codes (permanently-false gate shipped by #655)

## The defect (found by 04-scanner, Part 0 (b) permission-code integrity, 2026-07-18)

PR #655 (customer-voice / satisfaction survey capture + client score rollup) shipped four backend
endpoints in `apps/api/src/modules/surveys/surveys.controller.ts` gated on the `clients.*` namespace:

- line ~53/54 — `POST /surveys` — `@RequirePermissions("clients.manage")`
- line ~62/63 — `GET /surveys` — `@RequirePermissions("clients.view")`
- line ~71/72 — `POST /surveys/:id/responses` — `@RequirePermissions("clients.manage")`
- line ~85/86 — `GET /clients/:clientId/satisfaction` — `@RequirePermissions("clients.view")`

**But neither `clients.manage` nor `clients.view` is in
`apps/api/src/common/permissions/permission-registry.ts`, and there is no `"clients"` module in
`module-registry.ts`.** (Client records today live under the `directory` module, whose label is
literally "Directory - clients, subcontractors, suppliers"; nothing in the `clients.*` namespace is
registered.)

`PermissionsGuard` (`apps/api/src/common/auth/permissions.guard.ts`) is **fail-closed**: for a
non-super-user it throws `ForbiddenException` on any required code the user does not hold. A code that
is absent from the registry can never be upserted (`PermissionsService` upserts *only* registry
entries) and therefore can never be granted to any role. There is also no service-layer
`isSuperUser` fallback in `surveys.service.ts`. **Result: only super-users can create surveys, list
surveys, submit survey responses, or read a client's satisfaction rollup — the entire surveys /
customer-voice API is inaccessible to every non-super-user.**

Positive control that this is an omission, not a design choice: the SAME batch registered `cases`
(`cases.view`/`cases.manage`, #653) and `procurement.view/manage/approve/receive` (#659), and all
resolve in the registry. The registration mechanism works; `clients.*` was simply left out. This is
the exact same defect class as S3-023 (`workers.manage`, #658) — an unregistered `@RequirePermissions`
code shipping green because no CI test asserts that controller permission codes are a subset of the
registry.

## What to build

1. In `apps/api/src/common/permissions/module-registry.ts`, add a module:
   `{ name: "clients", label: "Clients and customer voice" }` (append to the array, matching the
   existing comma/format — mirror how the `cases` module was added).
2. In `apps/api/src/common/permissions/permission-registry.ts`, add — next to a sensible neighbour
   (e.g. after the `cases.*` or `directory.*` block), matching the exact object shape used by every
   other entry; every registry entry MUST carry both a `label` and a `description` (the
   `permissions.service.spec.ts` "registry entries all have a module and description" test enforces it):
   - `{ code: "clients.view", module: "clients", label: "View client surveys and satisfaction", description: "View surveys and read client satisfaction rollups" }`
   - `{ code: "clients.manage", module: "clients", label: "Manage client surveys", description: "Create surveys and record survey responses" }`
3. Run the permissions unit suite
   (`apps/api/src/modules/permissions/__tests__/permissions.service.spec.ts`) and fix any assertion
   that breaks from the two new entries (the suite is data-driven over the registry, so it should pass
   as-is, but confirm — do NOT skip it).

Confirm at the end: `grep -q "clients.manage" …/permission-registry.ts` and
`grep -q "clients.view" …/permission-registry.ts` both return 0, and `pnpm --filter @apps/api build` +
the permissions test both pass.

## Design note for the reviewer (Marco / supervisor)

The minimal, non-presumptuous fix is to register the `clients.*` codes the controller already asks for
(above) — this closes the permanently-false gate without changing the controller's intended access
model. An alternative you may prefer is to fold survey access into the existing `directory` module
(retargeting the four endpoints to `directory.view` / `directory.manage`) so client-survey access
rides on the same permission as the rest of the client directory. That is an access-model decision,
so it is left to you; this PR takes the minimal path and does not retarget the controller.

## Do NOT

- Do NOT change `surveys.controller.ts` / `surveys.service.ts` — the codes they require are the
  namespace to register; retargeting them would change the intended access model (see design note —
  reviewer's call, not this PR's).
- Do NOT grant `clients.view` / `clients.manage` to any role or seed any role→permission assignment.
  Registering the codes makes them *assignable*; who gets them is Marco's call. This PR only closes
  the permanently-false gate.
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
