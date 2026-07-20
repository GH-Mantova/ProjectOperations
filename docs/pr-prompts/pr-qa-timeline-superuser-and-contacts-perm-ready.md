---
premise: '! grep -q "isSuperUser" apps/api/src/modules/platform/timeline.controller.ts'
premise_means: TimelineController.ensureViewer() still hand-rolls a permissions.includes() check with NO isSuperUser short-circuit, so it denies super-users that both official guards would admit — and it still gates Client/Contact on unregistered codes.
scope:
  - apps/api/src/modules/platform/timeline.controller.ts
  - apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts
done_when: pnpm --filter @apps/api build && grep -q "isSuperUser" apps/api/src/modules/platform/timeline.controller.ts && ! grep -q "contacts.view" apps/api/src/modules/platform/timeline.controller.ts && pnpm --filter @apps/api test -- permission-registry-coverage
size: 4
gate_allow: none
seed_only: false
escalates: true
---

# Timeline: honour `isSuperUser`, and stop gating on unregistered permission codes (both shipped by #672)

## The defect (found by 04-scanner, Part 0 (a) authorization parity + (b) permission-code integrity, 2026-07-20)

PR #672 (universal activity Timeline) merged today as `035490c` and shipped
`apps/api/src/modules/platform/timeline.controller.ts` with **two independent authorization defects**
in the same 6-line method.

```ts
// apps/api/src/modules/platform/timeline.controller.ts:13-18
const VIEW_PERMISSIONS: Record<string, string> = {
  Job: "jobs.view",
  Tender: "tenders.view",
  Client: "clients.view",
  Contact: "contacts.view"
};

// apps/api/src/modules/platform/timeline.controller.ts:79-85
private ensureViewer(entityType: string, user: AuthenticatedUser) {
  const required = VIEW_PERMISSIONS[entityType];
  if (!required) return;
  const permissions = user?.permissions ?? [];
  if (permissions.includes(required)) return;
  throw new ForbiddenException(`Missing required permission: ${required}`);
}
```

### Defect 1 — super-user lockout (authorization parity, S2)

`ensureViewer` is a **hand-rolled** permission check; it deliberately bypasses `PermissionsGuard`
because the required code depends on a path param (see the comment at line 32-35). But both official
guards short-circuit on super-user:

- `apps/api/src/common/auth/permissions.guard.ts` — `if (request.user?.isSuperUser) return true;`
- `apps/api/src/modules/personas/persona-permission.guard.ts` — same.

`ensureViewer` does not. And the `permissions` claim is **not** expanded for super-users:
`apps/api/src/modules/users/users.service.ts:253` builds it purely from
`userRoles -> role -> rolePermissions`, and `auth.service.ts:254` mints `isSuperUser` as a **separate**
JWT claim. So a super-user whose roles do not happen to include `jobs.view` / `tenders.view` is
**403'd on every timeline** — on an endpoint every other guard in the codebase would have admitted them to.

Positive control that `isSuperUser ||` is the house convention and not an invention of this prompt:
`apps/api/src/modules/workers/leave-request.service.ts:190` —
`const canManageAll = actor.isSuperUser || actor.permissions.includes("workers.manage");`

### Defect 2 — two permanently-false gates (`clients.view`, `contacts.view`)

Neither `clients.view` nor `contacts.view` exists in
`apps/api/src/common/permissions/permission-registry.ts` (86 entries; verified with `jobs.view`,
`tenders.view` and `directory.view` as positive controls — all three resolve). `PermissionsService`
upserts **only** registry codes, so neither can ever be granted to any role. **Every non-super-user is
permanently 403'd on Client and Contact timelines** — and because Defect 1 also denies super-users
without the code, some accounts are locked out from both directions.

### Why CI is green

`apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts` exists precisely to catch
this class (its header records three prior occurrences). But its extractor matches only
`^\s*@RequirePermissions\(`. These codes live in a **plain object literal**, so the guard is
structurally blind to them. The e2e suite (`batch7-universal-timeline.spec.ts`) runs as the seeded
super-admin, who holds every role — so it cannot see either defect.

### Not already covered

`docs/pr-prompts/pr-qa-clients-perms-registry-ready.md` (armed; PR #674 merged the *prompt*, not the
fix) registers `clients.view`/`clients.manage` only. Its `done_when` greps for `clients.*` and its
`scope` is the registry files — it does **not** touch `contacts.view` and does **not** touch
`timeline.controller.ts`. No open PR, queued prompt, HOLD file, or `qa-findings.md` entry names
`contacts.view` or `ensureViewer`.

## What to build

1. In `timeline.controller.ts`, make `ensureViewer` honour super-user, matching `leave-request.service.ts:190`:

   ```ts
   private ensureViewer(entityType: string, user: AuthenticatedUser) {
     const required = VIEW_PERMISSIONS[entityType];
     if (!required) return;
     if (user?.isSuperUser) return;
     const permissions = user?.permissions ?? [];
     if (permissions.includes(required)) return;
     throw new ForbiddenException(`Missing required permission: ${required}`);
   }
   ```

2. In the same file, retarget the two unregistered entries onto the **already-registered** code that
   documents exactly this data — `directory.view`, whose registry label is
   *"View clients, subcontractors and suppliers"*:

   ```ts
   Client: "directory.view",
   Contact: "directory.view"
   ```

   Leave `Job: "jobs.view"` and `Tender: "tenders.view"` untouched — both resolve in the registry.

3. Extend `permission-registry-coverage.guard.spec.ts` so this class cannot ship through a non-decorator
   site again. Add a **second extractor** that scans for object-literal permission maps — string values
   matching `/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/` inside a `Record<string, string>` declaration whose
   identifier matches `/PERMISSION|PERMS/i` — and assert each extracted code is in `permissionRegistry`
   or on `KNOWN_UNREGISTERED`. Give it its own **positive control** (`expect(codes.size).toBeGreaterThan(0)`),
   as the existing test does — an extractor that silently matches nothing is not a guard (DOCTRINE §7).
   Do **not** add anything to `KNOWN_UNREGISTERED`.

4. Run `pnpm --filter @apps/api build` and the permissions suites; fix anything the change breaks.

## Design note for the reviewer (Marco / supervisor)

Step 2 makes an access-model choice, which is why this is `escalates: true`. Client and Contact
records live under the `directory` module today, so `directory.view` is the code that already means
"may see this record", and reusing it needs no registry change and cannot conflict with the armed
`pr-qa-clients-perms-registry-ready.md`. **The alternative** is to register `clients.view` and a new
`contacts.view` and keep the controller as-is — that keeps a per-entity access model but means the
Client timeline is gated by a *different* permission from the Client record itself. If you take the
alternative, this PR's step 2 should be dropped and the registry prompt extended instead. Step 1 and
step 3 are correct either way and are not affected by that choice.

## Do NOT

- Do NOT edit `apps/api/src/common/permissions/permission-registry.ts` or `module-registry.ts` — the
  armed `pr-qa-clients-perms-registry-ready.md` owns those files this cycle; editing them here would
  conflict.
- Do NOT change `surveys.controller.ts` — its `clients.*` codes are that other prompt's job.
- Do NOT grant any permission to any role, and do NOT seed a role→permission assignment.
- Do NOT add `clients.view` or `contacts.view` to `KNOWN_UNREGISTERED` — that would suppress the
  finding instead of fixing it.
- Do NOT touch migrations, seeds, `.env`, `schema.prisma`, Azure/Entra/SharePoint, or any file outside `scope`.
- Do NOT weaken or delete the existing positive-control test in the coverage guard spec.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

This is `escalates: true` (an authorization access-model change): open the PR and LEAVE IT UNMERGED
for Marco to review. That is the whole instruction — it does not mean stop before opening the PR.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` — never exit silently, never "stand by" for approval.
- Read the CI job log before diagnosing any red check (never from the diff alone).
- The completion test: is there a PR number in your output? If not because the work was already on
  `main`, say `NO-OP`. If not because you are waiting for someone — WRONG, there is nobody; open the PR.
