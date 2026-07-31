---
premise: '! grep -A2 "@Patch(\":slug/items/:itemId\")" apps/api/src/modules/global-lists/global-lists.controller.ts | grep -q "masterdata.manage"'
premise_means: The PATCH list-item endpoint still lacks the masterdata.manage permission decorator, so any authenticated user can edit/archive list items.
scope:
  - apps/api/src/modules/global-lists/global-lists.controller.ts
  - apps/api/src/modules/global-lists/*.spec.ts
  - apps/web/src/pages/account/GlobalListsSection.tsx
done_when: pnpm build && pnpm lint && grep -A2 "@Patch(\":slug/items/:itemId\")" apps/api/src/modules/global-lists/global-lists.controller.ts | grep -q "masterdata.manage"
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# SECURITY: close the masterdata.manage gap on list-item mutation endpoints

## The defect (audit 2026-07-31, verified on origin/main)

`apps/api/src/modules/global-lists/global-lists.controller.ts`:

- `@Post()` (:83) and `@Post(":slug/items")` (:93) correctly carry
  `@RequirePermissions("masterdata.manage")`.
- `@Patch(":slug/items/:itemId")` (:103) and `@Delete(":slug/items/:itemId")` (:117) carry **no
  permission decorator** — they fall through to `assertEditable`
  (`global-lists.service.ts:235-240`), which lets ANY authenticated user edit/archive list items.
- `@Post(":slug/items/reorder")` (:131) — CHECK it too; guard it if unguarded.

Company reference lists (Materials, Measurement units, Scope row types…) are shared master data;
fail-closed is the rule (sot/01 SECTION 6).

## What to build

1. **Controller:** add `@RequirePermissions("masterdata.manage")` immediately after the route
   decorator (mirroring the POST endpoints exactly) on PATCH `:slug/items/:itemId`,
   DELETE `:slug/items/:itemId`, and — if unguarded — POST `:slug/items/reorder`. Update the
   `@ApiResponse` 403 docs to match the POST endpoints' wording. Keep `assertEditable` as
   defence-in-depth; the decorator is the primary gate.
2. **Specs:** update/add controller or service specs asserting a caller WITHOUT
   `masterdata.manage` gets 403 on PATCH/DELETE (and reorder if guarded), and one WITH it
   succeeds. Follow the existing spec pattern in the module.
3. **Frontend honesty (apps/web/src/pages/account/GlobalListsSection.tsx):** the add/edit/archive
   controls currently render for users who cannot use them (the API 403 body gets dumped raw into
   the error state). Gate the mutation controls on the caller actually holding
   `masterdata.manage` (use the existing `can(user, ...)` helper — do NOT trust the `isAdmin`
   prop alone), and show a muted "read-only — managed by administrators" note instead.

## Do NOT

- Do NOT change list read endpoints or their visibility.
- Do NOT touch schema, migrations, seeds, or the RatesListsAdminPage.
- Do NOT relocate the Lists section (that is a separate approved restructure slice).

## VERIFY

- `pnpm build && pnpm lint`
- `grep -A2 "@Patch(\":slug/items/:itemId\")" apps/api/src/modules/global-lists/global-lists.controller.ts | grep -q "masterdata.manage"`
- `grep -A2 "@Delete(\":slug/items/:itemId\")" apps/api/src/modules/global-lists/global-lists.controller.ts | grep -q "masterdata.manage"`
- API unit tests for the module pass.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
