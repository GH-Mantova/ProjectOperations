---
premise: '! test -f apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts'
premise_means: There is no CI guard asserting that every @RequirePermissions code is registered, so a permanently-false permission gate can still ship green.
scope:
  - apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts
done_when: pnpm --filter @apps/api test -- permission-registry-coverage && test -f apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Add a CI guard: every `@RequirePermissions` code must exist in the permission registry

## The defect class (found by 04-scanner, Part 0 (b), 2026-07-20 — THIRD occurrence)

`PermissionsGuard` (`apps/api/src/common/auth/permissions.guard.ts`) is **fail-closed**, and
`PermissionsService` upserts **only** entries present in
`apps/api/src/common/permissions/permission-registry.ts`. So a `@RequirePermissions("x.y")` whose code
is absent from the registry can never be granted to any role — it is a **permanently-false gate**.
Every non-super-user is locked out of that endpoint forever, and CI is green the whole time.

This has now shipped three times, each caught only by a scanner sweep, never by a test:

| code | shipped by | endpoints locked | status |
|---|---|---|---|
| `workers.manage` | #658 (HR leave self-service) | pending list, org chart, approve/reject | armed: `pr-qa-workers-manage-permission-registry-ready.md` |
| `clients.manage` / `clients.view` | #655 (customer-voice surveys) | all 4 surveys/satisfaction endpoints | armed: `pr-qa-clients-perms-registry-ready.md` |

Re-confirmed on `origin/main` (5e21997) this run: `clients.manage`, `clients.view` and
`workers.manage` are all still absent from `permission-registry.ts`, while `tenders.view` (positive
control) is present at line 54. Both fix prompts still lint **ADMIT**, so none of this has landed yet.

`pr-qa-clients-perms-registry-ready.md:45` names the root cause in as many words:

> "…shipping green because **no CI test asserts that controller permission codes are a subset of the
> registry**."

Both fix prompts deliberately scope that test OUT (they register codes only). **Nothing is staged to
close it.** Registering three codes fixes three symptoms; this PR fixes the class.

The existing `permissions.service.spec.ts` does NOT cover this — it validates the registry against
itself (every entry has a module and description, upsert count matches length). It never looks at a
single enforcement site.

## What to build

Create **one file**: `apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts`,
modelled on the existing `apps/api/src/common/__tests__/route-shadowing.guard.spec.ts` (same
directory, same static-source-scan + allowlist shape — read it first and follow its conventions).

The spec must:

1. Recursively read `apps/api/src` for `.ts` files, **excluding** `__tests__/` and `*.spec.ts`.
2. Extract every string literal argument of `@RequirePermissions(...)` (the decorator is exported from
   `apps/api/src/common/auth/permissions.decorator.ts`; it is variadic —
   `RequirePermissions(...permissions: string[])` — so handle multiple comma-separated literals in one
   call). A regex over source text is fine and is what route-shadowing.guard.spec does; do NOT pull in
   a TypeScript AST dependency.
3. Import `permissionRegistry` from `../permissions/permission-registry` and build a `Set` of codes.
4. Assert every extracted code is in that set. On failure the message MUST name the offending code and
   the file it was found in — a bare `expect(x).toBe(y)` here is useless to whoever hits it.
5. Carry an explicit, commented allowlist constant for the three codes that are **currently** broken so
   the suite is GREEN on merge:

```ts
// Codes enforced today but not yet registered. Each has an armed fix prompt;
// DELETE the entry from this list when its PR merges — do not add new ones.
//   workers.manage            -> pr-qa-workers-manage-permission-registry-ready.md
//   clients.view/.manage      -> pr-qa-clients-perms-registry-ready.md
const KNOWN_UNREGISTERED = new Set(["workers.manage", "clients.view", "clients.manage"]);
```

6. Add a **second** test asserting `KNOWN_UNREGISTERED` contains no code that IS now in the registry —
   so the allowlist cannot rot: the moment a fix PR lands, this test goes red and forces the stale
   entry out. Without this the allowlist silently becomes permanent, which is the same
   nobody-comes-back-to-ask failure the guard exists to end.
7. Include a **positive control** in the spec itself: assert the extractor found a non-zero number of
   codes (e.g. `expect(found.size).toBeGreaterThan(20)`). A regex that silently matches nothing would
   otherwise pass forever while checking absolutely nothing — an instrument that cannot fail is not a
   guard. This assertion is not optional.

## Do NOT

- Do NOT add, remove, or edit any entry in `permission-registry.ts` or `module-registry.ts` — the two
  armed prompts own that, and touching it here would collide with them.
- Do NOT change any controller, guard, decorator, or service. This PR adds **one test file** and
  nothing else.
- Do NOT make the suite red on merge. If your extractor finds an offender beyond the three listed
  above, that is a NEW finding: put it in the allowlist with a `TODO(04-scanner)` comment naming the
  file and line, and say so plainly in the PR body — do not silently widen the list.
- Do NOT touch migrations, seeds, `.env`, Azure/Entra/SharePoint, or any file outside `scope`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` — never exit silently, never "stand by" for approval.
- Read the CI job log before diagnosing any red check (never from the diff alone).
- Run the new spec locally and make it FAIL once on purpose (temporarily drop an entry from
  `KNOWN_UNREGISTERED`) before trusting that it passes. A guard you have only ever seen pass is a
  guard you have not tested.
- The completion test: is there a PR number in your output? If not because the work was already on
  `main`, say `NO-OP`. If not because you are waiting for someone — WRONG, there is nobody; open the PR.
