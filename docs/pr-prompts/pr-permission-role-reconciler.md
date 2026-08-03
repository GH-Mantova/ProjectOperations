---
premise: '! grep -rq "syncRolePermissions" apps/api/src'
premise_means: There is no runtime reconciler for role->permission assignments; role grants reach prod only via hand-written migrations (the #504/#506/#876 toil).
scope:
  - apps/api/src/common/permissions/**
  - apps/api/src/modules/permissions/**
  - apps/api/prisma/seed-initial-services.ts
done_when: pnpm build && grep -rq "syncRolePermissions" apps/api/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Durable fix: declarative role->permission map + boot-time reconciler

**GATED: this is an AUTHORIZATION-ARCHITECTURE change. Do NOT rename to `-ready` until Marco (or a
PR-Master pass) has signed off on the design.** Staged non-armed on purpose. It is the durable
follow-up to #876's one-off migration.

## Problem (root cause)

Permission *definitions* are declared in code (`apps/api/src/common/permissions/permission-registry.ts`)
and upserted into every DB at boot by `PermissionsService.syncRegistry()`. But role->permission
*assignments* live ONLY in the TypeScript seed (`seed-initial-services.ts`, `seedRoleWithPermissions`).
Production runs `prisma migrate deploy`, which never runs the seed — so a grant added only to the seed
never reaches prod. This has bitten repeatedly: #504 (GlobalList), #506 (super-user never set in prod),
#876 (field-worker expenses). CP-23 backstops it, but every grant then needs a hand-written migration.

## Goal

Make role->permission assignments declarative in code with a deterministic path to production, so a
grant is a one-line map edit and dev-seed + prod converge by construction.

## What to build

1. **A role->permissions map as the single source of truth** — e.g.
   `apps/api/src/common/permissions/role-permission-registry.ts`: for each seeded role
   (`"Field Worker"`, etc.) list its permission codes. This becomes the ONE place grants are declared.
2. **`PermissionsService.syncRolePermissions()`** — mirrors `syncRegistry()`: for each role in the
   map, ensure the `role_permissions` rows exist (insert-if-absent, matched by role name + permission
   code). Runs at boot, right after `syncRegistry()` (so permission + role rows already exist).
3. **`seedRoleWithPermissions` consumes the SAME map** — delete the inline permission-code arrays in
   `seed-initial-services.ts` and read them from the registry, so seed and reconciler can never drift.
4. **Audit, never silent (respect sot/05's anti-silent-drift lesson):**
   - Log at boot exactly which grants it ADDED (role + codes + count).
   - **ADDITIVE ONLY** — it must NEVER delete or overwrite a `role_permissions` row it doesn't know
     about. Directors can grant extra permissions to a role in the UI; the reconciler must not strip
     those. It only ensures the code-declared minimums exist.

## Do NOT
- Do NOT remove, rewrite, or "true-up-by-deleting" any existing grant. Additive only.
- Do NOT weaken or remove CP-23 in this PR. (A follow-up may argue CP-23 can treat map-driven grants as
  covered — but that is a separate, reviewed change, not this one.)
- Do NOT touch Azure / Entra / SharePoint, or change any permission's semantics.
- Do NOT change the permission-registry definitions; this is only about role->permission *assignments*.

## Verify
- `pnpm build` + `pnpm lint` pass.
- A unit test proves `syncRolePermissions()` is idempotent and additive (running twice adds nothing;
  a pre-existing extra grant survives).
- `grep -rq "syncRolePermissions" apps/api/src` is true.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already done.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass. This is a permission change: label the PR do-not-merge so a
  human reviews the reconciler before it lands.
