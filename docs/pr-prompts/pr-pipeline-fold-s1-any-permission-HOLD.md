---
premise: '! grep -q "ANY_PERMISSIONS_KEY" apps/api/src/common/auth/permissions.decorator.ts'
premise_means: The permissions guard can only express AND. There is no way to say "either of these permissions will do", so the pipeline dashboard cannot be opened to tender staff without either removing access from CRM staff or duplicating endpoints.
scope:
  - apps/api/src/common/auth/permissions.decorator.ts
  - apps/api/src/common/auth/permissions.guard.ts
  - apps/api/src/common/auth/__tests__/permissions.guard.spec.ts
  - apps/api/src/modules/crm/pipeline/pipeline-dashboard.controller.ts
  - apps/api/src/modules/crm/pipeline/__tests__/pipeline-dashboard.controller.spec.ts
done_when: pnpm build && pnpm lint && grep -q "ANY_PERMISSIONS_KEY" apps/api/src/common/auth/permissions.decorator.ts && grep -q "tenders.view" apps/api/src/modules/crm/pipeline/pipeline-dashboard.controller.ts
size: 5
gate_allow: none
seed_only: false
escalates: true
cluster: pipeline-fold
cluster_order: 1
---

# Let a route accept EITHER of two permissions

**Marco, 2026-08-20:** *"They should be able to see everything. Tenders = CRM in access (the
estimator is the one entering data on the CRM)."* The CRM pipeline dashboard is being folded into
the Tendering Pipeline as an Insights tab (slice 2 of this cluster), and tender staff must see it.

## Why this needs a new mechanism rather than a one-line edit

`PermissionsGuard.canActivate` (`apps/api/src/common/auth/permissions.guard.ts:35-40`) is **AND-only**:

```ts
const grantedPermissions = new Set(request.user?.permissions ?? []);
const missingPermission = requiredPermissions.find((p) => !grantedPermissions.has(p));
if (missingPermission) throw new ForbiddenException(...);
```

So `@RequirePermissions("tenders.view", "crm.view")` demands **both**. There is no way today to say
*"either will do"*, and the two obvious shortcuts are both wrong:

- **Swap `crm.view` → `tenders.view`** on the four dashboard routes: a CRM user who does not hold
  `tenders.view` loses a page they can open today. That narrows access, which fails Marco's standing
  rule.
- **Duplicate the endpoints** under a tenders path: two routes, one service, two things to keep in
  step. The next person changes one.

Build the mechanism once, properly. It is small, and this will not be the last route that wants it.

## What to build

1. **`@RequireAnyPermission(...codes)`** in `permissions.decorator.ts`, alongside the existing
   `RequirePermissions`, writing its codes under a **separate** metadata key — the literal
   `ANY_PERMISSIONS_KEY`. Do not overload the existing key; the two semantics must stay
   distinguishable or the guard cannot tell them apart.

2. **Teach `PermissionsGuard` the ANY case.** Read both keys with the same
   `getAllAndOverride([handler, class])` pattern already used at `:16-20`.
   - `RequirePermissions` keeps its current AND behaviour **exactly**. Do not touch that path.
   - `RequireAnyPermission` passes when the user holds **at least one** listed code.
   - If a handler carries **both** decorators, ALL of the AND set **and** at least one of the ANY set
     must be satisfied. Say so in a comment — an undocumented combination is how this gets misread.
   - The super-user bypass at `:31-32` stays first and unchanged.
   - Keep the error message as informative as the current one: on ANY failure, name the codes that
     would have satisfied it, not just the first missing one.

3. **Apply it to the four dashboard routes.** `pipeline-dashboard.controller.ts` currently carries
   `@RequirePermissions("crm.view")` on every route (`:51`, `:63`, `:71`, and the fourth below).
   Replace each with `@RequireAnyPermission("tenders.view", "crm.view")`. Update the class comment at
   `:40-41` — it says *"Uses `crm.view` on every route"* and would otherwise be a lie the moment this
   merges.

   **Touch no other controller.** This PR opens exactly these four routes and adds a mechanism;
   it does not audit or re-gate anything else.

## Tests

**`permissions.guard.spec.ts`** — follow the existing spec's style:

1. AND unchanged: two `RequirePermissions` codes, user holds one → 403. **This is the regression
   guard on every other route in the app** and matters more than anything else here.
2. ANY passes on the first code; ANY passes on the second code; ANY with neither → 403.
3. Both decorators present: holds all AND + one ANY → allowed; holds all AND + none of ANY → 403.
4. Super user with neither → allowed (bypass still first).
5. **Negative control:** a handler with no decorators at all is still allowed (`:22-24`).

**`pipeline-dashboard.controller.spec.ts`** — a user with `tenders.view` and **not** `crm.view` can
reach `GET /crm/pipeline/dashboard`; a user with `crm.view` and not `tenders.view` still can; a user
with neither gets 403. The middle case is the one that proves nobody lost access.

## Do NOT

- Do NOT change `RequirePermissions` semantics anywhere. Additive only.
- Do NOT re-gate any controller other than `pipeline-dashboard.controller.ts`.
- Do NOT add a permission code, a migration, or a seed change. No new codes are needed — this uses
  two that already exist.
- Do NOT touch the web app. The UI fold is slice 3.
- Do NOT touch `/sot/`.

## Note for the PR body

State plainly that this makes **win rate by estimator** visible to anyone holding `tenders.view`.
Marco accepted that on 2026-08-20 when choosing *"they should be able to see everything"* — his
reasoning being that the estimators are the people entering the CRM data in the first place. Record
it so the next reader does not treat it as an oversight.

Also note the boundary this PR deliberately does **not** cross: Marco's *"Tenders = CRM in access"*
was said about **this surface**. It is not a licence to equate the two permissions across the app,
and nothing here does.

## Guardrails

- One attempt. If `ANY_PERMISSIONS_KEY` already exists, say `NO-OP: <reason>`.
- `pnpm build`, `pnpm lint`, and both specs must pass.
- Five files. **`escalates: true`** — this widens who can read data. Open the PR, leave it unmerged.
